from apps.accounts.models.user import User
from apps.notifications.models.notification import Notification
from rest_framework import serializers


class NotificationActorSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "name", "avatar_url"]

    def get_name(self, obj) -> str:
        return obj.get_full_name() or obj.username

    def get_avatar_url(self, obj) -> str:
        return getattr(getattr(obj, "profile", None), "avatar_url", "") or ""


class NotificationSerializer(serializers.ModelSerializer):
    actor = NotificationActorSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "body",
            "action_url",
            "target_type",
            "target_id",
            "is_read",
            "read_at",
            "actor",
            "created_at",
        ]


class UnreadCountResponseSerializer(serializers.Serializer):
    unread_count = serializers.IntegerField()
