from apps.classroom.views.course import (
    CommunityCourseDetailView,
    CommunityCourseListView,
    CourseEnrollView,
)
from apps.classroom.views.lesson import (
    CourseLessonDetailView,
    CourseLessonListView,
)
from apps.classroom.views.module import (
    CourseModuleDetailView,
    CourseModuleListView,
)
from apps.classroom.views.progress import LessonProgressView

__all__ = [
    'CommunityCourseListView',
    'CommunityCourseDetailView',
    'CourseEnrollView',
    'CourseModuleListView',
    'CourseModuleDetailView',
    'CourseLessonListView',
    'CourseLessonDetailView',
    'LessonProgressView',
]
