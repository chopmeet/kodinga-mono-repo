from django.conf import settings
from django.db import models

from apps.posts.models.comment import Comment
from apps.posts.models.post import Post
from common.models.base import BaseModel


class ReactionType(models.TextChoices):
    LIKE = "like", "👍 Like"
    FIRE = "fire", "🔥 Fire"
    ROCKET = "rocket", "🚀 Rocket"
    HEART = "heart", "❤️ Heart"
    EYES = "eyes", "👀 Eyes"
    THINKING = "thinking", "💡 Insightful"
    UNICORN = "unicorn", "🦄 Unicorn"


class PostReaction(BaseModel):
    """
    Emoji reaction applied to a post.
    """

    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name="reactions", db_index=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="post_reactions",
        db_index=True,
    )
    reaction_type = models.CharField(
        max_length=20,
        choices=ReactionType.choices,
        default=ReactionType.LIKE,
        db_index=True,
    )

    class Meta:
        db_table = "posts_post_reactions"
        verbose_name = "Post Reaction"
        verbose_name_plural = "Post Reactions"
        unique_together = ("post", "user", "reaction_type")

    def __str__(self):
        return f"{self.user.username} reacted {self.reaction_type} on {self.post_id}"


class CommentReaction(BaseModel):
    """
    Emoji reaction applied to a comment.
    """

    comment = models.ForeignKey(
        Comment, on_delete=models.CASCADE, related_name="reactions", db_index=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comment_reactions",
        db_index=True,
    )
    reaction_type = models.CharField(
        max_length=20,
        choices=ReactionType.choices,
        default=ReactionType.LIKE,
        db_index=True,
    )

    class Meta:
        db_table = "posts_comment_reactions"
        verbose_name = "Comment Reaction"
        verbose_name_plural = "Comment Reactions"
        unique_together = ("comment", "user", "reaction_type")

    def __str__(self):
        return f"{self.user.username} reacted {self.reaction_type} on comment {self.comment_id}"
