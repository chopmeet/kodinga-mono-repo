import json

from rest_framework import serializers

from apps.classroom.models.lesson import ContentFormat, Lesson, LessonType
from apps.media.serializers.video import VideoAssetSerializer
from common.serializers.base import BaseModelSerializer


class LessonSerializer(BaseModelSerializer):
    video_url = serializers.CharField(read_only=True)
    video_provider = serializers.CharField(read_only=True)
    video_embed_url = serializers.CharField(read_only=True)
    video_hls_url = serializers.CharField(read_only=True)
    video_thumbnail_url = serializers.CharField(read_only=True)
    video_playback_id = serializers.CharField(read_only=True)
    video_status = serializers.CharField(read_only=True)
    video_source_url = serializers.CharField(read_only=True)
    code_language = serializers.CharField(read_only=True)
    reading_time_minutes = serializers.IntegerField(read_only=True)
    estimated_duration_display = serializers.CharField(read_only=True)
    has_video = serializers.BooleanField(read_only=True)
    has_images = serializers.BooleanField(read_only=True)
    is_completed = serializers.BooleanField(read_only=True, default=False)
    is_locked = serializers.BooleanField(read_only=True, default=False)
    quiz_score = serializers.FloatField(read_only=True, allow_null=True, default=None)
    quiz_passed = serializers.BooleanField(read_only=True, default=False)
    quiz_attempts_count = serializers.IntegerField(read_only=True, default=0)

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
            'video_url',
            'video_provider',
            'video_embed_url',
            'video_hls_url',
            'video_thumbnail_url',
            'video_playback_id',
            'video_status',
            'video_source_url',
            'code_language',
            'is_completed',
            'is_locked',
            'quiz_score',
            'quiz_passed',
            'quiz_attempts_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'module', 'created_at', 'updated_at']


class LessonDetailSerializer(LessonSerializer):
    video_asset = VideoAssetSerializer(read_only=True)
    quiz_data = serializers.SerializerMethodField()
    user_quiz_result = serializers.SerializerMethodField()

    class Meta(LessonSerializer.Meta):
        fields = LessonSerializer.Meta.fields + [
            'content',
            'images',
            'video_asset',
            'code_snippet',
            'code_blocks',
            'quiz_data',
            'user_quiz_result',
            'attachments',
        ]

    def get_quiz_data(self, obj: Lesson) -> dict:
        raw = obj.quiz_data if isinstance(obj.quiz_data, dict) else {}
        if not raw:
            return {}

        is_mgr = getattr(obj, '_viewer_is_manager', None)
        if is_mgr is None:
            request = self.context.get('request')
            user = getattr(request, 'user', None)
            if user and user.is_authenticated:
                from apps.classroom.selectors.classroom_selector import (
                    ClassroomSelector,
                )
                is_mgr = ClassroomSelector.is_manager(obj.module.course.community, user)
            else:
                is_mgr = False

        if is_mgr:
            return raw

        # Sanitize correct answers for non-manager learners until they pass the quiz
        sanitized_questions = []
        for q in raw.get('questions', []):
            if not isinstance(q, dict):
                continue
            sanitized_options = []
            for opt in q.get('options', []):
                if isinstance(opt, dict):
                    sanitized_options.append(
                        {
                            'id': opt.get('id'),
                            'text': opt.get('text'),
                        }
                    )
            sanitized_questions.append(
                {
                    'id': q.get('id'),
                    'question': q.get('question'),
                    'question_type': q.get('question_type', 'single_choice'),
                    'points': q.get('points', 1.0),
                    'options': sanitized_options,
                }
            )
        return {
            'title': raw.get('title', ''),
            'description': raw.get('description', ''),
            'passing_score': raw.get('passing_score', 50.0),
            'questions': sanitized_questions,
        }

    def get_user_quiz_result(self, obj: Lesson):
        return getattr(obj, 'user_quiz_result', None)


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
    content = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=False,
        default='',
    )
    content_format = serializers.ChoiceField(
        choices=ContentFormat.choices,
        default=ContentFormat.MARKDOWN,
        required=False
    )
    lesson_type = serializers.ChoiceField(
        choices=LessonType.choices,
        required=False,
    )
    cover_image_url = serializers.CharField(required=False, allow_blank=True, default='')
    images = serializers.JSONField(
        required=False,
        default=list,
    )
    video_asset_id = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        default=None,
        help_text="Optionnel. UUID de l'asset vidéo Mux. Laisser vide ou null pour une leçon textuelle."
    )
    video_url = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        help_text="URL vidéo YouTube, Vimeo, Dailymotion ou lien direct (.mp4, .webm, .m3u8)"
    )
    video_provider = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
    )
    code_language = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
        default='',
    )
    code_snippet = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=False,
        default='',
    )
    code_blocks = serializers.JSONField(
        required=False,
        default=list,
    )
    quiz_data = serializers.JSONField(
        required=False,
        default=dict,
    )
    duration_seconds = serializers.IntegerField(required=False, min_value=0, default=0)
    order = serializers.IntegerField(required=False, min_value=0, default=0)
    is_free_preview = serializers.BooleanField(required=False, default=False)
    attachments = serializers.JSONField(
        required=False,
        default=list,
    )

    def _parse_json_field_if_str(self, value, expected_type, field_label):
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return expected_type()
            try:
                value = json.loads(raw)
            except Exception as err:
                raise serializers.ValidationError(f"JSON invalide pour '{field_label}'.") from err
        if value is None:
            return expected_type()
        return value

    def validate_code_blocks(self, value):
        parsed = self._parse_json_field_if_str(value, list, 'code_blocks')
        if not isinstance(parsed, list):
            raise serializers.ValidationError("Le champ 'code_blocks' doit être une liste.")
        return parsed

    def validate_quiz_data(self, value):
        if value in (None, '', {}, []):
            return {}
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except Exception as err:
                raise serializers.ValidationError("JSON invalide pour 'quiz_data'.") from err
        return value

    def validate_video_asset_id(self, value):
        if not value or str(value).strip() in ('', 'null', 'None'):
            return None
        import uuid
        try:
            return uuid.UUID(str(value).strip())
        except (ValueError, AttributeError) as err:
            raise serializers.ValidationError("Doit être un UUID valide ou laissé vide/null pour du texte pur.") from err
