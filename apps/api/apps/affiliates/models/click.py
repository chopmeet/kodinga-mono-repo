from django.db import models

from apps.affiliates.models.link import AffiliateLink
from common.models.base import BaseModel


class AffiliateClick(BaseModel):
    """
    Log of each click on an affiliate referral link.
    """

    link = models.ForeignKey(
        AffiliateLink,
        on_delete=models.CASCADE,
        related_name="clicks",
        db_index=True,
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    referrer = models.URLField(max_length=1000, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "affiliate_clicks"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Click on {self.link.code} at {self.created_at}"
