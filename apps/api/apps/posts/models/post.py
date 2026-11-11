from django.conf import settings
from django.db import models

from apps.communities.models.community import Community
from apps.media.models.media_asset import MediaAsset
from apps.media.models.video_asset import VideoAsset
from apps.posts.models.category import PostCategory
from common.models.base import BaseModel


class PostType(models.TextChoices):
    DISCUSSION = "discussion", "Discussion"
    QUESTION = "question", "Question / Entraide"
    PROJECT_SHOWCASE = "project_showcase", "Projet Tech"
    POLL = "poll", "Sondage"
    ANNOUNCEMENT = "announcement", "Annonce officielle"


class Post(BaseModel):
    """
    Rich social and technical post published within a community.
    """

    community = models.ForeignKey(
        Community, on_delete=models.CASCADE, related_name="posts", db_index=True
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posts",
        db_index=True,
    )
    category = models.ForeignKey(
        PostCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="posts",
        db_index=True,
    )
    title = models.CharField(max_length=255, blank=True)
    content = models.TextField(help_text="Contenu texte enrichi Markdown")
    post_type = models.CharField(
        max_length=30,
        choices=PostType.choices,
        default=PostType.DISCUSSION,
        db_index=True,
    )

    # Technical Code Block Attachment
    code_snippet = models.TextField(blank=True, help_text="Extrait de code source")
    code_language = models.CharField(
        max_length=50, blank=True, help_text="python, rust, typescript..."
    )

    # Media Attachments (Images & Documents via UploadThing, Videos via Mux)
    media_attachments = models.ManyToManyField(
        MediaAsset, blank=True, related_name="attached_posts"
    )
    video_attachments = models.ManyToManyField(
        VideoAsset, blank=True, related_name="attached_posts"
    )

    # Moderation & State Flags
    is_pinned = models.BooleanField(default=False, db_index=True)
    is_locked = models.BooleanField(
        default=False, help_text="Verrouille les commentaires"
    )
    is_resolved = models.BooleanField(default=False, help_text="Question résolue")

    # Denormalized Metrics
    views_count = models.PositiveIntegerField(default=0)
    reactions_count = models.PositiveIntegerField(default=0, db_index=True)
    comments_count = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        db_table = "posts_posts"
        verbose_name = "Post"
        verbose_name_plural = "Posts"
        ordering = ["-is_pinned", "-created_at"]

    def __str__(self):
        title_display = self.title if self.title else (self.content[:40] + "...")
        return f"{title_display} by {self.author.username}"
