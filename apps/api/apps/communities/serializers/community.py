from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.accounts.serializers.user import UserSerializer
from apps.communities.models.community import Community, CommunityPrivacy, CommunityPricing
from apps.communities.serializers.category import CommunityCategorySerializer
from apps.communities.serializers.rule import CommunityRuleSerializer
from apps.communities.serializers.settings import CommunitySettingsSerializer
from apps.memberships.models.member import CommunityMember, MembershipStatus


class CommunityListSerializer(BaseModelSerializer):
    """
    Lightweight serializer for discovery, public explore directory and sidebars.
    """
    category = CommunityCategorySerializer(read_only=True)
    owner = UserSerializer(read_only=True)

    class Meta:
        model = Community
        fields = [
            'id',
            'name',
            'slug',
            'tagline',
            'avatar_url',
            'banner_url',
            'brand_color',
            'category',
            'owner',
            'privacy_type',
            'pricing_type',
            'is_verified',
            'is_featured',
            'members_count',
            'posts_count',
            'courses_count',
            'events_count',
            'created_at',
        ]
        read_only_fields = fields


class CommunityDetailSerializer(BaseModelSerializer):
    """
    Detailed serializer with rules, settings and context-aware membership status.
    """
    category = CommunityCategorySerializer(read_only=True)
    owner = UserSerializer(read_only=True)
    settings = CommunitySettingsSerializer(read_only=True)
    rules = CommunityRuleSerializer(many=True, read_only=True)
    user_membership = serializers.SerializerMethodField()

    class Meta:
        model = Community
        fields = [
            'id',
            'name',
            'slug',
            'tagline',
            'description',
            'avatar_url',
            'banner_url',
            'brand_color',
            'website_url',
            'github_url',
            'discord_url',
            'twitter_url',
            'category',
            'owner',
            'privacy_type',
            'pricing_type',
            'is_verified',
            'is_featured',
            'members_count',
            'posts_count',
            'courses_count',
            'events_count',
            'settings',
            'rules',
            'user_membership',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'owner',
            'members_count',
            'posts_count',
            'courses_count',
            'events_count',
            'user_membership',
            'created_at',
            'updated_at',
        ]

    def get_user_membership(self, obj) -> dict:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return {'is_member': False, 'role': None, 'status': None}

        membership = CommunityMember.objects.filter(
            community=obj,
            user=request.user
        ).first()

        if not membership:
            return {'is_member': False, 'role': None, 'status': None}

        return {
            'is_member': membership.status == MembershipStatus.ACTIVE,
            'role': membership.role,
            'status': membership.status,
            'custom_title': membership.custom_title,
            'points': membership.reputation_score,
            'joined_at': membership.joined_at,
        }


class CommunityCreateUpdateSerializer(serializers.ModelSerializer):
    category_id = serializers.UUIDField(required=False, allow_null=True)
    rules = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        write_only=True
    )
    settings = serializers.DictField(required=False, write_only=True)

    class Meta:
        model = Community
        fields = [
            'name',
            'slug',
            'tagline',
            'description',
            'category_id',
            'privacy_type',
            'pricing_type',
            'avatar_url',
            'banner_url',
            'brand_color',
            'website_url',
            'github_url',
            'discord_url',
            'twitter_url',
            'rules',
            'settings',
        ]
