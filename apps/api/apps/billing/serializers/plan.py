from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.billing.models.plan import Plan


class PlanSerializer(BaseModelSerializer):
    """
    Subscription plan serializer.
    """
    community_name = serializers.CharField(source='community.name', read_only=True, allow_null=True)

    class Meta:
        model = Plan
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'price',
            'currency',
            'billing_interval',
            'interval_count',
            'community_id',
            'community_name',
            'features',
            'is_active',
            'order',
        ]
        read_only_fields = fields
