from django.db import models
from common.models.base import BaseModel
from apps.communities.models.community import Community


class PostPermissionType(models.TextChoices):
    ALL_MEMBERS = 'all_members', 'Tous les membres actifs'
    MODERATORS_ONLY = 'moderators_only', 'Modérateurs et administrateurs uniquement'
    ADMINS_ONLY = 'admins_only', 'Administrateurs uniquement'


class CommunitySettings(BaseModel):
    """
    Configuration, permissions policy, and feature toggles for a community.
    """
    community = models.OneToOneField(
        Community,
        on_delete=models.CASCADE,
        related_name='settings',
        db_index=True
    )
    allow_member_invites = models.BooleanField(
        default=True,
        help_text="Permet aux membres standards de générer des liens d'invitation"
    )
    require_approval_to_join = models.BooleanField(
        default=False,
        help_text="Les demandes d'adhésion doivent être validées manuellement par les modérateurs"
    )
    welcome_message = models.TextField(
        blank=True,
        help_text="Message affiché aux nouveaux membres lors de leur première arrivée"
    )
    default_post_permission = models.CharField(
        max_length=30,
        choices=PostPermissionType.choices,
        default=PostPermissionType.ALL_MEMBERS
    )
    enabled_features = models.JSONField(
        default=dict,
        blank=True,
        help_text="Activation modulaire des fonctionnalités (feed, classroom, events, chat, leaderboard)"
    )

    class Meta:
        db_table = 'communities_settings'
        verbose_name = 'Community Settings'
        verbose_name_plural = 'Community Settings'

    def __str__(self):
        return f"Settings for {self.community.name}"

    @classmethod
    def get_default_features(cls) -> dict:
        return {
            'feed': True,
            'classroom': True,
            'events': True,
            'chat': True,
            'leaderboard': True,
            'projects': True,
        }

    def save(self, *args, **kwargs):
        if not self.enabled_features:
            self.enabled_features = self.get_default_features()
        super().save(*args, **kwargs)
