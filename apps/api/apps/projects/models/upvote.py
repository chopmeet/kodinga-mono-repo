from django.conf import settings
from django.db import models

from apps.projects.models.project import Project
from common.models.base import BaseModel


class ProjectUpvote(BaseModel):
    """
    Upvote / appreciation on a showcase project.
    """

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="upvotes",
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_upvotes",
        db_index=True,
    )

    class Meta:
        db_table = "projects_upvotes"
        unique_together = ("project", "user")

    def __str__(self):
        return f"{self.user.username} upvoted {self.project.title}"
