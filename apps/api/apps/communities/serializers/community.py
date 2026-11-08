from rest_framework import serializers

from apps.accounts.serializers.user import UserSerializer
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.communities.models.rule import CommunityRule
from apps.communities.models.settings import CommunitySettings
from apps.communities.serializers.category import CommunityCategorySerializer
from apps.communities.serializers.rule import CommunityRuleSerializer
from apps.communities.serializers.settings import CommunitySettingsSerializer
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from common.permissions.base import is_superadmin_user
from common.serializers.base import BaseModelSerializer


class CommunityListSerializer(BaseModelSerializer):
    """
    Lightweight serializer for discovery, public explore directory and sidebars.
    """

    category = CommunityCategorySerializer(read_only=True)
    owner = UserSerializer(read_only=True)
    is_member = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    user_membership_status = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    active_live = serializers.SerializerMethodField()

    class Meta:
        model = Community
        fields = [
            "id",
            "name",
            "slug",
            "tagline",
            "avatar_url",
            "banner_url",
            "brand_color",
            "category",
            "owner",
            "privacy_type",
            "pricing_type",
            "is_verified",
            "is_featured",
            "members_count",
            "posts_count",
            "courses_count",
            "events_count",
            "is_member",
            "user_role",
            "user_membership_status",
            "can_manage",
            "active_live",
            "created_at",
        ]
        read_only_fields = fields

    def _get_membership_obj(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        memberships_map = self.context.get("user_memberships_map")
        if memberships_map is not None:
            return memberships_map.get(obj.id)
        return (
            CommunityMember.objects.filter(
                community=obj,
                user=request.user,
            )
            .only("role", "status")
            .first()
        )

    def get_active_live(self, obj):
        from apps.events.models.event import EventStatus

        live = (
            obj.events.filter(status=EventStatus.LIVE)
            .only("id", "title", "slug", "is_public", "attendees_count")
            .first()
        )
        if not live:
            return None
        return {
            "id": str(live.id),
            "title": live.title,
            "slug": live.slug,
            "is_public": live.is_public,
            "attendees_count": live.attendees_count,
        }

    def get_is_member(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        if obj.owner_id == request.user.id or is_superadmin_user(request.user):
            return True
        user_memberships = self.context.get("user_memberships")
        if user_memberships is not None:
            return obj.id in user_memberships
        m = self._get_membership_obj(obj)
        return bool(m and m.status == MembershipStatus.ACTIVE)

    def get_user_role(self, obj) -> str | None:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if obj.owner_id == request.user.id or is_superadmin_user(request.user):
            return CommunityRole.OWNER
        m = self._get_membership_obj(obj)
        if m and m.status == MembershipStatus.ACTIVE:
            return m.role
        return None

    def get_user_membership_status(self, obj) -> str | None:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if obj.owner_id == request.user.id or is_superadmin_user(request.user):
            return MembershipStatus.ACTIVE
        m = self._get_membership_obj(obj)
        return m.status if m else None

    def get_can_manage(self, obj) -> bool:
        role = self.get_user_role(obj)
        return role in (
            CommunityRole.OWNER,
            CommunityRole.ADMIN,
            CommunityRole.MODERATOR,
        )


class CommunityDetailSerializer(BaseModelSerializer):
    """
    Detailed serializer with rules, settings and context-aware membership status.
    """

    category = CommunityCategorySerializer(read_only=True)
    owner = UserSerializer(read_only=True)
    settings = CommunitySettingsSerializer(read_only=True)
    rules = CommunityRuleSerializer(many=True, read_only=True)
    subscription_plans = serializers.SerializerMethodField()
    user_membership = serializers.SerializerMethodField()
    notifications_enabled = serializers.SerializerMethodField()
    active_live = serializers.SerializerMethodField()

    class Meta:
        model = Community
        fields = [
            "id",
            "name",
            "slug",
            "tagline",
            "description",
            "avatar_url",
            "banner_url",
            "brand_color",
            "website_url",
            "github_url",
            "discord_url",
            "twitter_url",
            "whatsapp_url",
            "telegram_url",
            "category",
            "owner",
            "privacy_type",
            "pricing_type",
            "is_verified",
            "is_featured",
            "members_count",
            "posts_count",
            "courses_count",
            "events_count",
            "settings",
            "rules",
            "user_membership",
            "notifications_enabled",
            "subscription_plans",
            "active_live",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "owner",
            "members_count",
            "posts_count",
            "courses_count",
            "events_count",
            "user_membership",
            "notifications_enabled",
            "subscription_plans",
            "active_live",
            "created_at",
            "updated_at",
        ]

    def get_active_live(self, obj):
        from apps.events.models.event import EventStatus

        live = (
            obj.events.filter(status=EventStatus.LIVE)
            .only("id", "title", "slug", "is_public", "attendees_count")
            .first()
        )
        if not live:
            return None
        return {
            "id": str(live.id),
            "title": live.title,
            "slug": live.slug,
            "is_public": live.is_public,
            "attendees_count": live.attendees_count,
        }

    def get_subscription_plans(self, obj) -> list[dict]:
        from apps.billing.serializers.plan import PlanSerializer

        plans = obj.subscription_plans.filter(is_active=True).order_by("order", "price")
        return PlanSerializer(plans, many=True, context=self.context).data

    def get_user_membership(self, obj) -> dict:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return {
                "is_member": False,
                "role": None,
                "status": None,
                "is_owner": False,
                "is_admin": False,
                "is_moderator": False,
                "can_manage": False,
                "permissions": [],
            }

        is_owner = obj.owner_id == request.user.id or is_superadmin_user(request.user)
        membership = CommunityMember.objects.filter(
            community=obj, user=request.user
        ).first()

        if not membership and not is_owner:
            return {
                "is_member": False,
                "role": None,
                "status": None,
                "is_owner": False,
                "is_admin": False,
                "is_moderator": False,
                "can_manage": False,
                "permissions": [],
            }

        settings = getattr(obj, "settings", None)
        if not settings:
            from apps.communities.models.settings import CommunitySettings

            settings, _ = CommunitySettings.objects.get_or_create(community=obj)

        effective_role = CommunityRole.OWNER if is_owner else membership.role
        effective_status = MembershipStatus.ACTIVE if is_owner else membership.status
        is_active = effective_status == MembershipStatus.ACTIVE

        if is_owner:
            can_start_live = True
            active_permissions = list(settings.get_role_permissions("owner").keys())
        elif is_active:
            from apps.memberships.permissions import has_community_permission

            can_start_live = has_community_permission(
                request.user, obj, "can_start_live"
            )
            role_perms = settings.get_role_permissions(effective_role)
            user_overrides = (
                (settings.role_permissions or {})
                .get("user_overrides", {})
                .get(str(request.user.id), {})
            )
            combined = dict(role_perms)
            combined.update(user_overrides)
            active_permissions = [k for k, v in combined.items() if v]
        else:
            can_start_live = False
            active_permissions = []

        is_admin = is_owner or (
            is_active and effective_role in (CommunityRole.OWNER, CommunityRole.ADMIN)
        )
        is_moderator = is_admin or (
            is_active and effective_role == CommunityRole.MODERATOR
        )

        return {
            "is_member": is_active,
            "role": effective_role,
            "status": effective_status,
            "is_owner": bool(is_owner),
            "is_admin": bool(is_admin),
            "is_moderator": bool(is_moderator),
            "can_manage": bool(is_moderator),
            "custom_title": membership.custom_title if membership else "",
            "points": membership.reputation_score if membership else 0,
            "joined_at": membership.joined_at if membership else obj.created_at,
            "can_start_live": can_start_live,
            "permissions": active_permissions,
            "notifications_enabled": membership.notifications_enabled
            if membership
            else True,
        }

    def get_notifications_enabled(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        membership = CommunityMember.objects.filter(
            community=obj,
            user=request.user,
        ).first()
        return bool(membership.notifications_enabled) if membership else False


class CommunityRuleInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunityRule
        fields = ["title", "description", "order"]
        extra_kwargs = {
            "description": {"required": False, "allow_blank": True},
            "order": {"required": False},
        }


class CommunitySettingsInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunitySettings
        fields = [
            "allow_member_invites",
            "require_approval_to_join",
            "welcome_message",
            "default_post_permission",
            "enabled_features",
        ]
        extra_kwargs = {
            "allow_member_invites": {"required": False},
            "require_approval_to_join": {"required": False},
            "welcome_message": {"required": False, "allow_blank": True},
            "default_post_permission": {"required": False},
            "enabled_features": {"required": False},
        }


class CommunityCreateUpdateSerializer(serializers.ModelSerializer):
    category_id = serializers.UUIDField(required=False, allow_null=True)
    avatar_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    banner_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    website_url = serializers.URLField(
        required=False, allow_blank=True, allow_null=True
    )
    github_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
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
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
        write_only=True,
    )
    membership_interval = serializers.ChoiceField(
        choices=["month", "one_time", "year"],
        default="month",
        required=False,
        write_only=True,
    )
    membership_plan_name = serializers.CharField(
        max_length=120, required=False, allow_blank=True, write_only=True
    )

    class Meta:
        model = Community
        fields = [
            "name",
            "slug",
            "tagline",
            "description",
            "category_id",
            "privacy_type",
            "pricing_type",
            "avatar_url",
            "banner_url",
            "brand_color",
            "website_url",
            "github_url",
            "discord_url",
            "twitter_url",
            "whatsapp_url",
            "telegram_url",
            "rules",
            "settings",
            "membership_price",
            "membership_interval",
            "membership_plan_name",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        from apps.billing.services.billing_service import BillingService

        # 1. Check platform setting: is community creation open to Hobby or restricted to Pro only?
        if not self.instance and user and user.is_authenticated:
            from apps.administration.services.admin_service import AdministrationService

            raw_setting = AdministrationService.get_setting(
                "community_creation_allowed_for", "all"
            )
            tier = (
                raw_setting.get("tier")
                if isinstance(raw_setting, dict)
                else str(raw_setting).lower()
            )
            if tier == "pro_only" and not user.is_pro:
                raise serializers.ValidationError(
                    f"La création de communauté est actuellement réservée aux abonnés Pro ({BillingService.get_pro_monthly_price_label()}). Veuillez passer au forfait Pro pour créer un espace."
                )

        # 2. Check monetization: Only Pro users can create or configure paid communities
        pricing_type = attrs.get(
            "pricing_type",
            getattr(self.instance, "pricing_type", CommunityPricing.FREE),
        )
        if pricing_type == CommunityPricing.PAID:
            if user and user.is_authenticated and not user.is_pro:
                raise serializers.ValidationError(
                    {
                        "pricing_type": f"Seuls les utilisateurs avec un abonnement Pro actif ({BillingService.get_pro_monthly_price_label()}) peuvent créer ou configurer une communauté payante."
                    }
                )
            # Règle métier : une communauté payante est obligatoirement privée
            attrs["privacy_type"] = CommunityPrivacy.PRIVATE
            price = attrs.get("membership_price")
            if price is not None and price < 500:
                raise serializers.ValidationError(
                    {
                        "membership_price": "Le montant d'adhésion minimum pour une communauté payante est de 500 FCFA."
                    }
                )

        url_fields = [
            "avatar_url",
            "banner_url",
            "website_url",
            "github_url",
            "discord_url",
            "twitter_url",
            "whatsapp_url",
            "telegram_url",
        ]
        for field in url_fields:
            if field in attrs:
                val = attrs[field]
                if val is None or (isinstance(val, str) and not val.strip()):
                    attrs[field] = ""
                elif isinstance(val, str):
                    attrs[field] = val.strip()
        return super().validate(attrs)
