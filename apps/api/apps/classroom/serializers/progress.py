from rest_framework import serializers

from apps.classroom.models.progress import CourseEnrollment, LessonProgress
from common.serializers.base import BaseModelSerializer


class LessonProgressSerializer(BaseModelSerializer):
    course_id = serializers.CharField(read_only=True, required=False)
    course_slug = serializers.CharField(read_only=True, required=False)
    course_title = serializers.CharField(read_only=True, required=False)
    course_progress_percent = serializers.FloatField(read_only=True, required=False, default=0.0)
    completed_lessons_count = serializers.IntegerField(read_only=True, required=False, default=0)
    total_lessons_count = serializers.IntegerField(read_only=True, required=False, default=0)
    is_course_completed = serializers.BooleanField(read_only=True, required=False, default=False)
    just_completed_course = serializers.BooleanField(read_only=True, required=False, default=False)
    course_completed_at = serializers.DateTimeField(read_only=True, allow_null=True, required=False)
    next_lesson_id = serializers.CharField(read_only=True, allow_null=True, required=False)
    next_lesson_slug = serializers.CharField(read_only=True, allow_null=True, required=False)
    next_lesson_title = serializers.CharField(read_only=True, allow_null=True, required=False)
    xp_awarded = serializers.IntegerField(read_only=True, required=False, default=0)
    congratulations = serializers.DictField(read_only=True, allow_null=True, required=False)

    class Meta:
        model = LessonProgress
        fields = [
            'id',
            'lesson',
            'user',
            'is_completed',
            'last_watched_second',
            'completed_at',
            'notes',
            'quiz_score',
            'quiz_passed',
            'quiz_attempts_count',
            'quiz_last_submission',
            'course_id',
            'course_slug',
            'course_title',
            'course_progress_percent',
            'completed_lessons_count',
            'total_lessons_count',
            'is_course_completed',
            'just_completed_course',
            'course_completed_at',
            'next_lesson_id',
            'next_lesson_slug',
            'next_lesson_title',
            'xp_awarded',
            'congratulations',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'lesson',
            'user',
            'completed_at',
            'quiz_score',
            'quiz_passed',
            'quiz_attempts_count',
            'quiz_last_submission',
            'created_at',
            'updated_at',
        ]


class LessonProgressUpdateSerializer(serializers.Serializer):
    is_completed = serializers.BooleanField(required=False)
    last_watched_second = serializers.IntegerField(required=False, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True)


class QuizSubmitRequestSerializer(serializers.Serializer):
    answers = serializers.JSONField(
        help_text=(
            "Réponses du membre : dictionnaire {question_id: option_id_ou_liste_d_options} "
            "ou liste [{question_id, selected_options}]."
        )
    )


class CourseEnrollmentSerializer(BaseModelSerializer):
    class Meta:
        model = CourseEnrollment
        fields = [
            'id',
            'course',
            'user',
            'progress_percent',
            'enrolled_at',
            'completed_at',
        ]
        read_only_fields = ['id', 'course', 'user', 'progress_percent', 'enrolled_at', 'completed_at']
