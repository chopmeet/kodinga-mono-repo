import secrets
import string
from decimal import Decimal
from django.conf import settings
from django.db import models

from apps.affiliates.models.program import AffiliateProgram
from common.models.base import BaseModel


def generate_affiliate_code(length=8):
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class AffiliateLink(BaseModel):
    """
    Tracking link for an affiliate developer/creator.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="affiliate_links",
        db_index=True,
    )
    program = models.ForeignKey(
        AffiliateProgram,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="links",
    )
    code = models.CharField(
        max_length=64,
        unique=True,
        default=generate_affiliate_code,
        db_index=True,
    )
    custom_slug = models.SlugField(max_length=100, blank=True, null=True, unique=True)
    target_url = models.URLField(max_length=1000, blank=True, default="")

    clicks_count = models.PositiveIntegerField(default=0)
    conversions_count = models.PositiveIntegerField(default=0)
    total_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=10, default="XOF")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "affiliate_links"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Link {self.custom_slug or self.code} by {self.user.username}"
