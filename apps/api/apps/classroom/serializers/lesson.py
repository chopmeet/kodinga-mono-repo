from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.classroom.models.lesson import ContentFormat, Lesson, LessonType
from apps.media.serializers.video import VideoAssetSerializer


class LessonSerializer(BaseModelSerializer):
    video_hls_url = serializers.CharField(read_only=True)
    video_thumbnail_url = serializers.CharField(read_only=True)
    video_playback_id = serializers.CharField(read_only=True)
    video_status = serializers.CharField(read_only=True)
    reading_time_minutes = serializers.IntegerField(read_only=True)
    estimated_duration_display = serializers.CharField(read_only=True)
    has_video = serializers.BooleanField(read_only=True)
    has_images = serializers.BooleanField(read_only=True)
    is_completed = serializers.BooleanField(read_only=True, default=False)
    is_locked = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Lesson
        fields = [
            'id',
            'module',
            'title',
            'slug',
            'lesson_type',
            'content_format',
            'cover_image_url',
            'duration_seconds',
            'reading_time_minutes',
            'estimated_duration_display',
            'has_video',
            'has_images',
            'order',
            'is_free_preview',
            'video_hls_url',
            'video_thumbnail_url',
            'video_playback_id',
            'video_status',
            'is_completed',
            'is_locked',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'module', 'created_at', 'updated_at']


class LessonDetailSerializer(LessonSerializer):
    video_asset = VideoAssetSerializer(read_only=True)

    class Meta(LessonSerializer.Meta):
        fields = LessonSerializer.Meta.fields + [
            'content',
            'images',
            'video_asset',
            'attachments',
        ]


class LessonCreateUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    slug = serializers.SlugField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Optionnel. Slug personnalisé de la leçon (ex: 'intro-protocoles'). Si laissé vide ou omis, généré automatiquement à partir du titre."
    )
    module_id = serializers.UUIDField(
        required=False,
        help_text="Optionnel si spécifié dans l'URL. ID du module auquel appartient la leçon."
    )
    content = serializers.CharField(required=False, allow_blank=True, default='')
    content_format = serializers.ChoiceField(
        choices=ContentFormat.choices,
        default=ContentFormat.MARKDOWN,
        required=False
    )
    lesson_type = serializers.ChoiceField(choices=LessonType.choices, default=LessonType.TEXT)
    cover_image_url = serializers.URLField(required=False, allow_blank=True, default='')
    images = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )
    video_asset_id = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        default=None,
        help_text="Optionnel. UUID de l'asset vidéo Mux. Laisser vide ou null pour une leçon textuelle."
    )
    duration_seconds = serializers.IntegerField(required=False, min_value=0, default=0)
    order = serializers.IntegerField(required=False, min_value=0, default=0)
    is_free_preview = serializers.BooleanField(required=False, default=False)
    attachments = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )

    def validate_video_asset_id(self, value):
        if not value or str(value).strip() in ('', 'null', 'None'):
            return None
        import uuid
        try:
            return uuid.UUID(str(value).strip())
        except (ValueError, AttributeError):
            raise serializers.ValidationError("Doit être un UUID valide ou laissé vide/null pour du texte pur.")
