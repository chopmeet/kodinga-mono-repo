from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.accounts.serializers.user import UserSerializer
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


class CommunityMemberSerializer(BaseModelSerializer):
    user = UserSerializer(read_only=True)

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
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'joined_at', 'reputation_score', 'created_at']


class CommunityMemberRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=CommunityRole.choices)
    custom_title = serializers.CharField(max_length=100, required=False, allow_blank=True)


class MemberModerationDecisionSerializer(serializers.Serializer):
    approve = serializers.BooleanField()
