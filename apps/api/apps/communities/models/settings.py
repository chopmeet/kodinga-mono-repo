from django.db import models

from apps.communities.models.community import Community
from common.models.base import BaseModel


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
    is_read_only = models.BooleanField(
        default=False,
        help_text="Mode lecture seule : seuls le propriétaire et les modérateurs/administrateurs peuvent publier ou envoyer des messages."
    )
    enabled_features = models.JSONField(
        default=dict,
        blank=True,
        help_text="Activation modulaire des fonctionnalités (feed, classroom, events, chat, leaderboard)"
    )

    # AI Features & Governance Configuration
    ai_translation_enabled = models.BooleanField(
        default=True,
        help_text="Activer la traduction automatique multilingue (Wolof, Bambara, Français, Anglais)"
    )
    default_community_language = models.CharField(
        max_length=10,
        default='fr',
        help_text="Langue principale par défaut de la communauté"
    )
    supported_languages = models.JSONField(
        default=list,
        blank=True,
        help_text="Liste des langues prises en charge dans la communauté"
    )
    target_languages = models.JSONField(
        default=list,
        blank=True,
        help_text="Liste des langues cibles proposées aux membres"
    )
    non_mandatory_moderation = models.JSONField(
        default=dict,
        blank=True,
        help_text="Règles de modération optionnelles (ex: profanity, spam, self_promotion)"
    )
    moderation_strictness = models.CharField(
        max_length=20,
        default='standard',
        help_text="Sensibilité de modération pour les catégories optionnelles (relaxed, standard, strict)"
    )
    sentiment_analytics_enabled = models.BooleanField(
        default=True,
        help_text="Activer l'analyse de sentiment globale et anonymisée"
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
        if not self.supported_languages:
            self.supported_languages = ['fr', 'en', 'wo', 'bm']
        if not self.target_languages:
            self.target_languages = ['fr', 'en', 'wo', 'bm']
        super().save(*args, **kwargs)
