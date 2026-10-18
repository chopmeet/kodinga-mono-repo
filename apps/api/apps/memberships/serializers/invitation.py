from rest_framework import serializers

from apps.accounts.serializers.user import UserSerializer
from apps.memberships.models.invitation import CommunityInvitation
from apps.memberships.models.member import CommunityRole
from common.serializers.base import BaseModelSerializer


class CommunityInvitationSerializer(BaseModelSerializer):
    invited_by = UserSerializer(read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = CommunityInvitation
        fields = [
            'id',
            'email',
            'invite_code',
            'role',
            'max_uses',
            'uses_count',
            'expires_at',
            'is_valid',
            'is_revoked',
            'invited_by',
            'created_at',
        ]
        read_only_fields = ['id', 'invite_code', 'uses_count', 'is_valid', 'invited_by', 'created_at']


class CreateInvitationRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=CommunityRole.choices, default=CommunityRole.MEMBER)
    max_uses = serializers.IntegerField(min_value=1, default=1)
    expires_in_days = serializers.IntegerField(min_value=1, max_value=90, default=7)


class AcceptInvitationSerializer(serializers.Serializer):
    invite_code = serializers.CharField(max_length=64)
