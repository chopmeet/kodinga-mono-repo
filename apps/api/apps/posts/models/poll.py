from django.conf import settings
from django.db import models
from django.utils import timezone
from common.models.base import BaseModel
from apps.posts.models.post import Post


class Poll(BaseModel):
    """
    Interactive poll embedded within a post.
    """
    post = models.OneToOneField(
        Post,
        on_delete=models.CASCADE,
        related_name='poll',
        db_index=True
    )
    question = models.CharField(max_length=255)
    is_multiple_choice = models.BooleanField(default=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    total_votes = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'posts_polls'
        verbose_name = 'Poll'
        verbose_name_plural = 'Polls'

    def __str__(self):
        return f"Poll: {self.question}"

    @property
    def is_expired(self) -> bool:
        return bool(self.expires_at and timezone.now() > self.expires_at)


class PollOption(BaseModel):
    """
    Individual choice within a poll.
    """
    poll = models.ForeignKey(
        Poll,
        on_delete=models.CASCADE,
        related_name='options',
        db_index=True
    )
    text = models.CharField(max_length=200)
    votes_count = models.PositiveIntegerField(default=0)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'posts_poll_options'
        verbose_name = 'Poll Option'
        verbose_name_plural = 'Poll Options'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.text} ({self.votes_count} votes)"

    @property
    def percentage(self) -> float:
        if not self.poll.total_votes:
            return 0.0
        return round((self.votes_count / self.poll.total_votes) * 100, 1)


class PollVote(BaseModel):
    """
    User vote tracking for a poll option.
    """
    option = models.ForeignKey(
        PollOption,
        on_delete=models.CASCADE,
        related_name='votes',
        db_index=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='poll_votes',
        db_index=True
    )

    class Meta:
        db_table = 'posts_poll_votes'
        verbose_name = 'Poll Vote'
        verbose_name_plural = 'Poll Votes'
        unique_together = ('option', 'user')

    def __str__(self):
        return f"{self.user.username} voted on {self.option.text}"
