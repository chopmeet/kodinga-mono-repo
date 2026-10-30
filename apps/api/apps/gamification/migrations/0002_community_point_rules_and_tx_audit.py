import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gamification", "0001_initial"),
        ("communities", "0002_community_telegram_url_community_whatsapp_url_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="reputationtransaction",
            name="reference_type",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Type de l'entité source (course, event, post, comment, badge, manual)",
                max_length=50,
            ),
        ),
        migrations.AddField(
            model_name="reputationtransaction",
            name="reference_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Identifiant de l'activité ou entité ayant généré les points",
                max_length=100,
            ),
        ),
        migrations.AddField(
            model_name="reputationtransaction",
            name="source",
            field=models.CharField(
                choices=[
                    ("automatic", "Attribution automatique"),
                    ("manual_adjustment", "Ajustement manuel"),
                    ("badge_reward", "Récompense de badge"),
                    ("system", "Système"),
                ],
                db_index=True,
                default="automatic",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="reputationtransaction",
            name="awarded_by",
            field=models.ForeignKey(
                blank=True,
                help_text="Propriétaire ou administrateur ayant effectué un ajustement manuel",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="awarded_reputation_transactions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="reputationtransaction",
            name="idempotency_key",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Clé d'idempotence garantissant l'absence de double attribution",
                max_length=255,
                null=True,
                unique=True,
            ),
        ),
        migrations.AlterField(
            model_name="reputationtransaction",
            name="action",
            field=models.CharField(
                choices=[
                    ("course_completed", "Formation terminée (+50)"),
                    ("event_attended", "Participation à un événement (+30)"),
                    ("post_created", "Publication d'un post (feed) (+10)"),
                    ("comment_created", "Commentaire posté (+2)"),
                    ("accepted_answer", "Réponse validée (+15)"),
                    ("lesson_completed", "Leçon terminée (+10)"),
                    ("upvote_received", "Vote positif reçu (+5)"),
                    ("hackathon_submitted", "Projet de hackathon soumis (+40)"),
                    ("badge_unlocked", "Badge débloqué"),
                    ("manual_adjustment", "Ajustement manuel"),
                ],
                db_index=True,
                default="manual_adjustment",
                max_length=50,
            ),
        ),
        migrations.AddIndex(
            model_name="reputationtransaction",
            index=models.Index(
                fields=["community", "user", "-created_at"],
                name="idx_rep_tx_comm_user_date",
            ),
        ),
        migrations.AddIndex(
            model_name="reputationtransaction",
            index=models.Index(
                fields=["community", "action", "reference_id"],
                name="idx_rep_tx_comm_act_ref",
            ),
        ),
        migrations.AddIndex(
            model_name="reputationtransaction",
            index=models.Index(
                fields=["community", "-created_at"],
                name="idx_rep_tx_comm_date",
            ),
        ),
        migrations.CreateModel(
            name="CommunityPointRule",
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
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("course_completed", "Formation terminée (+50)"),
                            ("event_attended", "Participation à un événement (+30)"),
                            ("post_created", "Publication d'un post (feed) (+10)"),
                            ("comment_created", "Commentaire posté (+2)"),
                            ("accepted_answer", "Réponse validée (+15)"),
                            ("lesson_completed", "Leçon terminée (+10)"),
                            ("upvote_received", "Vote positif reçu (+5)"),
                            ("hackathon_submitted", "Projet de hackathon soumis (+40)"),
                            ("badge_unlocked", "Badge débloqué"),
                            ("manual_adjustment", "Ajustement manuel"),
                        ],
                        db_index=True,
                        max_length=50,
                    ),
                ),
                ("label", models.CharField(blank=True, max_length=150)),
                ("description", models.CharField(blank=True, max_length=255)),
                ("points", models.PositiveIntegerField(default=0)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                (
                    "allow_multiple_per_reference",
                    models.BooleanField(
                        default=False,
                        help_text="Si activé, autorise plusieurs attributions pour la même référence d'activité.",
                    ),
                ),
                (
                    "community",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="point_rules",
                        to="communities.community",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="updated_community_point_rules",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Community Point Rule",
                "verbose_name_plural": "Community Point Rules",
                "db_table": "gamification_community_point_rules",
                "ordering": ["action"],
                "unique_together": {("community", "action")},
                "indexes": [
                    models.Index(
                        fields=["community", "action", "is_active"],
                        name="idx_comm_pt_rule_lookup",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="CommunityPointRuleAuditLog",
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
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("course_completed", "Formation terminée (+50)"),
                            ("event_attended", "Participation à un événement (+30)"),
                            ("post_created", "Publication d'un post (feed) (+10)"),
                            ("comment_created", "Commentaire posté (+2)"),
                            ("accepted_answer", "Réponse validée (+15)"),
                            ("lesson_completed", "Leçon terminée (+10)"),
                            ("upvote_received", "Vote positif reçu (+5)"),
                            ("hackathon_submitted", "Projet de hackathon soumis (+40)"),
                            ("badge_unlocked", "Badge débloqué"),
                            ("manual_adjustment", "Ajustement manuel"),
                        ],
                        db_index=True,
                        max_length=50,
                    ),
                ),
                ("previous_points", models.IntegerField(blank=True, null=True)),
                ("new_points", models.IntegerField()),
                ("previous_is_active", models.BooleanField(blank=True, null=True)),
                ("new_is_active", models.BooleanField()),
                ("note", models.CharField(blank=True, max_length=255)),
                (
                    "changed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="point_rule_audit_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "community",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="point_rule_audit_logs",
                        to="communities.community",
                    ),
                ),
                (
                    "rule",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audit_logs",
                        to="gamification.communitypointrule",
                    ),
                ),
            ],
            options={
                "verbose_name": "Community Point Rule Audit Log",
                "verbose_name_plural": "Community Point Rule Audit Logs",
                "db_table": "gamification_point_rule_audit_logs",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["community", "-created_at"],
                        name="idx_pt_rule_audit_comm_date",
                    ),
                ],
            },
        ),
    ]

