from rest_framework import serializers

from apps.communities.models.community import Community
from apps.events.models.event import Event, EventFormat, EventStatus, EventType
from apps.events.serializers.attendee import UserMinimalSerializer
from apps.media.serializers.video import VideoAssetSerializer
from common.serializers.base import BaseModelSerializer


class CommunitySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Community
        fields = ["id", "name", "slug", "avatar_url"]
        read_only_fields = fields


class EventSerializer(BaseModelSerializer):
    community = CommunitySummarySerializer(read_only=True)
    host = UserMinimalSerializer(read_only=True)
    replay_video_asset = VideoAssetSerializer(read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)
    is_in_progress = serializers.BooleanField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    duration_minutes = serializers.IntegerField(read_only=True)
    user_rsvp_status = serializers.SerializerMethodField()

    def get_user_rsvp_status(self, obj):
        return getattr(obj, "user_rsvp_status", None)

    class Meta:
        model = Event
        fields = [
            "id",
            "community",
            "host",
            "title",
            "slug",
            "description",
            "cover_image_url",
            "event_type",
            "format",
            "status",
            "start_time",
            "end_time",
            "timezone",
            "attendees_count",
            "max_attendees",
            "is_full",
            "is_upcoming",
            "is_in_progress",
            "is_recorded",
            "is_public",
            "duration_minutes",
            "user_rsvp_status",
            "replay_video_asset",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class EventDetailSerializer(EventSerializer):
    class Meta(EventSerializer.Meta):
        fields = EventSerializer.Meta.fields + [
            "location_url",
            "live_room_name",
            "metadata",
        ]
        read_only_fields = fields


class EventCreateUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    cover_image_url = serializers.URLField(
        max_length=1000, required=False, allow_blank=True, default=""
    )
    event_type = serializers.ChoiceField(
        choices=EventType.choices, default=EventType.LIVE_STREAM
    )
    format = serializers.ChoiceField(
        choices=EventFormat.choices, default=EventFormat.LIVEKIT
    )
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()
    timezone = serializers.CharField(max_length=50, default="UTC")
    location_url = serializers.URLField(
        max_length=1000, required=False, allow_blank=True, default=""
    )
    max_attendees = serializers.IntegerField(
        min_value=1, required=False, allow_null=True, default=None
    )
    is_recorded = serializers.BooleanField(default=True)
    is_public = serializers.BooleanField(default=True)
    metadata = serializers.DictField(required=False, default=dict)

    def validate(self, attrs):
        start = attrs.get("start_time")
        end = attrs.get("end_time")
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_time": "La date de fin doit être postérieure à la date de début."}
            )
        return attrs


class EventStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=EventStatus.choices)


class EventReplayAttachSerializer(serializers.Serializer):
    video_asset_id = serializers.UUIDField()


class LiveKitTokenResponseSerializer(serializers.Serializer):
    room_name = serializers.CharField()
    token = serializers.CharField()
    server_url = serializers.CharField()
    is_host = serializers.BooleanField()
