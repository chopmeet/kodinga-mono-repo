from apps.projects.models.project import Project
from common.models.base import BaseModel
from django.conf import settings
from django.db import models


class ProjectComment(BaseModel):
    """
    Peer review, feedback or comment on a showcase project.
    """

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="comments",
        db_index=True,
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_comments",
        db_index=True,
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
    )
    content = models.TextField()

    class Meta:
        db_table = "projects_comments"
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment by {self.author.username} on {self.project.title}"
