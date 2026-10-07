from django.conf import settings
from django.db import models
from common.models.base import BaseModel
from apps.media.models.media_asset import MediaAsset
from apps.posts.models.post import Post


class Comment(BaseModel):
    """
    Hierarchical / threaded comment and answer attached to a post.
    """
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='comments',
        db_index=True
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='post_comments',
        db_index=True
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies',
        db_index=True
    )
    content = models.TextField()
    media_attachments = models.ManyToManyField(
        MediaAsset,
        blank=True,
        related_name='attached_comments'
    )
    is_accepted_answer = models.BooleanField(
        default=False,
        help_text="Marqué comme réponse acceptée pour les questions d'entraide"
    )
    reactions_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'posts_comments'
        verbose_name = 'Comment'
        verbose_name_plural = 'Comments'
        ordering = ['-is_accepted_answer', 'created_at']

    def __str__(self):
        return f"Comment by {self.author.username} on {self.post_id}"
