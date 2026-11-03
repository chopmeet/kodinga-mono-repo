from django.db import models

from common.models.base import BaseModel


class ContentEmbedding(BaseModel):
    """
    Stores vector embeddings for platform content (posts, lessons, event replays)
    to power sub-200ms semantic search, RAG, and live duplicate question detection.
    """

    CONTENT_TYPE_CHOICES = [
        ("post", "Post / Discussion"),
        ("lesson", "Leçon de formation"),
        ("event", "Événement / Replay"),
    ]

    content_type = models.CharField(
        max_length=30,
        choices=CONTENT_TYPE_CHOICES,
        db_index=True,
        help_text="Type de ressource indexée",
    )
    object_id = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Identifiant UUID de l'objet indexé",
    )
    community = models.ForeignKey(
        "communities.Community",
        on_delete=models.CASCADE,
        related_name="ai_embeddings",
        db_index=True,
    )
    title = models.CharField(
        max_length=255,
        help_text="Titre ou résumé court de la ressource",
    )
    embedding = models.JSONField(
        default=list,
        help_text="Vecteur de floats normalisé (dimension 768 ou 1536)",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Métadonnées utiles (auteur, extrait textuel, tags, is_solved)",
    )

    class Meta:
        db_table = "ai_content_embeddings"
        verbose_name = "Empreinte vectorielle"
        verbose_name_plural = "Empreintes vectorielles"
        indexes = [
            models.Index(fields=["community", "content_type"]),
            models.Index(fields=["object_id"]),
        ]

    def __str__(self) -> str:
        return f"[{self.content_type}] {self.title} ({self.community.slug})"

