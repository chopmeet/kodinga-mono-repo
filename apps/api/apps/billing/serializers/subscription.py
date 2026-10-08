from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.billing.models.subscription import Subscription
from apps.billing.serializers.plan import PlanSerializer


class SubscriptionSerializer(BaseModelSerializer):
    plan = PlanSerializer(read_only=True)
    is_active = serializers.BooleanField(source='is_currently_valid', read_only=True)

    class Meta:
        model = Subscription
        fields = [
            'id',
            'user_id',
            'plan',
            'community_id',
            'status',
            'is_active',
            'current_period_start',
            'current_period_end',
            'cancel_at_period_end',
            'canceled_at',
            'created_at',
        ]
        read_only_fields = fields
