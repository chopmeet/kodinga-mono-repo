from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.accounts.models.session import UserSession


class UserSessionSerializer(BaseModelSerializer):
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserSession
        fields = [
            'id',
            'device_name',
            'ip_address',
            'user_agent',
            'last_seen_at',
            'expires_at',
            'is_active',
            'revoked_at',
            'created_at',
        ]
        read_only_fields = fields
