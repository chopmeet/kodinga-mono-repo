from decimal import Decimal
from django.db import models

from apps.communities.models.community import Community
from common.models.base import BaseModel


class AffiliateProgram(BaseModel):
    """
    Affiliate/referral program configuration (global or community-specific).
    """

    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="affiliate_programs",
    )
    name = models.CharField(max_length=255)
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("50.00"),
        help_text="Taux de commission en pourcentage (ex: 50.00 pour 50%).",
    )
    cookie_days = models.PositiveIntegerField(
        default=30,
        help_text="Durée de validité du cookie de parrainage en jours.",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "affiliate_programs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.commission_rate}%)"
