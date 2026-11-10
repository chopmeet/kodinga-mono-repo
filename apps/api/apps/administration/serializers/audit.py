from rest_framework import serializers

from apps.administration.models.audit import PlatformAuditLog
from apps.administration.models.setting import SystemSetting
from common.serializers.base import BaseModelSerializer


class PlatformAuditLogSerializer(BaseModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    actor_email = serializers.CharField(source="actor.email", read_only=True)

    class Meta:
        model = PlatformAuditLog
        fields = [
            "id",
            "actor",
            "actor_username",
            "actor_email",
            "action",
            "target_type",
            "target_id",
            "details",
            "ip_address",
            "user_agent",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SystemSettingSerializer(BaseModelSerializer):
    updated_by_username = serializers.CharField(
        source="updated_by.username", read_only=True
    )

    class Meta:
        model = SystemSetting
        fields = [
            "id",
            "key",
            "value",
            "description",
            "is_public",
            "updated_by",
            "updated_by_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SystemHealthSerializer(serializers.Serializer):
    status = serializers.CharField()
    components = serializers.DictField()
    checked_at = serializers.DateTimeField()


class AdminDashboardSummarySerializer(serializers.Serializer):
    overview = serializers.DictField()
    recent_audit_logs = serializers.ListField(child=serializers.DictField())
    recent_activities = serializers.ListField(
        child=serializers.DictField(), required=False
    )


class UserToggleStatusSerializer(serializers.Serializer):
    is_active = serializers.BooleanField(required=True)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class UserToggleAdminSerializer(serializers.Serializer):
    is_superadmin = serializers.BooleanField(required=True)
