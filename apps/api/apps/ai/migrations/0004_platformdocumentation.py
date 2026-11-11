import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("ai", "0003_communityweeklydigest_memberchurnrisk_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlatformDocumentation",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        help_text="Unique identifier (UUID v4).",
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        db_index=True,
                        help_text="Timestamp when the record was created.",
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(
                        auto_now=True,
                        help_text="Timestamp when the record was last modified.",
                    ),
                ),
                ("title", models.CharField(db_index=True, max_length=255)),
                ("slug", models.SlugField(max_length=255, unique=True)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("general", "Présentation générale"),
                            ("features", "Fonctionnalités"),
                            ("user_guide", "Guide utilisateur"),
                            ("communities", "Création et gestion des communautés"),
                            ("rules", "Règles de fonctionnement"),
                            ("billing", "Abonnements et paiements"),
                            ("roles_permissions", "Rôles et permissions"),
                            ("tutorials", "Tutoriels"),
                            ("faq", "Foire aux questions (FAQ)"),
                            ("troubleshooting", "Dépannage et support"),
                        ],
                        db_index=True,
                        default="general",
                        max_length=50,
                    ),
                ),
                (
                    "content",
                    models.TextField(
                        help_text="Contenu exhaustif officiel en Markdown"
                    ),
                ),
                (
                    "summary",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text="Résumé synthétique pour recherche rapide",
                    ),
                ),
                (
                    "keywords",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Mots-clés pertinents pour matching lexical",
                    ),
                ),
                ("version", models.CharField(default="1.0.0", max_length=20)),
                (
                    "is_active",
                    models.BooleanField(
                        db_index=True,
                        default=True,
                        help_text="Les documents inactifs ou obsolètes ne doivent jamais être utilisés par l'IA",
                    ),
                ),
                (
                    "metadata",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Métadonnées supplémentaires (ex: liens d'action, routes frontend associées)",
                    ),
                ),
            ],
            options={
                "verbose_name": "Documentation Officielle Plateforme",
                "verbose_name_plural": "Documentations Officielles Plateforme",
                "db_table": "ai_platform_documentation",
                "ordering": ["category", "title"],
                "indexes": [
                    models.Index(
                        fields=["is_active", "category"],
                        name="ai_platform_is_acti_idx",
                    ),
                    models.Index(
                        fields=["slug"],
                        name="ai_platform_slug_idx",
                    ),
                ],
            },
        ),
    ]
