from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.communities.models.community import Community
from apps.memberships.models.member import CommunityRole
from common.models.base import BaseModel


class InvitationStatus(models.TextChoices):
    PENDING = 'pending', 'En attente'
    ACCEPTED = 'accepted', 'Acceptée'
    REVOKED = 'revoked', 'Révoquée'
    EXPIRED = 'expired', 'Expirée'


class CommunityInvitation(BaseModel):
    """
    Invitation links and email invites to join a community with designated initial role.
    Securely stores only SHA-256 token hash; raw token is only sent in the email.
    """
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name='invitations',
        db_index=True
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_community_invites',
        db_index=True
    )
    email = models.EmailField(
        blank=True,
        db_index=True,
        help_text="Adresse email ciblée pour une invitation nominative (normalisée en minuscules)"
    )
    token_hash = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        default='',
        help_text="Empreinte SHA-256 du token cryptographique unique"
    )
    invite_code = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text="Champ legacy pour rétrocompatibilité"
    )
    role = models.CharField(
        max_length=20,
        choices=CommunityRole.choices,
        default=CommunityRole.MEMBER
    )
    status = models.CharField(
        max_length=20,
        choices=InvitationStatus.choices,
        default=InvitationStatus.PENDING,
        db_index=True
    )
    max_uses = models.PositiveIntegerField(
        default=1,
        help_text="Nombre maximum d'utilisations autorisées (1 pour usage unique, >1 pour lien de groupe)"
    )
    uses_count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(db_index=True)
    accepted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = 'memberships_invitations'
        verbose_name = 'Invitation de collaborateur'
        verbose_name_plural = 'Invitations de collaborateurs'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['community', 'email'],
                condition=models.Q(status='pending') & ~models.Q(email=''),
                name='unique_pending_invitation_per_workspace'
            )
        ]
        indexes = [
            models.Index(fields=['community', 'email', 'status'], name='idx_invite_comm_email_status'),
            models.Index(fields=['status', 'expires_at'], name='idx_invite_status_expires'),
        ]

    def clean(self):
        super().clean()
        if self.email:
            self.email = self.email.strip().lower()

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        target = self.email or "Lien de groupe"
        return f"Invite for {self.community.name} ({target} - {self.status})"

    @property
    def is_revoked(self) -> bool:
        return self.status == InvitationStatus.REVOKED

    @is_revoked.setter
    def is_revoked(self, value: bool):
        if value:
            self.status = InvitationStatus.REVOKED

    @property
    def is_valid(self) -> bool:
        if self.status != InvitationStatus.PENDING:
            return False
        if self.expires_at and timezone.now() > self.expires_at:
            return False
        return not (self.max_uses and self.uses_count >= self.max_uses)

