from apps.communities.models.settings import CommunitySettings
from common.serializers.base import BaseModelSerializer


class CommunitySettingsSerializer(BaseModelSerializer):
    class Meta:
        model = CommunitySettings
        fields = [
            'allow_member_invites',
            'require_approval_to_join',
            'welcome_message',
            'default_post_permission',
            'is_read_only',
            'enabled_features',
            'updated_at',
        ]
        read_only_fields = ['updated_at']
