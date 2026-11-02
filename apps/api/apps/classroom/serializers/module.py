from common.serializers.base import BaseModelSerializer
from rest_framework import serializers

from apps.classroom.models.module import CourseModule


class CourseModuleSerializer(BaseModelSerializer):
    class Meta:
        model = CourseModule
        fields = [
            'id',
            'course',
            'title',
            'description',
            'order',
            'lessons_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'course', 'lessons_count', 'created_at', 'updated_at']


class CourseModuleCreateUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    order = serializers.IntegerField(required=False, min_value=0, default=0)


class CourseModuleDetailSerializer(BaseModelSerializer):
    from apps.classroom.serializers.lesson import LessonSerializer
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = CourseModule
        fields = [
            'id',
            'course',
            'title',
            'description',
            'order',
            'lessons_count',
            'lessons',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'course', 'lessons_count', 'lessons', 'created_at', 'updated_at']

