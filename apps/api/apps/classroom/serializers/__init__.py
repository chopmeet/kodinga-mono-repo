from apps.classroom.serializers.course import (
    CourseCreateUpdateSerializer,
    CourseDetailSerializer,
    CourseModuleNestedSerializer,
    CourseSerializer,
)
from apps.classroom.serializers.lesson import (
    LessonCreateUpdateSerializer,
    LessonDetailSerializer,
    LessonSerializer,
)
from apps.classroom.serializers.module import (
    CourseModuleCreateUpdateSerializer,
    CourseModuleSerializer,
)
from apps.classroom.serializers.progress import (
    CourseEnrollmentSerializer,
    LessonProgressSerializer,
    LessonProgressUpdateSerializer,
)

__all__ = [
    'CourseSerializer',
    'CourseDetailSerializer',
    'CourseModuleNestedSerializer',
    'CourseCreateUpdateSerializer',
    'CourseModuleSerializer',
    'CourseModuleCreateUpdateSerializer',
    'LessonSerializer',
    'LessonDetailSerializer',
    'LessonCreateUpdateSerializer',
    'LessonProgressSerializer',
    'LessonProgressUpdateSerializer',
    'CourseEnrollmentSerializer',
]
