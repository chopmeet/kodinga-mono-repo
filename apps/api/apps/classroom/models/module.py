from common.models.base import BaseModel
from django.db import models

from apps.classroom.models.course import Course


class CourseModule(BaseModel):
    """
    Pedagogical module grouping related lessons inside a Course.
    """
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='modules',
        db_index=True
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    lessons_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'classroom_course_modules'
        verbose_name = 'Course Module'
        verbose_name_plural = 'Course Modules'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.course.title} - Module: {self.title}"
