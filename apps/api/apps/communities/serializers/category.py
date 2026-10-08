from common.serializers.base import BaseModelSerializer
from apps.communities.models.category import CommunityCategory


class CommunityCategorySerializer(BaseModelSerializer):
    class Meta:
        model = CommunityCategory
        fields = ['id', 'name', 'slug', 'description', 'icon_url', 'order', 'created_at']
        read_only_fields = ['id', 'slug', 'created_at']
