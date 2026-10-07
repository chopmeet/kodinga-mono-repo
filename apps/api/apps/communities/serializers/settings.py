from common.serializers.base import BaseModelSerializer
from apps.communities.models.settings import CommunitySettings


class CommunitySettingsSerializer(BaseModelSerializer):
    class Meta:
        model = CommunitySettings
        fields = [
            'allow_member_invites',
            'require_approval_to_join',
            'welcome_message',
            'default_post_permission',
            'enabled_features',
            'updated_at',
        ]
        read_only_fields = ['updated_at']
