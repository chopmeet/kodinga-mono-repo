from django.urls import path
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

app_name = 'classroom'

urlpatterns = [
    # Courses
    path(
        'communities/<str:slug>/courses/',
        CommunityCourseListView.as_view(),
        name='community_courses_list'
    ),
    path(
        'communities/<str:slug>/courses/<str:course_slug>/',
        CommunityCourseDetailView.as_view(),
        name='community_course_detail'
    ),
    path(
        'communities/<str:slug>/courses/<str:course_slug>/enroll/',
        CourseEnrollView.as_view(),
        name='community_course_enroll'
    ),

    # Modules
    path(
        'communities/<str:slug>/courses/<str:course_slug>/modules/',
        CourseModuleListView.as_view(),
        name='course_modules_list'
    ),
    path(
        'communities/<str:slug>/courses/<str:course_slug>/modules/<uuid:module_id>/',
        CourseModuleDetailView.as_view(),
        name='course_module_detail'
    ),

    # Lessons
    path(
        'communities/<str:slug>/courses/<str:course_slug>/lessons/',
        CourseLessonListView.as_view(),
        name='course_lessons_direct_create'
    ),
    path(
        'communities/<str:slug>/courses/<str:course_slug>/modules/<uuid:module_id>/lessons/',
        CourseLessonListView.as_view(),
        name='course_lessons_list'
    ),
    path(
        'communities/<str:slug>/courses/<str:course_slug>/lessons/<uuid:lesson_id>/',
        CourseLessonDetailView.as_view(),
        name='course_lesson_detail'
    ),

    # Progress & Completion
    path(
        'communities/<str:slug>/courses/<str:course_slug>/lessons/<uuid:lesson_id>/progress/',
        LessonProgressView.as_view(),
        name='lesson_progress'
    ),
]
