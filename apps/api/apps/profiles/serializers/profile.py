import logging

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.serializers.user import UserSerializer
from apps.profiles.models.profile import DeveloperProfile
from apps.profiles.serializers.education import DeveloperEducationSerializer
from apps.profiles.serializers.experience import DeveloperExperienceSerializer
from apps.profiles.serializers.portfolio import DeveloperPortfolioProjectSerializer
from apps.profiles.serializers.skill import DeveloperSkillSerializer
from common.serializers.base import BaseModelSerializer

logger = logging.getLogger(__name__)


class DeveloperProfileDetailSerializer(BaseModelSerializer):
    """
    Complete detailed developer profile representation with nested relations,
    including public communities and member contributions.
    """
    user = UserSerializer(read_only=True)
    display_name = serializers.CharField(read_only=True)
    completion_percentage = serializers.IntegerField(read_only=True)
    skills = DeveloperSkillSerializer(many=True, read_only=True)
    experiences = DeveloperExperienceSerializer(many=True, read_only=True)
    educations = DeveloperEducationSerializer(many=True, read_only=True)
    portfolio_projects = DeveloperPortfolioProjectSerializer(many=True, read_only=True)
    communities = serializers.SerializerMethodField()
    contributions = serializers.SerializerMethodField()

    class Meta:
        model = DeveloperProfile
        fields = [
            'id',
            'user',
            'display_name',
            'headline',
            'bio',
            'avatar_url',
            'banner_url',
            'location',
            'country_code',
            'preferred_language',
            'website_url',
            'github_username',
            'gitlab_username',
            'linkedin_url',
            'twitter_handle',
            'youtube_url',
            'discord_handle',
            'custom_links',
            'years_of_experience',
            'availability_status',
            'hourly_rate',
            'currency',
            'is_public',
            'is_mentor',
            'open_to_freelance',
            'open_to_relocation',
            'open_to_remote',
            'views_count',
            'reputation_points',
            'completion_percentage',
            'skills',
            'experiences',
            'educations',
            'portfolio_projects',
            'communities',
            'contributions',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'display_name',
            'views_count',
            'reputation_points',
            'completion_percentage',
            'communities',
            'contributions',
            'created_at',
            'updated_at',
        ]

    def get_communities(self, obj) -> list[dict]:
        from apps.communities.models.community import CommunityPrivacy
        from apps.memberships.models.member import CommunityMember, MembershipStatus

        memberships = CommunityMember.objects.filter(
            user=obj.user,
            status=MembershipStatus.ACTIVE,
            community__privacy_type=CommunityPrivacy.PUBLIC
        ).select_related('community')
        return [
            {
                'id': str(m.community.id),
                'name': m.community.name,
                'slug': m.community.slug,
                'avatar_url': m.community.avatar_url,
                'role': m.role,
                'members_count': m.community.members_count,
            }
            for m in memberships
        ]

    def get_contributions(self, obj) -> dict:
        from apps.posts.models.post import Post
        from apps.projects.models.project import Project, ProjectStatus

        posts_count = Post.objects.filter(author=obj.user).count()
        projects_count = Project.objects.filter(owner=obj.user, status=ProjectStatus.PUBLISHED).count()

        badges_count = 0
        badges_list = []
        try:
            from apps.gamification.models.badge import UserBadge
            ub_qs = UserBadge.objects.filter(user=obj.user).select_related('badge')
            badges_count = ub_qs.count()
            badges_list = [
                {
                    'id': str(ub.badge.id),
                    'name': ub.badge.name,
                    'slug': getattr(ub.badge, 'slug', ''),
                    'description': getattr(ub.badge, 'description', ''),
                    'icon_url': getattr(ub.badge, 'icon_url', ''),
                    'awarded_at': ub.awarded_at,
                    'earned_at': ub.awarded_at,
                }
                for ub in ub_qs[:5]
            ]
        except Exception as exc:
            logger.warning(f'Error fetching user badges in profile contributions: {exc}')

        recent_posts = list(
            Post.objects.filter(author=obj.user, community__privacy_type='public')
            .order_by('-created_at')[:3]
            .values(
                'id',
                'title',
                'post_type',
                'created_at',
                'reactions_count',
                'comments_count',
                'community__slug',
                'community__name',
            )
        )
        for p in recent_posts:
            p['id'] = str(p['id'])
            community_slug = p.pop('community__slug', '')
            community_name = p.pop('community__name', '')
            p['community_slug'] = community_slug
            p['community_name'] = community_name
            p['community'] = {
                'slug': community_slug,
                'name': community_name,
            }

        recent_projects = list(
            Project.objects.filter(owner=obj.user, status=ProjectStatus.PUBLISHED)
            .order_by('-created_at')[:3]
            .values('id', 'title', 'slug', 'cover_image_url', 'upvotes_count', 'is_featured')
        )
        for p in recent_projects:
            p['id'] = str(p['id'])

        return {
            'posts_count': posts_count,
            'projects_count': projects_count,
            'badges_count': badges_count,
            'reputation_points': obj.reputation_points,
            'recent_posts': recent_posts,
            'recent_projects': recent_projects,
            'badges': badges_list,
        }


class DeveloperProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating developer profile fields.
    """
    class Meta:
        model = DeveloperProfile
        fields = [
            'headline',
            'bio',
            'avatar_url',
            'banner_url',
            'location',
            'country_code',
            'preferred_language',
            'website_url',
            'github_username',
            'gitlab_username',
            'linkedin_url',
            'twitter_handle',
            'youtube_url',
            'discord_handle',
            'custom_links',
            'years_of_experience',
            'availability_status',
            'hourly_rate',
            'currency',
            'is_public',
            'is_mentor',
            'open_to_freelance',
            'open_to_relocation',
            'open_to_remote',
        ]

    def validate_custom_links(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("custom_links doit être une liste d'objets avec title et url.")
        for item in value:
            if not isinstance(item, dict) or 'title' not in item or 'url' not in item:
                raise serializers.ValidationError("Chaque élément de custom_links doit contenir 'title' et 'url'.")
        return value


class PublicProfileSummarySerializer(BaseModelSerializer):
    """
    Lightweight summary for developer search and community directory.
    """
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    top_skills = serializers.SerializerMethodField()

    class Meta:
        model = DeveloperProfile
        fields = [
            'id',
            'username',
            'full_name',
            'headline',
            'avatar_url',
            'location',
            'years_of_experience',
            'availability_status',
            'hourly_rate',
            'currency',
            'is_mentor',
            'reputation_points',
            'top_skills',
            'created_at',
        ]

    @extend_schema_field(serializers.ListSerializer(child=serializers.DictField()))
    def get_top_skills(self, obj):
        highlighted = obj.skills.filter(is_highlighted=True)[:5]
        if not highlighted.exists():
            highlighted = obj.skills.all()[:5]
        return [
            {
                'name': s.technology.name,
                'slug': s.technology.slug,
                'level': s.level,
                'icon_url': s.technology.icon_url
            }
            for s in highlighted
        ]
