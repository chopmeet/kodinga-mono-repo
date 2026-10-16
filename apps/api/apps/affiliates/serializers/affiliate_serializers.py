from rest_framework import serializers

from apps.affiliates.models.link import AffiliateLink
from apps.affiliates.models.payout import (
    PayoutMethod,
    PayoutRequest,
    PayoutStatus,
)
from apps.affiliates.models.program import AffiliateProgram


class AffiliateProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = AffiliateProgram
        fields = [
            "id",
            "name",
            "commission_rate",
            "cookie_days",
            "community_id",
            "is_active",
            "created_at",
        ]


class AffiliateLinkSerializer(serializers.ModelSerializer):
    program = AffiliateProgramSerializer(read_only=True)
    full_url = serializers.SerializerMethodField()

    class Meta:
        model = AffiliateLink
        fields = [
            "id",
            "code",
            "custom_slug",
            "target_url",
            "full_url",
            "clicks_count",
            "conversions_count",
            "total_earnings",
            "currency",
            "is_active",
            "program",
            "created_at",
        ]

    def get_full_url(self, obj):
        ident = obj.custom_slug or obj.code
        return f"https://kodinga.com/ref/{ident}"


class CreateAffiliateLinkSerializer(serializers.Serializer):
    custom_slug = serializers.CharField(max_length=100, required=False, allow_blank=True)
    target_url = serializers.URLField(required=False, allow_blank=True)
    program_id = serializers.UUIDField(required=False, allow_null=True)


class PayoutRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayoutRequest
        fields = [
            "id",
            "amount",
            "currency",
            "payout_method",
            "payout_details",
            "status",
            "processed_at",
            "notes",
            "created_at",
        ]


class CreatePayoutRequestSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=True)
    payout_method = serializers.ChoiceField(choices=PayoutMethod.choices, default=PayoutMethod.WAVE)
    payout_details = serializers.DictField(required=True)


class AffiliateStatsSerializer(serializers.Serializer):
    total_links = serializers.IntegerField()
    total_clicks = serializers.IntegerField()
    total_conversions = serializers.IntegerField()
    conversion_rate_percentage = serializers.FloatField()
    total_earnings = serializers.CharField()
    available_balance = serializers.CharField()
    pending_amount = serializers.CharField()
    paid_amount = serializers.CharField()
    currency = serializers.CharField()
