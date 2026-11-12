from decimal import Decimal

from rest_framework import serializers

from apps.billing.models.payment import Payment
from apps.billing.models.subscription import Subscription
from apps.billing.models.wallet import CommunityPayout
from common.serializers.base import BaseModelSerializer


class CommunityMemberUserSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    def get_full_name(self, obj) -> str:
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username

    def get_avatar_url(self, obj) -> str | None:
        profile = getattr(obj, 'profile', None)
        if profile and getattr(profile, 'avatar', None):
            return profile.avatar.url if hasattr(profile.avatar, 'url') else str(profile.avatar)
        return None


class CommunitySubscriberPlanSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    currency = serializers.CharField(read_only=True)
    billing_interval = serializers.CharField(read_only=True)


class CommunitySubscriberSerializer(BaseModelSerializer):
    user = CommunityMemberUserSerializer(read_only=True)
    plan = CommunitySubscriberPlanSerializer(read_only=True)
    is_active = serializers.BooleanField(source='is_currently_valid', read_only=True)

    class Meta:
        model = Subscription
        fields = [
            'id',
            'user',
            'plan',
            'status',
            'is_active',
            'current_period_start',
            'current_period_end',
            'cancel_at_period_end',
            'canceled_at',
            'created_at',
        ]
        read_only_fields = fields


class CommunityTransactionSerializer(BaseModelSerializer):
    user = CommunityMemberUserSerializer(read_only=True)
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    plan_interval = serializers.CharField(source='plan.billing_interval', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id',
            'user',
            'plan_name',
            'plan_interval',
            'amount',
            'platform_fee',
            'net_amount',
            'currency',
            'status',
            'provider',
            'provider_reference',
            'paid_at',
            'created_at',
        ]
        read_only_fields = fields


class MonthlyRevenuePointSerializer(serializers.Serializer):
    month = serializers.CharField(help_text="Format YYYY-MM")
    gross = serializers.DecimalField(max_digits=14, decimal_places=2)
    fees = serializers.DecimalField(max_digits=14, decimal_places=2)
    net = serializers.DecimalField(max_digits=14, decimal_places=2)
    payments_count = serializers.IntegerField()


class CommunityRevenueOverviewSerializer(serializers.Serializer):
    total_gross = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_platform_fees = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_net = serializers.DecimalField(max_digits=14, decimal_places=2)
    available_balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    withdrawn_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    currency = serializers.CharField()
    active_subscribers_count = serializers.IntegerField()
    monthly_revenue = MonthlyRevenuePointSerializer(many=True)


class CommunityPayoutSerializer(BaseModelSerializer):
    community_id = serializers.UUIDField(source="community.id", read_only=True)
    community_name = serializers.CharField(source="community.name", read_only=True)
    community_slug = serializers.CharField(source="community.slug", read_only=True)
    requested_by_username = serializers.CharField(
        source="requested_by.username", read_only=True
    )
    requested_by_email = serializers.CharField(
        source="requested_by.email", read_only=True
    )
    processed_by_username = serializers.CharField(
        source="processed_by.username", read_only=True, default=None
    )

    class Meta:
        model = CommunityPayout
        fields = [
            "id",
            "community_id",
            "community_name",
            "community_slug",
            "requested_by_username",
            "requested_by_email",
            "amount",
            "fee_amount",
            "net_amount",
            "currency",
            "status",
            "payment_method",
            "account_identifier",
            "account_name",
            "reference",
            "processed_at",
            "processed_by_username",
            "rejection_reason",
            "admin_note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "community_id",
            "community_name",
            "community_slug",
            "requested_by_username",
            "requested_by_email",
            "fee_amount",
            "net_amount",
            "status",
            "reference",
            "processed_at",
            "processed_by_username",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]


class CreateCommunityPayoutRequestSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("1000.00")
    )
    payment_method = serializers.ChoiceField(
        choices=["wave", "orange_money", "paydunya", "bank_transfer"], default="wave"
    )
    account_identifier = serializers.CharField(max_length=100)
    account_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )


class AdminRejectPayoutSerializer(serializers.Serializer):
    reason = serializers.CharField(
        max_length=1000,
        required=True,
        allow_blank=False,
        help_text="Motif obligatoire justifiant le rejet de la demande de reversement",
    )
    admin_note = serializers.CharField(
        max_length=1000, required=False, allow_blank=True, default=""
    )


class AdminDisbursePayoutSerializer(serializers.Serializer):
    admin_note = serializers.CharField(
        max_length=1000, required=False, allow_blank=True, default=""
    )
