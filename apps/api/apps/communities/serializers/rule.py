from common.serializers.base import BaseModelSerializer
from apps.communities.models.rule import CommunityRule


class CommunityRuleSerializer(BaseModelSerializer):
    class Meta:
        model = CommunityRule
        fields = ['id', 'title', 'description', 'order', 'created_at']
        read_only_fields = ['id', 'created_at']
