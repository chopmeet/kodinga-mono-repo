from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.serializers.user import UserSerializer
from apps.profiles.models.profile import DeveloperProfile
from apps.profiles.serializers.education import DeveloperEducationSerializer
from apps.profiles.serializers.experience import DeveloperExperienceSerializer
from apps.profiles.serializers.portfolio import DeveloperPortfolioProjectSerializer
from apps.profiles.serializers.skill import DeveloperSkillSerializer
from common.serializers.base import BaseModelSerializer


class DeveloperProfileDetailSerializer(BaseModelSerializer):
    """
    Complete detailed developer profile representation with nested relations.
    """
    user = UserSerializer(read_only=True)
    display_name = serializers.CharField(read_only=True)
    completion_percentage = serializers.IntegerField(read_only=True)
    skills = DeveloperSkillSerializer(many=True, read_only=True)
    experiences = DeveloperExperienceSerializer(many=True, read_only=True)
    educations = DeveloperEducationSerializer(many=True, read_only=True)
    portfolio_projects = DeveloperPortfolioProjectSerializer(many=True, read_only=True)

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
            'created_at',
            'updated_at',
        ]


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

