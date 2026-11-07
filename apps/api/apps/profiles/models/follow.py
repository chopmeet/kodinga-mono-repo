from django.conf import settings
from django.db import models

from common.models.base import BaseModel


class UserFollow(BaseModel):
    """
    Represents a developer following another developer on the platform.
    """
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="following_relationships",
        db_index=True,
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="follower_relationships",
        db_index=True,
    )

    class Meta:
        db_table = "profiles_user_follows"
        unique_together = ("follower", "following")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["follower", "created_at"]),
            models.Index(fields=["following", "created_at"]),
        ]

    def __str__(self):
        return f"{self.follower.username} -> {self.following.username}"

