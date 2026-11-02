from django.conf import settings
from django.db import models

from common.models.base import BaseModel


class SystemSetting(BaseModel):
    """
    Platform-wide global settings and feature flags dynamically managed by superadmins.
    """
    key = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Clé unique du paramètre (ex: 'maintenance_mode', 'allow_user_registration')."
    )
    value = models.JSONField(
        default=dict,
        help_text="Valeur structurée JSON du paramètre."
    )
    description = models.TextField(
        blank=True,
        help_text="Description fonctionnelle du rôle de ce paramètre."
    )
    is_public = models.BooleanField(
        default=False,
        help_text="Indique si le paramètre est accessible publiquement via l'API."
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_system_settings',
        help_text="Dernier administrateur ayant modifié ce paramètre."
    )

    class Meta:
        verbose_name = "Paramètre système"
        verbose_name_plural = "Paramètres système"
        ordering = ['key']

    def __str__(self) -> str:
        return f"{self.key}: {self.value}"
