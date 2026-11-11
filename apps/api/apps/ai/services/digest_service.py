import json
import logging
from datetime import timedelta
from typing import Any, Optional

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.ai.models.digest import CommunityWeeklyDigest, UserDigestDelivery
from apps.ai.router import ai_router
from apps.communities.models.community import Community
from apps.events.models.event import Event, EventStatus
from apps.memberships.models.member import CommunityMember, MembershipStatus
from apps.posts.models.comment import Comment
from apps.posts.models.post import Post
from apps.projects.models.project import Project, ProjectStatus

logger = logging.getLogger(__name__)
User = get_user_model()


class CommunityDigestService:
    """
    Automated Weekly Community Pulse Digest generator.
    Synthesizes discussions, member projects, upcoming events, and growth KPIs.
    """

    @staticmethod
    def get_week_identifier(date=None) -> str:
        d = date or timezone.now()
        cal = d.isocalendar()
        return f"{cal[0]}-W{cal[1]:02d}"

    @classmethod
    def generate_weekly_digest(
        cls,
        community: Community,
        week_identifier: Optional[str] = None,
        force_refresh: bool = False,
    ) -> CommunityWeeklyDigest:
        """
        Gathers weekly data and prompts AI Router to generate an engaging Community Pulse.
        """
        now = timezone.now()
        week_id = week_identifier or cls.get_week_identifier(now)

        existing = CommunityWeeklyDigest.objects.filter(
            community=community,
            week_identifier=week_id,
        ).first()

        if existing and not force_refresh:
            return existing

        seven_days_ago = now - timedelta(days=7)
        next_fourteen_days = now + timedelta(days=14)

        # 1. Gather KPIs
        new_members_count = CommunityMember.objects.filter(
            community=community,
            status=MembershipStatus.ACTIVE,
            joined_at__gte=seven_days_ago,
        ).count()

        weekly_posts = Post.objects.filter(
            community=community,
            created_at__gte=seven_days_ago,
        ).select_related("author")

        weekly_posts_count = weekly_posts.count()

        weekly_comments_count = Comment.objects.filter(
            post__community=community,
            created_at__gte=seven_days_ago,
        ).count()

        kpis_snapshot: dict[str, Any] = {
            "new_members": new_members_count,
            "posts_created": weekly_posts_count,
            "comments_posted": weekly_comments_count,
            "week": week_id,
        }

        # 2. Gather Top Debates / Discussions
        top_posts_qs = (
            Post.objects.filter(community=community, created_at__gte=seven_days_ago)
            .select_related("author")
            .order_by("-comments_count", "-reactions_count")[:5]
        )

        top_debates: list[dict[str, Any]] = []
        for post in top_posts_qs:
            top_debates.append(
                {
                    "id": str(post.id),
                    "title": post.title or (post.content[:60] + "..."),
                    "author": post.author.username,
                    "comments_count": post.comments_count,
                    "post_type": post.post_type,
                }
            )

        # 3. Highlighted Project
        highlighted_proj_obj = (
            Project.objects.filter(
                community=community,
                status=ProjectStatus.PUBLISHED,
                created_at__gte=seven_days_ago,
            )
            .select_related("owner")
            .order_by("-upvotes_count", "-created_at")
            .first()
        )

        highlighted_project: dict[str, Any] = {}
        if highlighted_proj_obj:
            highlighted_project = {
                "id": str(highlighted_proj_obj.id),
                "title": highlighted_proj_obj.title,
                "slug": highlighted_proj_obj.slug,
                "owner": highlighted_proj_obj.owner.username,
                "tagline": highlighted_proj_obj.tagline
                or highlighted_proj_obj.description[:120],
                "repository_url": highlighted_proj_obj.repository_url,
                "demo_url": highlighted_proj_obj.demo_url,
            }

        # 4. Upcoming Events
        upcoming_events_qs = (
            Event.objects.filter(
                community=community,
                status=EventStatus.SCHEDULED,
                start_time__gte=now,
                start_time__lte=next_fourteen_days,
            )
            .select_related("host")
            .order_by("start_time")[:4]
        )

        upcoming_events: list[dict[str, Any]] = []
        for evt in upcoming_events_qs:
            upcoming_events.append(
                {
                    "id": str(evt.id),
                    "title": evt.title,
                    "slug": evt.slug,
                    "event_type": evt.event_type,
                    "event_format": getattr(evt, "format", "livekit"),
                    "start_date": evt.start_time.isoformat()
                    if getattr(evt, "start_time", None)
                    else None,
                    "host": evt.host.username,
                }
            )

        # 5. AI Synthesis Prompt
        prompt = (
            f"Tu es le curateur technique de la communauté '{community.name}'. "
            f"Synthétise les faits marquants de la semaine {week_id}.\n"
            f"KPIs : {new_members_count} nouveaux membres, {weekly_posts_count} posts, {weekly_comments_count} commentaires.\n"
            f"Discussions phares : {json.dumps(top_debates, ensure_ascii=False)}\n"
            f"Projet phare : {json.dumps(highlighted_project, ensure_ascii=False)}\n"
            f"Événements à venir : {json.dumps(upcoming_events, ensure_ascii=False)}\n\n"
            f"Génère une réponse structurée au format JSON strict avec les clés :\n"
            f'- "headline": une phrase percutante d\'accroche (max 100 caractères)\n'
            f'- "summary_markdown": un texte markdown vivant et bien structuré résumant la semaine, valorisant les '
            f"contributeurs et incitant à participer aux événements futurs.\n"
        )

        headline = f"L'essentiel de la semaine sur {community.name} ({week_id})"
        summary_markdown = (
            f"### 🚀 Ce qui s'est passé cette semaine sur {community.name}\n\n"
            f"Bienvenue aux **{new_members_count} nouveaux membres** qui nous ont rejoints cette semaine ! "
            f"La communauté a été très active avec {weekly_posts_count} nouvelles discussions et "
            f"{weekly_comments_count} interactions partagées.\n\n"
        )

        try:
            ai_response = ai_router.generate_text(
                prompt=prompt,
                community=community,
                system_instruction="Tu es un rédacteur tech communautaire d'élite. Réponds en JSON valide sans fioritures.",
                response_format={"type": "json_object"},
                max_tokens=1000,
            )
            raw = (
                ai_response.content
                if hasattr(ai_response, "content")
                else str(ai_response)
            ).strip()
            if raw.startswith("```json"):
                raw = raw[7:]
            if raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            parsed = json.loads(raw.strip())
            if isinstance(parsed, dict):
                if parsed.get("headline"):
                    headline = str(parsed["headline"]).strip()
                if parsed.get("summary_markdown"):
                    summary_markdown = str(parsed["summary_markdown"]).strip()
        except Exception as exc:
            logger.warning(
                "AI digest generation failed for community %s: %s", community.slug, exc
            )

        with transaction.atomic():
            digest, _ = CommunityWeeklyDigest.objects.update_or_create(
                community=community,
                week_identifier=week_id,
                defaults={
                    "headline": headline,
                    "summary_markdown": summary_markdown,
                    "top_debates": top_debates,
                    "highlighted_project": highlighted_project,
                    "upcoming_events": upcoming_events,
                    "kpis_snapshot": kpis_snapshot,
                },
            )

        return digest

    @classmethod
    def get_or_create_current_digest(
        cls, community: Community
    ) -> CommunityWeeklyDigest:
        week_id = cls.get_week_identifier()
        digest = CommunityWeeklyDigest.objects.filter(
            community=community, week_identifier=week_id
        ).first()
        if digest:
            return digest
        return cls.generate_weekly_digest(community, week_identifier=week_id)

    @classmethod
    def deliver_digest_to_member(
        cls,
        digest: CommunityWeeklyDigest,
        user: Any,
        via_email: bool = False,
    ) -> UserDigestDelivery:
        delivery, created = UserDigestDelivery.objects.get_or_create(
            user=user,
            digest=digest,
            defaults={"delivered_via_email": via_email},
        )
        if not created and via_email and not delivery.delivered_via_email:
            delivery.delivered_via_email = True
            delivery.save(update_fields=["delivered_via_email"])
        return delivery


community_digest_service = CommunityDigestService()
