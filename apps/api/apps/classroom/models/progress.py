from django.conf import settings
from django.db import models

from apps.classroom.models.course import Course
from apps.classroom.models.lesson import Lesson
from common.models.base import BaseModel


class LessonProgress(BaseModel):
    """
    Per-user progress for an individual lesson (completion and playback position).
    """
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name='progress_records',
        db_index=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='classroom_lesson_progress',
        db_index=True
    )
    is_completed = models.BooleanField(default=False, db_index=True)
    last_watched_second = models.PositiveIntegerField(
        default=0,
        help_text="Position de lecture courante en secondes"
    )
    completed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    notes = models.TextField(blank=True, help_text="Notes personnelles de l'apprenant")

    class Meta:
        db_table = 'classroom_lesson_progress'
        verbose_name = 'Lesson Progress'
        verbose_name_plural = 'Lesson Progress Records'
        unique_together = ('lesson', 'user')
        ordering = ['-updated_at']

    def __str__(self):
        status_txt = "Complété" if self.is_completed else f"{self.last_watched_second}s"
        return f"{self.user.username} - {self.lesson.title} ({status_txt})"


class CourseEnrollment(BaseModel):
    """
    User enrollment in a course and overall progress calculation.
    """
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='enrollments',
        db_index=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='classroom_enrollments',
        db_index=True
    )
    progress_percent = models.FloatField(default=0.0, db_index=True)
    enrolled_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = 'classroom_course_enrollments'
        verbose_name = 'Course Enrollment'
        verbose_name_plural = 'Course Enrollments'
        unique_together = ('course', 'user')
        ordering = ['-enrolled_at']

    def __str__(self):
        return f"{self.user.username} - {self.course.title} ({self.progress_percent:.1f}%)"
