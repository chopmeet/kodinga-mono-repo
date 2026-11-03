from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.serializers import (
    CheckDuplicatePostsSerializer,
    SemanticSearchQuerySerializer,
)
from apps.ai.services.semantic_search_service import SemanticSearchService
from apps.communities.models.community import Community


class CheckDuplicatePostsView(APIView):
    """
    Sub-200ms real-time check for duplicate technical questions/posts
    using cosine similarity on vector embeddings.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug: str):
        community = get_object_or_404(Community, slug=slug)
        serializer = CheckDuplicatePostsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        title = serializer.validated_data["title"]
        content = serializer.validated_data.get("content", "")
        threshold = serializer.validated_data.get("threshold", 0.78)

        result = SemanticSearchService.check_duplicate_posts(
            community=community,
            title=title,
            content=content,
            threshold=threshold,
        )

        return Response(
            {
                "has_potential_duplicates": result.get("has_duplicates", False),
                "count": result.get("count", 0),
                "threshold_used": result.get("threshold", threshold),
                "duplicates": result.get("duplicates", []),
            },
            status=status.HTTP_200_OK,
        )


class SemanticSearchView(APIView):
    """
    Cross-content semantic search (discussions, questions, lessons, projects)
    powered by dense vector embeddings.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug: str):
        community = get_object_or_404(Community, slug=slug)
        serializer = SemanticSearchQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        query = serializer.validated_data["query"]
        content_types = serializer.validated_data.get("content_types") or None
        limit = serializer.validated_data.get("limit", 10)

        results = SemanticSearchService.semantic_search(
            community=community,
            query=query,
            content_types=content_types,
            limit=limit,
        )

        return Response(
            {
                "query": query,
                "count": len(results),
                "results": results,
            },
            status=status.HTTP_200_OK,
        )
