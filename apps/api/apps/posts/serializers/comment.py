from rest_framework import serializers

from apps.accounts.serializers.user import UserSerializer
from apps.media.models.media_asset import MediaStatus
from apps.media.serializers.media import MediaAssetSerializer
from apps.posts.models.comment import Comment
from apps.posts.models.reaction import CommentReaction
from common.serializers.base import BaseModelSerializer


class CommentSerializer(BaseModelSerializer):
    author = UserSerializer(read_only=True)
    media_attachments = MediaAssetSerializer(many=True, read_only=True)
    media = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    user_reactions = serializers.SerializerMethodField()
    reactions_summary = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id",
            "post_id",
            "parent_id",
            "author",
            "content",
            "media_attachments",
            "media",
            "is_accepted_answer",
            "reactions_count",
            "reactions_summary",
            "user_reactions",
            "replies",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "post_id",
            "parent_id",
            "author",
            "media",
            "is_accepted_answer",
            "reactions_count",
            "reactions_summary",
            "user_reactions",
            "replies",
            "created_at",
            "updated_at",
        ]

    def get_media(self, obj: Comment) -> list[dict]:
        items: list[dict] = []
        for idx, asset in enumerate(obj.media_attachments.all()):
            if asset.status == MediaStatus.DELETED:
                continue
            items.append(asset.to_unified_dict(order=idx))
        return items

    def get_replies(self, obj) -> list:
        if obj.parent_id is None:
            replies = obj.replies.all()
            return CommentSerializer(replies, many=True, context=self.context).data
        return []

    def get_user_reactions(self, obj) -> list:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return []
        return list(
            CommentReaction.objects.filter(comment=obj, user=request.user).values_list(
                "reaction_type", flat=True
            )
        )

    def get_reactions_summary(self, obj: Comment) -> dict[str, int]:
        counts: dict[str, int] = {}
        for r in obj.reactions.all():
            counts[r.reaction_type] = counts.get(r.reaction_type, 0) + 1
        return counts


class CreateCommentRequestSerializer(serializers.Serializer):
    content = serializers.CharField(
        help_text="Texte du commentaire (Markdown et emojis Unicode supportés)."
    )
    parent_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="ID optionnel du commentaire parent pour créer une réponse imbriquée (Thread).",
    )
    media_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
        help_text="Identifiants des médias attachés au commentaire.",
    )
