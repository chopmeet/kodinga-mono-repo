from django.conf import settings
from django.db import models
from common.models.base import BaseModel
from apps.communities.models.community import Community
from apps.memberships.models.member import CommunityMember


class SanctionType(models.TextChoices):
    WARNING = 'warning', 'Avertissement'
    MUTE = 'mute', 'Sourdine temporaire'
    SUSPENSION = 'suspension', 'Suspension temporaire'
    BAN = 'ban', 'Bannissement définitif'


class MemberSanction(BaseModel):
    """
    Moderation sanctions and audit trail applied to community members.
    """
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name='sanctions',
        db_index=True
    )
    member = models.ForeignKey(
        CommunityMember,
        on_delete=models.CASCADE,
        related_name='sanctions',
        db_index=True
    )
    sanction_type = models.CharField(
        max_length=20,
        choices=SanctionType.choices,
        db_index=True
    )
    reason = models.TextField(help_text="Motif de la sanction")
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='issued_sanctions'
    )
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = 'memberships_sanctions'
        verbose_name = 'Member Sanction'
        verbose_name_plural = 'Member Sanctions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sanction_type} - {self.member.user.username} ({self.community.name})"
