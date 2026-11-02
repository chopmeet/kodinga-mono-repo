from apps.communities.models.community import Community
from common.models.base import BaseModel
from django.conf import settings
from django.db import models


class CommunityRole(models.TextChoices):
    OWNER = 'owner', 'Propriétaire / Créateur'
    ADMIN = 'admin', 'Administrateur'
    MODERATOR = 'moderator', 'Modérateur'
    MEMBER = 'member', 'Membre'


class MembershipStatus(models.TextChoices):
    ACTIVE = 'active', 'Actif'
    PENDING = 'pending', 'En attente d’approbation'
    REJECTED = 'rejected', 'Refusé'
    SUSPENDED = 'suspended', 'Suspendu'
    BANNED = 'banned', 'Banni'
    LEFT = 'left', 'A quitté la communauté'


class CommunityMember(BaseModel):
    """
    Multi-tenant relationship linking a User to a specific Community with granular RBAC.
    """
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name='memberships',
        db_index=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='community_memberships',
        db_index=True
    )
    role = models.CharField(
        max_length=20,
        choices=CommunityRole.choices,
        default=CommunityRole.MEMBER,
        db_index=True
    )
    status = models.CharField(
        max_length=20,
        choices=MembershipStatus.choices,
        default=MembershipStatus.ACTIVE,
        db_index=True
    )
    custom_title = models.CharField(
        max_length=100,
        blank=True,
        help_text="Titre personnalisé dans la communauté (ex: Core Maintainer, Mentor Python)"
    )
    joined_at = models.DateTimeField(auto_now_add=True, db_index=True)
    reputation_score = models.PositiveIntegerField(
        default=0,
        help_text="Points de réputation accumulés au sein de cette communauté"
    )
    notifications_enabled = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Active ou désactive la réception des notifications pour cette communauté (cloche)"
    )

    class Meta:
        db_table = 'memberships_community_members'
        verbose_name = 'Membre de communauté'
        verbose_name_plural = 'Membres de communautés'
        unique_together = ('community', 'user')
        ordering = ['-joined_at']

    def __str__(self):
        return f"{self.user.username} - {self.community.name} ({self.get_role_display()})"

    @property
    def is_owner(self) -> bool:
        return self.role == CommunityRole.OWNER

    @property
    def is_admin(self) -> bool:
        return self.role in [CommunityRole.OWNER, CommunityRole.ADMIN]

    @property
    def is_moderator(self) -> bool:
        return self.role in [CommunityRole.OWNER, CommunityRole.ADMIN, CommunityRole.MODERATOR]

    @property
    def is_active_member(self) -> bool:
        return self.status == MembershipStatus.ACTIVE
