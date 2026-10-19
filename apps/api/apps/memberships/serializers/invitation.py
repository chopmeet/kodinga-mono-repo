from rest_framework import serializers

from apps.accounts.serializers.user import UserSerializer
from apps.memberships.models.invitation import (
    CommunityInvitation,
    InvitationStatus,
)
from apps.memberships.models.member import CommunityRole
from common.serializers.base import BaseModelSerializer

ALLOWED_INVITATION_ROLES = [
    ('admin', 'Administrateur'),
    ('editor', 'Éditeur / Modérateur'),
    ('viewer', 'Lecteur / Membre'),
    ('moderator', 'Modérateur'),
    ('member', 'Membre'),
]


class WorkspaceInvitationSerializer(BaseModelSerializer):
    invited_by = UserSerializer(read_only=True)
    is_valid = serializers.BooleanField(read_only=True)
    status = serializers.ChoiceField(choices=InvitationStatus.choices, read_only=True)
    raw_token = serializers.CharField(read_only=True, required=False, help_text="Présent uniquement lors de la création pour l'invitant")

    class Meta:
        model = CommunityInvitation
        fields = [
            'id',
            'email',
            'role',
            'status',
            'expires_at',
            'accepted_at',
            'invited_by',
            'is_valid',
            'raw_token',
            'created_at',
        ]
        read_only_fields = ['id', 'status', 'expires_at', 'accepted_at', 'invited_by', 'is_valid', 'created_at']


class CreateWorkspaceInvitationSerializer(serializers.Serializer):
    email = serializers.EmailField(
        required=True,
        help_text="Adresse email du collaborateur invité"
    )
    role = serializers.ChoiceField(
        choices=ALLOWED_INVITATION_ROLES,
        default='viewer',
        help_text="Rôle attribué ('admin' | 'editor' | 'viewer')"
    )
    expires_in_days = serializers.IntegerField(
        min_value=1,
        max_value=30,
        default=7,
        help_text="Nombre de jours avant expiration (défaut: 7 jours)"
    )

    def validate_email(self, value):
        normalized = value.strip().lower()
        if not normalized or '@' not in normalized:
            raise serializers.ValidationError("Adresse email invalide.")
        return normalized


class PublicInvitationDetailSerializer(serializers.Serializer):
    workspace_id = serializers.CharField(read_only=True)
    workspace_name = serializers.CharField(read_only=True)
    workspace_slug = serializers.CharField(read_only=True)
    workspace_avatar_url = serializers.CharField(read_only=True)
    role = serializers.CharField(read_only=True)
    role_display = serializers.CharField(read_only=True)
    masked_email = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    expires_at = serializers.DateTimeField(read_only=True, allow_null=True)
    is_valid = serializers.BooleanField(read_only=True)


# ==============================================================================
# Legacy backward-compatible serializers
# ==============================================================================

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
            'status',
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
    invite_code = serializers.CharField(max_length=128, required=False, allow_blank=True)
    token = serializers.CharField(max_length=128, required=False, allow_blank=True)
