import logging
import math
from typing import Any, Optional

from apps.ai.models.embedding import ContentEmbedding
from apps.ai.router import ai_router
from apps.communities.models.community import Community

logger = logging.getLogger(__name__)


def compute_cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Computes the cosine similarity between two float vectors."""
    if not v1 or not v2:
        return 0.0

    if len(v1) != len(v2):
        logger.warning(
            f"[compute_cosine_similarity] Vector dimension mismatch ({len(v1)} vs {len(v2)}). "
            "Vectors originated from different embedding models; similarity may be degraded."
        )

    length = min(len(v1), len(v2))
    dot = sum(v1[i] * v2[i] for i in range(length))
    norm1 = math.sqrt(sum(v1[i] * v1[i] for i in range(length)))
    norm2 = math.sqrt(sum(v2[i] * v2[i] for i in range(length)))

    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0

    score = dot / (norm1 * norm2)
    return max(0.0, min(1.0, float(score)))


class SemanticSearchService:
    compute_cosine_similarity = staticmethod(compute_cosine_similarity)
    """
    High-performance semantic search and duplicate question detection service.
    Powers real-time duplicate checks during post composition and community-wide RAG.
    """

    @classmethod
    def index_content(
        cls,
        content_type: str,
        object_id: str,
        community: Community,
        title: str,
        text: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> ContentEmbedding:
        """
        Generates and saves the vector embedding for a piece of content.
        """
        full_text = f"{title}\n{text}".strip()
        embedding_vec = ai_router.generate_embedding(full_text, community=community)

        meta = metadata or {}
        meta.setdefault("snippet", text[:240].strip())
        meta["dimensions"] = len(embedding_vec)

        embedding_obj, _ = ContentEmbedding.objects.update_or_create(
            community=community,
            content_type=content_type,
            object_id=str(object_id),
            defaults={
                "title": title[:255],
                "embedding": embedding_vec,
                "metadata": meta,
            },
        )
        return embedding_obj

    @classmethod
    def check_duplicate_posts(
        cls,
        community: Community,
        title: str,
        content: str = "",
        threshold: float = 0.65,
        limit: int = 5,
    ) -> dict[str, Any]:
        """
        Analyzes a draft post and returns existing similar questions in the community.
        Operates in sub-200ms using cached embeddings and cosine similarity.
        """
        combined = f"{title}\n{content}".strip()
        if not combined or len(combined) < 5:
            return {"has_duplicates": False, "duplicates": []}

        query_vec = ai_router.generate_embedding(combined, community=community)

        # Retrieve embeddings of type 'post' for this community
        candidates = ContentEmbedding.objects.filter(
            community=community,
            content_type="post",
        ).exclude(embedding=[])

        matches = []
        for cand in candidates:
            sim = compute_cosine_similarity(query_vec, cand.embedding)
            if sim >= threshold:
                meta = cand.metadata if isinstance(cand.metadata, dict) else {}
                url = meta.get("url") or f"/communities/{community.slug}/posts/{cand.object_id}"
                matches.append({
                    "id": cand.object_id,
                    "title": cand.title,
                    "similarity_score": round(sim, 3),
                    "url": url,
                    "snippet": meta.get("snippet", ""),
                    "is_solved": bool(meta.get("is_solved", False)),
                })

        matches.sort(key=lambda x: x["similarity_score"], reverse=True)
        top_matches = matches[:limit]

        return {
            "has_duplicates": len(top_matches) > 0,
            "threshold": threshold,
            "count": len(top_matches),
            "duplicates": top_matches,
        }

    @classmethod
    def semantic_search(
        cls,
        community: Community,
        query: str,
        content_types: Optional[list[str]] = None,
        limit: int = 10,
        min_similarity: float = 0.10,
    ) -> list[dict[str, Any]]:
        """
        Performs global natural-language semantic search across posts, lessons, and event replays.
        Filters out unpublished courses for lessons.
        """
        if not query or len(query.strip()) < 2:
            return []

        query_vec = ai_router.generate_embedding(query.strip(), community=community)

        qs = ContentEmbedding.objects.filter(community=community).exclude(embedding=[])
        if content_types:
            qs = qs.filter(content_type__in=content_types)

        # A4: Identify unpublished courses to exclude their lesson embeddings from search results
        from apps.classroom.models.course import Course
        unpublished_course_ids = set(
            str(cid)
            for cid in Course.objects.filter(community=community, is_published=False).values_list("id", flat=True)
        )

        results = []
        for item in qs:
            meta = item.metadata if isinstance(item.metadata, dict) else {}

            # Filter out lessons belonging to unpublished courses
            if item.content_type == "lesson" and meta.get("course_id") in unpublished_course_ids:
                continue

            sim = compute_cosine_similarity(query_vec, item.embedding)
            if sim >= min_similarity:
                default_url = (
                    f"/communities/{community.slug}/posts/{item.object_id}"
                    if item.content_type == "post"
                    else f"/communities/{community.slug}/courses"
                )
                results.append({
                    "id": item.object_id,
                    "content_type": item.content_type,
                    "title": item.title,
                    "similarity_score": round(sim, 3),
                    "url": meta.get("url") or default_url,
                    "snippet": meta.get("snippet", ""),
                })

        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results[:limit]

