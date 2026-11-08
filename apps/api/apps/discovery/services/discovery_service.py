from typing import Any, Optional

from django.db.models import Count, Q, Value
from django.db.models.functions import Concat
from django.utils import timezone

from apps.accounts.models.user import User
from apps.classroom.models.course import Course
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.events.models.event import Event, EventStatus
from apps.memberships.models.member import MembershipStatus
from apps.posts.models.post import Post
from apps.profiles.models.profile import DeveloperProfile


class DiscoveryService:
    """
    Search and recommendation engine across communities, courses,
    events, developers and discussions.
    """

    @classmethod
    def search_all(
        cls,
        query: str,
        content_type: Optional[str] = None,
        limit: int = 10,
        user: Optional[User] = None,
    ) -> dict[str, Any]:
        q = (query or "").strip()
        results: dict[str, Any] = {
            "communities": [],
            "courses": [],
            "events": [],
            "developers": [],
            "posts": [],
        }

        if not q:
            return results

        # 1. Communities
        if not content_type or content_type == "community":
            comm_qs = (
                Community.objects.filter(
                    is_active=True,
                    privacy_type=CommunityPrivacy.PUBLIC,
                )
                .filter(
                    Q(name__icontains=q)
                    | Q(description__icontains=q)
                    | Q(slug__icontains=q)
                )
                .order_by("-members_count")[:limit]
            )
            results["communities"] = list(comm_qs)

        # 2. Courses
        # Seules les formations des communautés publiques et actives sont visibles par tous.
        # Les formations des communautés privées ne sont visibles que par leurs membres actifs ou le propriétaire.
        if not content_type or content_type == "course":
            base_course_q = Q(
                is_published=True,
                community__is_active=True,
                community__privacy_type=CommunityPrivacy.PUBLIC,
            )
            if user and user.is_authenticated:
                base_course_q |= Q(
                    is_published=True,
                    community__is_active=True,
                    community__owner=user,
                )
                base_course_q |= Q(
                    is_published=True,
                    community__is_active=True,
                    community__memberships__user=user,
                    community__memberships__status=MembershipStatus.ACTIVE,
                )

            course_qs = (
                Course.objects.filter(base_course_q)
                .filter(Q(title__icontains=q) | Q(description__icontains=q))
                .select_related("community")
                .annotate(students_count=Count("enrollments"))
                .order_by("-students_count", "-lessons_count", "-created_at")
                .distinct()[:limit]
            )
            results["courses"] = list(course_qs)

        # 3. Events
        if not content_type or content_type == "event":
            event_qs = (
                Event.objects.filter(
                    is_public=True,
                    community__is_active=True,
                    status__in=[EventStatus.SCHEDULED, EventStatus.LIVE],
                )
                .filter(Q(title__icontains=q) | Q(description__icontains=q))
                .select_related("community", "host")
                .order_by("start_time")[:limit]
            )
            results["events"] = list(event_qs)

        # 4. Developers
        # Recherche multi-champs : username, prénom, nom, nom complet concaténé, headline, bio
        if not content_type or content_type == "developer":
            dev_qs = (
                DeveloperProfile.objects.filter(is_public=True, user__is_active=True)
                .annotate(
                    full_name=Concat("user__first_name", Value(" "), "user__last_name"),
                    full_name_reverse=Concat(
                        "user__last_name", Value(" "), "user__first_name"
                    ),
                )
                .filter(
                    Q(user__username__icontains=q)
                    | Q(user__first_name__icontains=q)
                    | Q(user__last_name__icontains=q)
                    | Q(full_name__icontains=q)
                    | Q(full_name_reverse__icontains=q)
                    | Q(headline__icontains=q)
                    | Q(bio__icontains=q)
                )
                .select_related("user")[:limit]
            )
            results["developers"] = list(dev_qs)

        # 5. Posts
        # Les communautés payantes sont privées. Seules les publications des communautés
        # publiques et gratuites sont exposées aux non-membres/anonymes.
        # Les publications des communautés privées/payantes ne sont visibles que par leurs membres actifs ou le propriétaire.
        if not content_type or content_type == "post":
            base_post_q = Q(
                community__is_active=True,
                community__privacy_type=CommunityPrivacy.PUBLIC,
                community__pricing_type=CommunityPricing.FREE,
            )
            if user and user.is_authenticated:
                base_post_q |= Q(
                    community__is_active=True,
                    community__owner=user,
                )
                base_post_q |= Q(
                    community__is_active=True,
                    community__memberships__user=user,
                    community__memberships__status=MembershipStatus.ACTIVE,
                )

            post_qs = (
                Post.objects.filter(base_post_q)
                .filter(Q(title__icontains=q) | Q(content__icontains=q))
                .select_related("community", "author")
                .order_by("-created_at")
                .distinct()[:limit]
            )
            results["posts"] = list(post_qs)

        return results

    @classmethod
    def get_trending(cls, limit: int = 6) -> dict[str, Any]:
        """
        Retrieves trending public communities, popular courses and upcoming live events.
        """
        communities = Community.objects.filter(
            is_active=True,
            privacy_type=CommunityPrivacy.PUBLIC,
        ).order_by("-members_count")[:limit]

        courses = (
            Course.objects.filter(
                is_published=True,
                community__is_active=True,
                community__privacy_type=CommunityPrivacy.PUBLIC,
            )
            .select_related("community")
            .annotate(students_count=Count("enrollments"))
            .order_by("-students_count", "-lessons_count", "-created_at")[:limit]
        )

        now = timezone.now()
        events = (
            Event.objects.filter(
                is_public=True,
                community__is_active=True,
                status=EventStatus.SCHEDULED,
                start_time__gte=now,
            )
            .select_related("community", "host")
            .order_by("start_time")[:limit]
        )

        return {
            "communities": list(communities),
            "courses": list(courses),
            "events": list(events),
        }

    @classmethod
    def get_recommendations(
        cls, user: Optional[User] = None, limit: int = 6
    ) -> dict[str, Any]:
        """
        Recommends communities and courses matched to developer skills
        or falls back to popular items.
        """
        tech_names: list[str] = []
        if user and user.is_authenticated:
            profile = getattr(user, "profile", None)
            if profile:
                tech_names = list(
                    profile.skills.values_list("technology__name", flat=True)
                )

        if tech_names:
            tech_q = Q()
            for name in tech_names[:5]:
                tech_q |= Q(name__icontains=name) | Q(description__icontains=name)

            rec_communities = Community.objects.filter(
                is_active=True,
                privacy_type=CommunityPrivacy.PUBLIC,
            ).filter(tech_q)[:limit]

            rec_course_q = Q()
            for name in tech_names[:5]:
                rec_course_q |= Q(title__icontains=name) | Q(
                    description__icontains=name
                )

            rec_courses = (
                Course.objects.filter(
                    is_published=True,
                    community__is_active=True,
                    community__privacy_type=CommunityPrivacy.PUBLIC,
                )
                .filter(rec_course_q)
                .select_related("community")
                .annotate(students_count=Count("enrollments"))
                .order_by("-students_count", "-lessons_count", "-created_at")[:limit]
            )

            # If matching items found
            if rec_communities.exists() or rec_courses.exists():
                return {
                    "matched_technologies": tech_names,
                    "recommended_communities": list(rec_communities),
                    "recommended_courses": list(rec_courses),
                }

        # Fallback to top items
        trending = cls.get_trending(limit=limit)
        return {
            "matched_technologies": [],
            "recommended_communities": trending["communities"],
            "recommended_courses": trending["courses"],
        }
