from common.serializers.base import BaseModelSerializer
from rest_framework import serializers

from apps.accounts.models.user import User
from apps.events.models.attendee import AttendeeStatus, EventAttendee


class UserMinimalSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "avatar_url",
        ]
        read_only_fields = fields

    def get_avatar_url(self, obj) -> str:
        profile = getattr(obj, "profile", None)
        return getattr(profile, "avatar_url", "") if profile else ""


class EventAttendeeSerializer(BaseModelSerializer):
    user = UserMinimalSerializer(read_only=True)
    event_id = serializers.UUIDField(source="event.id", read_only=True)

    class Meta:
        model = EventAttendee
        fields = [
            "id",
            "event_id",
            "user",
            "status",
            "checked_in_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "event_id",
            "user",
            "checked_in_at",
            "created_at",
            "updated_at",
        ]


class EventRSVPSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=AttendeeStatus.choices,
        default=AttendeeStatus.ATTENDING,
        help_text="Choix: attending, maybe, declined",
    )
