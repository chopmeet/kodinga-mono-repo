from common.serializers.base import BaseModelSerializer
from rest_framework import serializers

from apps.communities.models.community import Community
from apps.events.models.event import Event, EventFormat, EventStatus, EventType
from apps.events.serializers.attendee import UserMinimalSerializer
from apps.media.serializers.video import VideoAssetSerializer


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
    has_transcription = serializers.SerializerMethodField()
    has_summary = serializers.SerializerMethodField()
    video_url = serializers.CharField(source="location_url", read_only=True)
    location_url = serializers.CharField(read_only=True)

    def get_user_rsvp_status(self, obj):
        return getattr(obj, "user_rsvp_status", None)

    def get_has_transcription(self, obj) -> bool:
        meta = getattr(obj, "metadata", None) or {}
        return bool(meta.get("transcription"))

    def get_has_summary(self, obj) -> bool:
        meta = getattr(obj, "metadata", None) or {}
        return bool(meta.get("summary"))

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
            "venue_name",
            "location_address",
            "location_city",
            "location_country",
            "attendees_count",
            "max_attendees",
            "is_full",
            "is_upcoming",
            "is_in_progress",
            "is_recorded",
            "is_public",
            "duration_minutes",
            "user_rsvp_status",
            "has_transcription",
            "has_summary",
            "location_url",
            "video_url",
            "replay_video_asset",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class EventDetailSerializer(EventSerializer):
    class Meta(EventSerializer.Meta):
        fields = EventSerializer.Meta.fields + [
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

    # Physical location fields (presentiel)
    venue_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )
    location_address = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default=""
    )
    location_city = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )
    location_country = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )

    # Online webinar fields
    location_url = serializers.URLField(
        max_length=1000, required=False, allow_blank=True, default=""
    )
    video_url = serializers.URLField(
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
        video_url = attrs.get("video_url")
        loc_url = attrs.get("location_url")
        if video_url and not loc_url:
            attrs["location_url"] = video_url
        elif loc_url and not video_url:
            attrs["video_url"] = loc_url
        return attrs


class EventStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=EventStatus.choices)


class EventReplayAttachSerializer(serializers.Serializer):
    video_asset_id = serializers.UUIDField(required=False, allow_null=True)
    video = serializers.FileField(required=False, allow_null=True)
    video_url = serializers.URLField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("video_asset_id") and not attrs.get("video") and not attrs.get("video_url"):
            raise serializers.ValidationError(
                "Un fichier vidéo, une URL vidéo ou un ID d'asset vidéo est requis."
            )
        return attrs


class LiveKitTokenResponseSerializer(serializers.Serializer):
    room_name = serializers.CharField()
    token = serializers.CharField()
    server_url = serializers.CharField()
    is_host = serializers.BooleanField()


class EventTranscribeRequestSerializer(serializers.Serializer):
    force = serializers.BooleanField(required=False, default=False)
    language = serializers.CharField(required=False, default="fr", max_length=10)


class EventTranscriptionSegmentSerializer(serializers.Serializer):
    start = serializers.CharField()
    end = serializers.CharField()
    speaker = serializers.CharField()
    text = serializers.CharField()


class EventSummaryDataSerializer(serializers.Serializer):
    overview = serializers.CharField(required=False, allow_blank=True, default="")
    key_points = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    action_items = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    decisions = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class EventTranscriptionResponseSerializer(serializers.Serializer):
    status = serializers.CharField(required=False, default="idle")
    has_transcription = serializers.BooleanField(required=False, default=False)
    transcription = serializers.CharField(allow_blank=True, required=False, default="")
    segments = EventTranscriptionSegmentSerializer(many=True, required=False, default=list)
    summary = EventSummaryDataSerializer(required=False, allow_null=True)
    transcribed_at = serializers.CharField(allow_null=True, required=False)
    error = serializers.CharField(allow_blank=True, required=False, default="")


class EventSummaryResponseSerializer(serializers.Serializer):
    summary = EventSummaryDataSerializer()


class EventChatTranscriptRequestSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000)
    history = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    language = serializers.CharField(required=False, default="fr", max_length=10)


class EventChatTranscriptResponseSerializer(serializers.Serializer):
    reply = serializers.CharField()
    referenced_segments = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    suggested_follow_ups = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    provider = serializers.CharField(required=False, default="gemini")

