from django.conf import settings
from django.db import models

from apps.posts.models.post import Post
from common.models.base import BaseModel


class PostBookmark(BaseModel):
    """
    Bookmark / saved post for a user.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="post_bookmarks",
        db_index=True,
    )
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name="bookmarks", db_index=True
    )

    class Meta:
        db_table = "posts_post_bookmarks"
        verbose_name = "Post sauvegardé"
        verbose_name_plural = "Posts sauvegardés"
        unique_together = ("user", "post")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} saved {self.post_id}"
