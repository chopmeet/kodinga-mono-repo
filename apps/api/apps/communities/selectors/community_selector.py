import uuid
from typing import Optional
from django.db.models import Prefetch, Q, QuerySet
from apps.accounts.models.user import User
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import Community, CommunityPrivacy
from apps.communities.models.rule import CommunityRule
from apps.memberships.models.member import CommunityMember, MembershipStatus


def is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


class CommunitySelector:
    """
    Optimized database queries and prefetch pipelines for communities and spaces.
    Supports resolution by both slug and UUID ID across all methods.
    """

    @classmethod
    def get_base_queryset(cls) -> QuerySet[Community]:
        return Community.objects.filter(is_active=True).select_related(
            'owner', 'category', 'settings'
        )

    @classmethod
    def get_community_by_slug(
        cls, identifier: str, user: Optional[User] = None
    ) -> Community:
        rules_prefetch = Prefetch(
            'rules', queryset=CommunityRule.objects.order_by('order')
        )
        qs = cls.get_base_queryset().prefetch_related(rules_prefetch)

        if is_valid_uuid(identifier):
            community = qs.get(Q(id=identifier) | Q(slug__iexact=identifier))
        else:
            community = qs.get(slug__iexact=identifier)

        # If secret community, ensure user is active member, owner, or superuser
        if community.privacy_type == CommunityPrivacy.SECRET:
            if not user or not user.is_authenticated:
                raise Community.DoesNotExist("Communauté introuvable.")
            if not user.is_superuser and community.owner_id != user.id:
                if not CommunityMember.objects.filter(
                    community=community, user=user, status=MembershipStatus.ACTIVE
                ).exists():
                    raise Community.DoesNotExist("Communauté introuvable.")

        return community

    @classmethod
    def search_communities(
        cls,
        search_query: str = None,
        category_slug: str = None,
        privacy: str = None,
        pricing: str = None,
        is_featured: bool = None,
        user: Optional[User] = None,
    ) -> QuerySet[Community]:
        # By default, hide secret communities from discovery
        qs = cls.get_base_queryset().exclude(privacy_type=CommunityPrivacy.SECRET)

        if search_query:
            qs = qs.filter(
                Q(name__icontains=search_query)
                | Q(tagline__icontains=search_query)
                | Q(description__icontains=search_query)
                | Q(slug__icontains=search_query)
            )

        if category_slug:
            if is_valid_uuid(category_slug):
                qs = qs.filter(
                    Q(category_id=category_slug) | Q(category__slug=category_slug)
                )
            else:
                qs = qs.filter(category__slug=category_slug)

        if privacy:
            qs = qs.filter(privacy_type=privacy)

        if pricing:
            qs = qs.filter(pricing_type=pricing)

        if is_featured is not None:
            qs = qs.filter(is_featured=is_featured)

        return qs.order_by('-is_featured', '-members_count', '-created_at')

    @classmethod
    def get_user_communities(cls, user: User) -> QuerySet[Community]:
        """
        Retrieves all communities where the user is an active member or owner.
        """
        if not user.is_authenticated:
            return Community.objects.none()

        member_community_ids = CommunityMember.objects.filter(
            user=user, status=MembershipStatus.ACTIVE
        ).values_list('community_id', flat=True)

        return (
            cls.get_base_queryset()
            .filter(id__in=member_community_ids)
            .order_by('-created_at')
        )

    @classmethod
    def get_categories(
        cls, include_inactive: bool = False
    ) -> QuerySet[CommunityCategory]:
        qs = CommunityCategory.objects.all()
        if not include_inactive:
            qs = qs.filter(is_active=True)
        return qs.order_by('order', 'name')

    @classmethod
    def get_category_by_slug(cls, identifier: str) -> CommunityCategory:
        if is_valid_uuid(identifier):
            return CommunityCategory.objects.get(
                Q(id=identifier) | Q(slug__iexact=identifier)
            )
        return CommunityCategory.objects.get(slug__iexact=identifier)


