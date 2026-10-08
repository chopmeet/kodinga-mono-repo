from django.db import models
from common.models.base import BaseModel
from apps.communities.models.community import Community


class BillingInterval(models.TextChoices):
    MONTH = 'month', 'Mensuel'
    YEAR = 'year', 'Annuel'
    ONE_TIME = 'one_time', 'Paiement Unique / À vie'


class Plan(BaseModel):
    """
    Subscription and membership plan (Platform Pro or Community-specific).
    Prices are stored in local currency base units (e.g. XOF / FCFA).
    """
    name = models.CharField(max_length=120, db_index=True)
    slug = models.SlugField(max_length=130, unique=True, db_index=True)
    description = models.TextField(blank=True, help_text="Détails du plan et avantages")
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Montant serveur faisant autorité"
    )
    currency = models.CharField(max_length=10, default='XOF', help_text="Code devise (ex: XOF, EUR, USD)")
    billing_interval = models.CharField(
        max_length=20,
        choices=BillingInterval.choices,
        default=BillingInterval.MONTH,
        db_index=True
    )
    interval_count = models.PositiveIntegerField(
        default=1,
        help_text="Nombre d'intervalles (ex: 1 mois, 12 mois)"
    )

    # Optional scoping to a specific Community (for paid community passes)
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subscription_plans',
        help_text="Si null, plan Pro global à la plateforme Kodinga"
    )

    features = models.JSONField(
        default=list,
        blank=True,
        help_text="Liste des fonctionnalités incluses ['Accès aux formations', 'Salons VIP']"
    )
    is_active = models.BooleanField(default=True, db_index=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'billing_plans'
        verbose_name = 'Plan de souscription'
        verbose_name_plural = 'Plans de souscription'
        ordering = ['order', 'price']

    def __str__(self):
        scope = f" ({self.community.name})" if self.community else " (Global)"
        return f"{self.name}{scope} - {int(self.price)} {self.currency}/{self.billing_interval}"
