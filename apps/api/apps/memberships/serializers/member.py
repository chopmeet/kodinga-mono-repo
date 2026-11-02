from apps.accounts.models.user import User
from apps.accounts.serializers.user import UserSerializer
from apps.memberships.models.member import (
    CommunityMember,
)
from common.serializers.base import BaseModelSerializer
from rest_framework import serializers


class PublicMemberUserSerializer(serializers.ModelSerializer):
    """
    Safe public user representation for community member directory (non-managers).
    Does not expose email, staff/superuser flags, or login timestamps.
    """
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    is_pro = serializers.BooleanField(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    headline = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'full_name',
            'avatar_url',
            'bio',
            'headline',
            'is_pro',
            'date_joined',
        ]
        read_only_fields = fields

    def get_avatar_url(self, obj) -> str:
        profile = getattr(obj, 'profile', None)
        return profile.avatar_url if profile else ''

    def get_bio(self, obj) -> str:
        profile = getattr(obj, 'profile', None)
        return profile.bio if profile else ''

    def get_headline(self, obj) -> str:
        profile = getattr(obj, 'profile', None)
        return getattr(profile, 'headline', '') if profile else ''


class ManagerMemberUserSerializer(UserSerializer):
    """
    Full user representation for community managers (includes email + profile avatar/bio/headline).
    """
    avatar_url = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    headline = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ['avatar_url', 'bio', 'headline']
        read_only_fields = UserSerializer.Meta.read_only_fields + ['avatar_url', 'bio', 'headline']

    def get_avatar_url(self, obj) -> str:
        profile = getattr(obj, 'profile', None)
        return profile.avatar_url if profile else ''

    def get_bio(self, obj) -> str:
        profile = getattr(obj, 'profile', None)
        return profile.bio if profile else ''

    def get_headline(self, obj) -> str:
        profile = getattr(obj, 'profile', None)
        return getattr(profile, 'headline', '') if profile else ''


class CommunityMemberSerializer(BaseModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = CommunityMember
        fields = [
            'id',
            'user',
            'role',
            'status',
            'custom_title',
            'joined_at',
            'reputation_score',
            'notifications_enabled',
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'joined_at', 'reputation_score', 'created_at']

    def get_user(self, obj) -> dict:
        is_manager = self.context.get('is_manager', True)
        if is_manager:
            return ManagerMemberUserSerializer(obj.user, context=self.context).data
        return PublicMemberUserSerializer(obj.user, context=self.context).data


ALLOWED_MEMBER_ROLES = [
    ('owner', 'Propriétaire'),
    ('admin', 'Administrateur'),
    ('editor', 'Éditeur'),
    ('moderator', 'Modérateur'),
    ('viewer', 'Lecteur'),
    ('member', 'Membre'),
]


class CommunityMemberRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=ALLOWED_MEMBER_ROLES)
    custom_title = serializers.CharField(max_length=100, required=False, allow_blank=True)


class MemberModerationDecisionSerializer(serializers.Serializer):
    approve = serializers.BooleanField()
