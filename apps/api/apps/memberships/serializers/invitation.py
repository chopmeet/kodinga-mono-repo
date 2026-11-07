from rest_framework import serializers

from apps.accounts.models.user import User
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
    community_id = serializers.UUIDField(source='community.id', read_only=True)
    community_name = serializers.CharField(source='community.name', read_only=True)
    community_slug = serializers.CharField(source='community.slug', read_only=True)
    community_avatar_url = serializers.CharField(source='community.avatar_url', read_only=True)

    class Meta:
        model = CommunityInvitation
        fields = [
            'id',
            'community_id',
            'community_name',
            'community_slug',
            'community_avatar_url',
            'email',
            'invite_code',
            'role',
            'status',
            'max_uses',
            'uses_count',
            'expires_at',
            'accepted_at',
            'declined_at',
            'invited_by',
            'is_valid',
            'raw_token',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'community_id',
            'community_name',
            'community_slug',
            'community_avatar_url',
            'max_uses',
            'uses_count',
            'invite_code',
            'status',
            'expires_at',
            'accepted_at',
            'declined_at',
            'invited_by',
            'is_valid',
            'created_at',
        ]


class CreateWorkspaceInvitationSerializer(serializers.Serializer):
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        help_text="Adresse email du collaborateur invité"
    )
    user_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="UUID de l'utilisateur invité (optionnel si email ou username fourni)"
    )
    username = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Nom d'utilisateur de l'invité (optionnel si email ou user_id fourni)"
    )
    role = serializers.ChoiceField(
        choices=ALLOWED_INVITATION_ROLES,
        default='viewer',
        help_text="Rôle attribué ('admin' | 'editor' | 'viewer' | 'moderator' | 'member')"
    )
    expires_in_days = serializers.IntegerField(
        min_value=1,
        max_value=30,
        default=7,
        help_text="Nombre de jours avant expiration (défaut: 7 jours)"
    )

    def validate(self, attrs):
        email = (attrs.get('email') or '').strip().lower()
        user_id = attrs.get('user_id')
        username = (attrs.get('username') or '').strip()

        if not email and user_id:
            target = User.objects.filter(id=user_id).first()
            if not target:
                raise serializers.ValidationError({'user_id': "Utilisateur introuvable."})
            email = target.email.strip().lower()
        elif not email and username:
            target = User.objects.filter(username__iexact=username).first()
            if not target:
                raise serializers.ValidationError({'username': "Utilisateur introuvable."})
            email = target.email.strip().lower()

        if not email or '@' not in email:
            raise serializers.ValidationError({'email': "Adresse email d'invitation requise et valide."})

        attrs['email'] = email
        return attrs


class PublicInvitationDetailSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True, required=False)
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
    community_id = serializers.UUIDField(source='community.id', read_only=True)
    community_name = serializers.CharField(source='community.name', read_only=True)
    community_slug = serializers.CharField(source='community.slug', read_only=True)

    class Meta:
        model = CommunityInvitation
        fields = [
            'id',
            'community_id',
            'community_name',
            'community_slug',
            'email',
            'invite_code',
            'role',
            'status',
            'max_uses',
            'uses_count',
            'expires_at',
            'accepted_at',
            'declined_at',
            'is_valid',
            'is_revoked',
            'invited_by',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'community_id',
            'community_name',
            'community_slug',
            'invite_code',
            'uses_count',
            'accepted_at',
            'declined_at',
            'is_valid',
            'invited_by',
            'created_at',
        ]


class CreateInvitationRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    user_id = serializers.UUIDField(required=False, allow_null=True)
    username = serializers.CharField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=CommunityRole.choices, default=CommunityRole.MEMBER)
    max_uses = serializers.IntegerField(min_value=1, default=1)
    expires_in_days = serializers.IntegerField(min_value=1, max_value=90, default=7)

    def validate(self, attrs):
        email = (attrs.get('email') or '').strip().lower()
        user_id = attrs.get('user_id')
        username = (attrs.get('username') or '').strip()
        if not email and user_id:
            target = User.objects.filter(id=user_id).first()
            if not target:
                raise serializers.ValidationError({'user_id': "Utilisateur introuvable."})
            email = target.email.strip().lower()
        elif not email and username:
            target = User.objects.filter(username__iexact=username).first()
            if not target:
                raise serializers.ValidationError({'username': "Utilisateur introuvable."})
            email = target.email.strip().lower()
        attrs['email'] = email
        return attrs


class AcceptInvitationSerializer(serializers.Serializer):
    invite_code = serializers.CharField(max_length=128, required=False, allow_blank=True)
    token = serializers.CharField(max_length=128, required=False, allow_blank=True)
    invitation_id = serializers.UUIDField(required=False, allow_null=True)


class DeclineInvitationSerializer(serializers.Serializer):
    invite_code = serializers.CharField(max_length=128, required=False, allow_blank=True)
    token = serializers.CharField(max_length=128, required=False, allow_blank=True)
    invitation_id = serializers.UUIDField(required=False, allow_null=True)
