from rest_framework import serializers

from apps.analytics.models.metric import PlatformMetric
from common.serializers.base import BaseModelSerializer


class PlatformMetricSerializer(BaseModelSerializer):
    class Meta:
        model = PlatformMetric
        fields = [
            "id",
            "metric_name",
            "metric_type",
            "value",
            "dimensions",
            "period_start",
            "period_end",
            "recorded_at",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "recorded_at"]


class AnalyticsOverviewSerializer(serializers.Serializer):
    users = serializers.DictField()
    communities = serializers.DictField()
    content = serializers.DictField()
    learning = serializers.DictField()
    ecosystem = serializers.DictField()
    financial = serializers.DictField()
    generated_at = serializers.DateTimeField()


class FinancialAnalyticsSerializer(serializers.Serializer):
    revenue_by_currency = serializers.ListField(child=serializers.DictField())
    recent_30d_revenue = serializers.FloatField()
    recent_30d_transactions = serializers.IntegerField()
    payment_methods_30d = serializers.ListField(
        child=serializers.DictField(), required=False
    )
    subscriptions_distribution = serializers.ListField(child=serializers.DictField())
    recent_transactions = serializers.ListField(child=serializers.DictField())
    generated_at = serializers.DateTimeField()


class MonthlyGrowthPointSerializer(serializers.Serializer):
    month = serializers.CharField()
    year = serializers.IntegerField()
    date = serializers.CharField()
    newMembers = serializers.IntegerField()
    new_members = serializers.IntegerField()
    posts = serializers.IntegerField()
    revenue = serializers.FloatField()


class EngagementAnalyticsSerializer(serializers.Serializer):
    dau = serializers.IntegerField()
    wau = serializers.IntegerField()
    mau = serializers.IntegerField()
    dau_mau_ratio = serializers.FloatField()
    posts_last_7d = serializers.IntegerField()
    comments_last_7d = serializers.IntegerField()
    active_learners_30d = serializers.IntegerField()
    generated_at = serializers.DateTimeField()
