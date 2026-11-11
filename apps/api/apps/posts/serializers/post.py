from rest_framework import serializers

from apps.accounts.serializers.user import UserSerializer
from apps.media.models.media_asset import MediaStatus
from apps.media.models.video_asset import VideoStatus
from apps.media.serializers.media import MediaAssetSerializer
from apps.media.serializers.video import VideoAssetSerializer
from apps.posts.models.post import Post
from apps.posts.models.reaction import PostReaction
from apps.posts.serializers.category import PostCategorySerializer
from apps.posts.serializers.poll import PollInputSerializer, PollSerializer
from common.serializers.base import BaseModelSerializer


class PostListSerializer(BaseModelSerializer):
    """
    Lightweight feed item serializer with unified multimedia representation.
    """

    author = UserSerializer(read_only=True)
    category = PostCategorySerializer(read_only=True)
    media_attachments = serializers.SerializerMethodField()
    video_attachments = serializers.SerializerMethodField()
    media = serializers.SerializerMethodField()
    poll = PollSerializer(read_only=True)
    user_reactions = serializers.SerializerMethodField()
    reactions_summary = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "community_id",
            "author",
            "category",
            "title",
            "content",
            "post_type",
            "code_snippet",
            "code_language",
            "media_attachments",
            "video_attachments",
            "media",
            "poll",
            "is_pinned",
            "is_locked",
            "is_resolved",
            "views_count",
            "reactions_count",
            "reactions_summary",
            "comments_count",
            "user_reactions",
            "is_bookmarked",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_media_attachments(self, obj: Post) -> list:
        assets = [
            a for a in obj.media_attachments.all() if a.status != MediaStatus.DELETED
        ]
        assets.sort(
            key=lambda a: (
                (a.metadata or {}).get("post_order", 0)
                if isinstance(a.metadata, dict)
                else 0
            )
        )
        return MediaAssetSerializer(assets, many=True, context=self.context).data

    def get_video_attachments(self, obj: Post) -> list:
        videos = [
            v for v in obj.video_attachments.all() if v.status != VideoStatus.DELETED
        ]
        videos.sort(
            key=lambda v: (
                (v.metadata or {}).get("post_order", 0)
                if isinstance(v.metadata, dict)
                else 0
            )
        )
        return VideoAssetSerializer(videos, many=True, context=self.context).data

    def get_media(self, obj: Post) -> list[dict]:
        """
        Unified multimedia list combining IMAGE, DOCUMENT (UploadThing) and VIDEO (Mux)
        sorted by attachment display order.
        """
        unified: list[dict] = []
        for asset in obj.media_attachments.all():
            if asset.status == MediaStatus.DELETED:
                continue
            meta = asset.metadata if isinstance(asset.metadata, dict) else {}
            order = int(meta.get("post_order", len(unified)))
            unified.append(asset.to_unified_dict(order=order))

        for video in obj.video_attachments.all():
            if video.status == VideoStatus.DELETED:
                continue
            meta = video.metadata if isinstance(video.metadata, dict) else {}
            order = int(meta.get("post_order", len(unified)))
            unified.append(video.to_unified_dict(order=order))

        unified.sort(key=lambda item: item.get("order", 0))
        return unified

    def get_user_reactions(self, obj) -> list:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return []
        return list(
            PostReaction.objects.filter(post=obj, user=request.user).values_list(
                "reaction_type", flat=True
            )
        )

    def get_reactions_summary(self, obj: Post) -> dict[str, int]:
        counts: dict[str, int] = {}
        for r in obj.reactions.all():
            counts[r.reaction_type] = counts.get(r.reaction_type, 0) + 1
        return counts

    def get_is_bookmarked(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        bookmarked_ids = self.context.get("bookmarked_post_ids")
        if bookmarked_ids is not None:
            return obj.id in bookmarked_ids
        return obj.bookmarks.filter(user=request.user).exists()


class PostDetailSerializer(PostListSerializer):
    """
    Full detail post serializer.
    """

    pass


class PostCreateUpdateSerializer(serializers.ModelSerializer):
    category_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        write_only=True,
        help_text="Identifiant du canal/catégorie de la communauté.",
    )
    media_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
        help_text="Liste des identifiants des médias (images, documents ou vidéos) à joindre.",
    )
    video_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
        help_text="Liste des identifiants des vidéos Mux (VideoAsset) à joindre.",
    )
    poll = PollInputSerializer(
        required=False,
        write_only=True,
        help_text="Configuration du sondage si post_type = 'poll'.",
    )

    class Meta:
        model = Post
        fields = [
            "title",
            "content",
            "post_type",
            "category_id",
            "code_snippet",
            "code_language",
            "media_ids",
            "video_ids",
            "poll",
        ]
