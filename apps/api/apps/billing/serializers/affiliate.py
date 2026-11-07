from rest_framework import serializers

from apps.billing.models.affiliate import Affiliate, AffiliateCommission
from common.serializers.base import BaseModelSerializer


class AffiliateCommissionSerializer(BaseModelSerializer):
    referred_username = serializers.CharField(source='referred_user.username', read_only=True)

    class Meta:
        model = AffiliateCommission
        fields = [
            'id',
            'referred_username',
            'amount',
            'currency',
            'status',
            'created_at',
        ]
        read_only_fields = fields


class AffiliateSerializer(BaseModelSerializer):
    commissions = AffiliateCommissionSerializer(many=True, read_only=True)
    referral_link = serializers.SerializerMethodField()

    class Meta:
        model = Affiliate
        fields = [
            'id',
            'referral_code',
            'referral_link',
            'commission_rate',
            'total_earnings',
            'balance',
            'is_active',
            'commissions',
            'created_at',
        ]
        read_only_fields = fields

    def get_referral_link(self, obj) -> str:
        from django.conf import settings

        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://kodinga.me').rstrip('/')
        return f"{frontend_url}/register?ref={obj.referral_code}"
