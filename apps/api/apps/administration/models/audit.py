from django.conf import settings
from django.db import models
from common.models.base import BaseModel


class PlatformAuditLog(BaseModel):
    """
    Tracks critical administrative actions and governance events across the Kodinga platform.
    """
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='platform_audit_logs',
        help_text="Administrateur ou utilisateur ayant initié l'action."
    )
    action = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Type d'action administrative (ex: 'user.suspend', 'user.promote_admin', 'system.toggle_maintenance')."
    )
    target_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Type d'entité ciblée (ex: 'user', 'community', 'course', 'system')."
    )
    target_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Identifiant de l'entité ciblée (UUID ou slug)."
    )
    details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Détails contextuels supplémentaires (raisons, payload modifié, etc.)."
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="Adresse IP cliente lors de l'action."
    )
    user_agent = models.CharField(
        max_length=255,
        blank=True,
        help_text="User agent du navigateur ou client d'administration."
    )

    class Meta:
        verbose_name = "Journal d'audit plateforme"
        verbose_name_plural = "Journaux d'audit plateforme"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['action', 'created_at'], name='audit_action_time_idx'),
            models.Index(fields=['target_type', 'target_id'], name='audit_target_idx'),
        ]

    def __str__(self) -> str:
        actor_name = self.actor.username if self.actor else "Système"
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {actor_name} -> {self.action} on {self.target_type}:{self.target_id}"
