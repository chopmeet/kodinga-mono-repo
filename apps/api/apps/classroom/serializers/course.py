from common.serializers.base import BaseModelSerializer
from rest_framework import serializers

from apps.classroom.models.course import Course, CourseLevel
from apps.classroom.models.module import CourseModule
from apps.classroom.serializers.lesson import LessonSerializer


class CourseModuleNestedSerializer(BaseModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = CourseModule
        fields = [
            'id',
            'title',
            'description',
            'order',
            'lessons_count',
            'lessons',
            'created_at',
        ]


class CourseSerializer(BaseModelSerializer):
    duration_minutes = serializers.IntegerField(read_only=True)
    user_progress_percent = serializers.FloatField(read_only=True, default=0.0)
    user_is_enrolled = serializers.BooleanField(read_only=True, default=False)
    user_is_completed = serializers.BooleanField(read_only=True, default=False)
    user_completed_at = serializers.DateTimeField(read_only=True, allow_null=True, default=None)

    class Meta:
        model = Course
        fields = [
            'id',
            'community',
            'author',
            'title',
            'slug',
            'description',
            'level',
            'thumbnail_url',
            'is_published',
            'is_sequential',
            'order',
            'modules_count',
            'lessons_count',
            'duration_seconds',
            'duration_minutes',
            'user_progress_percent',
            'user_is_enrolled',
            'user_is_completed',
            'user_completed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'community',
            'author',
            'modules_count',
            'lessons_count',
            'duration_seconds',
            'created_at',
            'updated_at',
        ]


class CourseDetailSerializer(CourseSerializer):
    modules = CourseModuleNestedSerializer(many=True, read_only=True)
    completed_lessons_count = serializers.IntegerField(read_only=True, default=0)
    total_lessons_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(CourseSerializer.Meta):
        fields = CourseSerializer.Meta.fields + [
            'completed_lessons_count',
            'total_lessons_count',
            'modules',
        ]


class CourseCreateUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    slug = serializers.SlugField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Optionnel. Slug personnalisé du cours (ex: 'python-avance'). Si laissé vide ou omis, généré automatiquement à partir du titre."
    )
    description = serializers.CharField(required=False, allow_blank=True, default='')
    level = serializers.ChoiceField(choices=CourseLevel.choices, default=CourseLevel.ALL_LEVELS)
    thumbnail_url = serializers.CharField(required=False, allow_blank=True, default='')
    is_published = serializers.BooleanField(required=False, default=False)
    is_sequential = serializers.BooleanField(required=False, default=True)
    order = serializers.IntegerField(required=False, min_value=0, default=0)
