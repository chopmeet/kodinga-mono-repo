from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.accounts.serializers.user import UserSerializer
from apps.memberships.models.sanction import MemberSanction, SanctionType


class MemberSanctionSerializer(BaseModelSerializer):
    issued_by = UserSerializer(read_only=True)

    class Meta:
        model = MemberSanction
        fields = [
            'id',
            'sanction_type',
            'reason',
            'expires_at',
            'is_active',
            'issued_by',
            'created_at',
        ]
        read_only_fields = ['id', 'issued_by', 'is_active', 'created_at']


class CreateSanctionRequestSerializer(serializers.Serializer):
    sanction_type = serializers.ChoiceField(choices=SanctionType.choices)
    reason = serializers.CharField(max_length=1000)
    duration_days = serializers.IntegerField(min_value=1, max_value=365, required=False, allow_null=True)
