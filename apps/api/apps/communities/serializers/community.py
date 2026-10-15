from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.accounts.serializers.user import UserSerializer
from apps.communities.models.community import Community, CommunityPrivacy, CommunityPricing
from apps.communities.models.rule import CommunityRule
from apps.communities.models.settings import CommunitySettings
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
    is_member = serializers.SerializerMethodField()

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
            'is_member',
            'created_at',
        ]
        read_only_fields = fields

    def get_is_member(self, obj) -> bool:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if obj.owner_id == request.user.id:
            return True
        user_memberships = self.context.get('user_memberships')
        if user_memberships is not None:
            return obj.id in user_memberships
        return CommunityMember.objects.filter(
            community=obj,
            user=request.user,
            status=MembershipStatus.ACTIVE
        ).exists()


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
            'whatsapp_url',
            'telegram_url',
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


class CommunityRuleInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunityRule
        fields = ['title', 'description', 'order']
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'order': {'required': False},
        }


class CommunitySettingsInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunitySettings
        fields = [
            'allow_member_invites',
            'require_approval_to_join',
            'welcome_message',
            'default_post_permission',
            'enabled_features',
        ]
        extra_kwargs = {
            'allow_member_invites': {'required': False},
            'require_approval_to_join': {'required': False},
            'welcome_message': {'required': False, 'allow_blank': True},
            'default_post_permission': {'required': False},
            'enabled_features': {'required': False},
        }


class CommunityCreateUpdateSerializer(serializers.ModelSerializer):
    category_id = serializers.UUIDField(required=False, allow_null=True)
    avatar_url = serializers.URLField(
        required=False, allow_blank=True, allow_null=True
    )
    banner_url = serializers.URLField(
        required=False, allow_blank=True, allow_null=True
    )
    website_url = serializers.URLField(
        required=False, allow_blank=True, allow_null=True
    )
    github_url = serializers.URLField(
        required=False, allow_blank=True, allow_null=True
    )
    discord_url = serializers.URLField(
        required=False, allow_blank=True, allow_null=True
    )
    twitter_url = serializers.URLField(
        required=False, allow_blank=True, allow_null=True
    )
    whatsapp_url = serializers.URLField(
        required=False, allow_blank=True, allow_null=True
    )
    telegram_url = serializers.URLField(
        required=False, allow_blank=True, allow_null=True
    )
    tagline = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    brand_color = serializers.CharField(required=False, allow_blank=True)
    rules = CommunityRuleInputSerializer(many=True, required=False, write_only=True)
    settings = CommunitySettingsInputSerializer(required=False, write_only=True)

    # Optional initial membership plan for paid communities
    membership_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, write_only=True
    )
    membership_interval = serializers.ChoiceField(
        choices=['month', 'one_time', 'year'], default='month', required=False, write_only=True
    )
    membership_plan_name = serializers.CharField(
        max_length=120, required=False, allow_blank=True, write_only=True
    )

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
            'whatsapp_url',
            'telegram_url',
            'rules',
            'settings',
            'membership_price',
            'membership_interval',
            'membership_plan_name',
        ]

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        # 1. Check platform setting: is community creation open to Hobby or restricted to Pro only?
        if not self.instance and user and user.is_authenticated:
            from apps.administration.services.admin_service import AdministrationService
            raw_setting = AdministrationService.get_setting('community_creation_allowed_for', 'all')
            tier = raw_setting.get('tier') if isinstance(raw_setting, dict) else str(raw_setting).lower()
            if tier == 'pro_only' and not user.is_pro:
                raise serializers.ValidationError(
                    "La création de communauté est actuellement réservée aux abonnés Pro (5 000 FCFA/mois). Veuillez passer au forfait Pro pour créer un espace."
                )

        # 2. Check monetization: Only Pro users can create or configure paid communities
        pricing_type = attrs.get('pricing_type', getattr(self.instance, 'pricing_type', CommunityPricing.FREE))
        if pricing_type == CommunityPricing.PAID:
            if user and user.is_authenticated and not user.is_pro:
                raise serializers.ValidationError({
                    'pricing_type': "Seuls les utilisateurs avec un abonnement Pro actif (5 000 FCFA/mois) peuvent créer ou configurer une communauté payante."
                })
            price = attrs.get('membership_price')
            if price is not None and price < 500:
                raise serializers.ValidationError({
                    'membership_price': "Le montant d'adhésion minimum pour une communauté payante est de 500 FCFA."
                })

        url_fields = [
            'avatar_url',
            'banner_url',
            'website_url',
            'github_url',
            'discord_url',
            'twitter_url',
            'whatsapp_url',
            'telegram_url',
        ]
        for field in url_fields:
            if field in attrs:
                val = attrs[field]
                if val is None or (isinstance(val, str) and not val.strip()):
                    attrs[field] = ""
                elif isinstance(val, str):
                    attrs[field] = val.strip()
        return super().validate(attrs)


