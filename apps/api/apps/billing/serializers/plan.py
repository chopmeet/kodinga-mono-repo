from rest_framework import serializers

from apps.billing.models.plan import Plan
from common.serializers.base import BaseModelSerializer


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


class CommunityPlanCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer used by Pro community owners to create/edit custom membership formulas
    (e.g. monthly subscription or definitive/lifetime access).
    """
    from decimal import Decimal
    community_id = serializers.UUIDField(required=True)
    name = serializers.CharField(max_length=120)
    slug = serializers.SlugField(max_length=130, required=False)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("500.00"))
    currency = serializers.CharField(max_length=10, default='XOF', required=False)
    billing_interval = serializers.ChoiceField(
        choices=['month', 'year', 'one_time'], default='month'
    )
    interval_count = serializers.IntegerField(default=1, min_value=1, required=False)
    features = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    is_active = serializers.BooleanField(default=True, required=False)

    class Meta:
        model = Plan
        fields = [
            'id',
            'community_id',
            'name',
            'slug',
            'description',
            'price',
            'currency',
            'billing_interval',
            'interval_count',
            'features',
            'is_active',
        ]
        read_only_fields = ['id']
