from rest_framework import serializers

from apps.billing.models.payment import Payment
from apps.billing.serializers.plan import PlanSerializer
from common.serializers.base import BaseModelSerializer


class CreateCheckoutRequestSerializer(serializers.Serializer):
    """
    Request body for initiating a PayDunya checkout session.
    Never accepts client-controlled price or currency.
    """
    plan_id = serializers.UUIDField(required=True, help_text="ID du plan de souscription sélectionné")
    referral_code = serializers.CharField(required=False, allow_blank=True, max_length=50)
    return_url = serializers.URLField(required=False, allow_blank=True)
    cancel_url = serializers.URLField(required=False, allow_blank=True)


class CheckoutResponseSerializer(serializers.Serializer):
    payment_id = serializers.UUIDField()
    token = serializers.CharField()
    checkout_url = serializers.URLField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField()
    plan_name = serializers.CharField()


class PaymentDetailSerializer(BaseModelSerializer):
    plan = PlanSerializer(read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id',
            'user_id',
            'plan',
            'amount',
            'currency',
            'status',
            'provider',
            'provider_reference',
            'checkout_url',
            'paid_at',
            'created_at',
        ]
        read_only_fields = fields


class PaymentStatusSerializer(serializers.Serializer):
    payment_id = serializers.UUIDField(source='id')
    status = serializers.CharField()
    is_paid = serializers.SerializerMethodField()
    receipt_url = serializers.CharField(source='provider_reference', allow_blank=True)
    paid_at = serializers.DateTimeField(allow_null=True)

    def get_is_paid(self, obj) -> bool:
        return obj.status == 'PAID'
