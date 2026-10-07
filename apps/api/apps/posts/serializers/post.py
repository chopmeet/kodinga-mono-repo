from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.accounts.serializers.user import UserSerializer
from apps.media.serializers.media import MediaAssetSerializer
from apps.posts.models.post import Post, PostType
from apps.posts.models.reaction import PostReaction
from apps.posts.serializers.category import PostCategorySerializer
from apps.posts.serializers.poll import PollSerializer


class PostListSerializer(BaseModelSerializer):
    """
    Lightweight feed item serializer.
    """
    author = UserSerializer(read_only=True)
    category = PostCategorySerializer(read_only=True)
    media_attachments = MediaAssetSerializer(many=True, read_only=True)
    poll = PollSerializer(read_only=True)
    user_reactions = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id',
            'community_id',
            'author',
            'category',
            'title',
            'content',
            'post_type',
            'code_snippet',
            'code_language',
            'media_attachments',
            'poll',
            'is_pinned',
            'is_locked',
            'is_resolved',
            'views_count',
            'reactions_count',
            'comments_count',
            'user_reactions',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_user_reactions(self, obj) -> list:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return []
        return list(PostReaction.objects.filter(post=obj, user=request.user).values_list('reaction_type', flat=True))


class PostDetailSerializer(PostListSerializer):
    """
    Full detail post serializer.
    """
    pass


class PostCreateUpdateSerializer(serializers.ModelSerializer):
    category_id = serializers.UUIDField(required=False, allow_null=True)
    media_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True
    )
    poll = serializers.DictField(required=False, write_only=True)

    class Meta:
        model = Post
        fields = [
            'title',
            'content',
            'post_type',
            'category_id',
            'code_snippet',
            'code_language',
            'media_ids',
            'poll',
        ]
