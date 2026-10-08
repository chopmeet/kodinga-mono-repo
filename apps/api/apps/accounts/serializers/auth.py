from django.contrib.auth import password_validation
from django.contrib.auth.models import update_last_login
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.models.user import User


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    username = serializers.CharField(max_length=50, required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    preferred_language = serializers.CharField(max_length=10, required=False, default="fr")
    timezone = serializers.CharField(max_length=50, required=False, default="UTC")
    terms_accepted = serializers.BooleanField(required=False, default=True)

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return normalized

    def validate_username(self, value):
        cleaned = value.strip().lower()
        if len(cleaned) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters long.")
        if not cleaned.replace('_', '').replace('-', '').isalnum():
            raise serializers.ValidationError("Username can only contain alphanumeric characters, underscores, and hyphens.")
        if User.objects.filter(username=cleaned).exists():
            raise serializers.ValidationError("This username is already taken.")
        return cleaned

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value

    def validate_terms_accepted(self, value):
        if value is False:
            raise serializers.ValidationError("You must accept the terms of service to create an account.")
        return True


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(required=True, help_text="Email address or username")
    password = serializers.CharField(write_only=True, required=True)
    device_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class EmailVerificationSerializer(serializers.Serializer):
    token = serializers.CharField(required=True, min_length=10)


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(required=True, min_length=10)
    new_password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True, min_length=8)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        password_validation.validate_password(attrs['new_password'])
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        if attrs['current_password'] == attrs['new_password']:
            raise serializers.ValidationError({"new_password": "New password cannot be the same as current password."})
        password_validation.validate_password(attrs['new_password'], user=self.context['request'].user)
        return attrs
