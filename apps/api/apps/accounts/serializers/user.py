from apps.accounts.models.consent import UserConsent
from apps.accounts.models.user import User
from common.serializers.base import BaseModelSerializer
from rest_framework import serializers


class UserSerializer(BaseModelSerializer):
    is_email_verified = serializers.BooleanField(read_only=True)
    is_pro = serializers.BooleanField(read_only=True)
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    status = serializers.SerializerMethodField(read_only=True)

    def get_status(self, obj) -> str:
        if not obj.is_active:
            return "inactive"
        if not obj.is_email_verified:
            return "unverified"
        return "active"

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'full_name',
            'status',
            'is_active',
            'is_staff',
            'is_superuser',
            'is_superadmin',
            'is_email_verified',
            'is_pro',
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
            'status',
            'is_active',
            'is_staff',
            'is_superuser',
            'is_email_verified',
            'is_pro',
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
            'is_superadmin',
            'is_active',
        ]

    def validate_is_superadmin(self, value):
        request = self.context.get('request')
        # Only admins/superadmins can alter superadmin rights
        if request and request.user and not (
            getattr(request.user, 'is_superadmin', False) or
            getattr(request.user, 'is_superuser', False) or
            getattr(request.user, 'is_staff', False)
        ):
            raise serializers.ValidationError("Only platform administrators can modify the is_superadmin attribute.")
        return value



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
