from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.classroom.models.progress import CourseEnrollment, LessonProgress


class LessonProgressSerializer(BaseModelSerializer):
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
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'lesson', 'user', 'completed_at', 'created_at', 'updated_at']


class LessonProgressUpdateSerializer(serializers.Serializer):
    is_completed = serializers.BooleanField(required=False)
    last_watched_second = serializers.IntegerField(required=False, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True)


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
