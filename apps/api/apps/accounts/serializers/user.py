from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.accounts.models.user import User
from apps.accounts.models.consent import UserConsent


class UserSerializer(BaseModelSerializer):
    is_email_verified = serializers.BooleanField(read_only=True)
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'full_name',
            'is_active',
            'is_email_verified',
            'preferred_language',
            'timezone',
            'date_joined',
            'last_login',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'email',
            'username',
            'is_active',
            'is_email_verified',
            'date_joined',
            'last_login',
            'created_at',
            'updated_at',
        ]


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'first_name',
            'last_name',
            'preferred_language',
            'timezone',
        ]


class ConsentSerializer(BaseModelSerializer):
    class Meta:
        model = UserConsent
        fields = [
            'id',
            'consent_type',
            'policy_version',
            'granted',
            'recorded_at',
            'created_at',
        ]
        read_only_fields = ['id', 'recorded_at', 'created_at']
