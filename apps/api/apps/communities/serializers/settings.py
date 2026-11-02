from apps.communities.models.settings import CommunitySettings
from common.serializers.base import BaseModelSerializer
from rest_framework import serializers


class CommunitySettingsSerializer(BaseModelSerializer):
    all_role_permissions = serializers.SerializerMethodField()

    class Meta:
        model = CommunitySettings
        fields = [
            'allow_member_invites',
            'require_approval_to_join',
            'welcome_message',
            'default_post_permission',
            'is_read_only',
            'enabled_features',
            'role_permissions',
            'all_role_permissions',
            'updated_at',
        ]
        read_only_fields = ['updated_at', 'all_role_permissions']

    def get_all_role_permissions(self, obj) -> dict:
        return obj.get_all_role_permissions()
