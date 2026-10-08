from common.serializers.base import BaseModelSerializer
from apps.posts.models.category import PostCategory


class PostCategorySerializer(BaseModelSerializer):
    class Meta:
        model = PostCategory
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'icon',
            'is_default',
            'is_restricted',
            'order',
            'created_at',
        ]
        read_only_fields = ['id', 'slug', 'created_at']
