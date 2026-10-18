from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.communities.models.community import Community
from apps.memberships.models.member import CommunityRole
from common.models.base import BaseModel


class CommunityInvitation(BaseModel):
    """
    Invitation links and email invites to join a community with designated initial role.
    """
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name='invitations',
        db_index=True
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_community_invites',
        db_index=True
    )
    email = models.EmailField(
        blank=True,
        help_text="Optionnel: adresse email ciblée pour une invitation nominative"
    )
    invite_code = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Token d'invitation sécurisé unique"
    )
    role = models.CharField(
        max_length=20,
        choices=CommunityRole.choices,
        default=CommunityRole.MEMBER
    )
    max_uses = models.PositiveIntegerField(
        default=1,
        help_text="Nombre maximum d'utilisations autorisées (1 pour usage unique, >1 pour lien de groupe)"
    )
    uses_count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(db_index=True)
    is_revoked = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'memberships_invitations'
        verbose_name = 'Community Invitation'
        verbose_name_plural = 'Community Invitations'
        ordering = ['-created_at']

    def __str__(self):
        return f"Invite for {self.community.name} ({self.invite_code[:8]}...)"

    @property
    def is_valid(self) -> bool:
        if self.is_revoked:
            return False
        if self.expires_at and timezone.now() > self.expires_at:
            return False
        return not (self.max_uses and self.uses_count >= self.max_uses)
