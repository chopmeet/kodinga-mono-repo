from django.contrib import admin
from apps.classroom.models.course import Course
from apps.classroom.models.module import CourseModule
from apps.classroom.models.lesson import Lesson
from apps.classroom.models.progress import CourseEnrollment, LessonProgress


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('title', 'community', 'author', 'level', 'is_published', 'is_sequential', 'order', 'lessons_count', 'created_at')
    list_filter = ('is_published', 'is_sequential', 'level', 'created_at')
    search_fields = ('title', 'slug', 'description', 'community__name')
    prepopulated_fields = {'slug': ('title',)}


@admin.register(CourseModule)
class CourseModuleAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'order', 'lessons_count', 'created_at')
    list_filter = ('course__community', 'created_at')
    search_fields = ('title', 'course__title')


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'module', 'lesson_type', 'duration_seconds', 'order', 'is_free_preview', 'video_asset', 'created_at')
    list_filter = ('lesson_type', 'is_free_preview', 'created_at')
    search_fields = ('title', 'slug', 'module__title', 'module__course__title')


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'lesson', 'is_completed', 'last_watched_second', 'completed_at', 'updated_at')
    list_filter = ('is_completed', 'completed_at')
    search_fields = ('user__username', 'user__email', 'lesson__title')


@admin.register(CourseEnrollment)
class CourseEnrollmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'course', 'progress_percent', 'enrolled_at', 'completed_at')
    list_filter = ('completed_at', 'enrolled_at')
    search_fields = ('user__username', 'user__email', 'course__title')
