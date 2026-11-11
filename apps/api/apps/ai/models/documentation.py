from django.db import models

from common.models.base import BaseModel


class DocumentationCategory(models.TextChoices):
    GENERAL = "general", "Présentation générale"
    FEATURES = "features", "Fonctionnalités"
    USER_GUIDE = "user_guide", "Guide utilisateur"
    COMMUNITIES = "communities", "Création et gestion des communautés"
    RULES = "rules", "Règles de fonctionnement"
    BILLING = "billing", "Abonnements et paiements"
    ROLES_PERMISSIONS = "roles_permissions", "Rôles et permissions"
    TUTORIALS = "tutorials", "Tutoriels"
    FAQ = "faq", "Foire aux questions (FAQ)"
    TROUBLESHOOTING = "troubleshooting", "Dépannage et support"


class PlatformDocumentation(BaseModel):
    """
    SOURCE A: Official Kodinga platform documentation for RAG.
    Each active document is indexed and consulted to answer platform questions.
    """

    title = models.CharField(max_length=255, db_index=True)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    category = models.CharField(
        max_length=50,
        choices=DocumentationCategory.choices,
        default=DocumentationCategory.GENERAL,
        db_index=True,
    )
    content = models.TextField(help_text="Contenu exhaustif officiel en Markdown")
    summary = models.TextField(
        blank=True,
        default="",
        help_text="Résumé synthétique pour recherche rapide",
    )
    keywords = models.JSONField(
        default=list,
        blank=True,
        help_text="Mots-clés pertinents pour matching lexical",
    )
    version = models.CharField(max_length=20, default="1.0.0")
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Les documents inactifs ou obsolètes ne doivent jamais être utilisés par l'IA",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Métadonnées supplémentaires (ex: liens d'action, routes frontend associées)",
    )

    class Meta:
        db_table = "ai_platform_documentation"
        verbose_name = "Documentation Officielle Plateforme"
        verbose_name_plural = "Documentations Officielles Plateforme"
        ordering = ["category", "title"]
        indexes = [
            models.Index(fields=["is_active", "category"]),
            models.Index(fields=["slug"]),
        ]

    def __str__(self) -> str:
        status_str = "Actif" if self.is_active else "Obsolète/Inactif"
        return f"[{self.category}] {self.title} (v{self.version} - {status_str})"
