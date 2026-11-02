import logging

from apps.administration.models.setting import SystemSetting
from apps.billing.models.plan import Plan
from apps.billing.services.billing_service import (
    PRO_MONTHLY_PLAN_SLUG,
    PRO_MONTHLY_PRICE_SETTING_KEY,
    BillingService,
)
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

logger = logging.getLogger('kodinga.billing.signals')


@receiver(post_save, sender=SystemSetting)
def sync_pro_monthly_plan_from_setting(sender, instance: SystemSetting, **kwargs):
    """
    When the Superadmin updates the 'pro_monthly_price' SystemSetting (via Django Admin or API),
    automatically updates the Kodinga Pro Mensuel Plan price in the database.
    Uses QuerySet.update() to prevent infinite signal recursion.
    """
    if instance.key != PRO_MONTHLY_PRICE_SETTING_KEY:
        return

    new_price = BillingService.parse_price_value(instance.value)
    if new_price is None:
        return

    updated = Plan.objects.filter(slug=PRO_MONTHLY_PLAN_SLUG).exclude(price=new_price).update(
        price=new_price,
        updated_at=timezone.now(),
    )
    if updated:
        logger.info(f"[Billing Signals] Updated Plan '{PRO_MONTHLY_PLAN_SLUG}' price to {new_price} XOF from SystemSetting.")


@receiver(post_save, sender=Plan)
def sync_setting_from_pro_monthly_plan(sender, instance: Plan, **kwargs):
    """
    When the Superadmin updates the 'kodinga-pro-monthly' Plan (via Django Admin or API),
    automatically keeps the 'pro_monthly_price' SystemSetting synchronized.
    Uses QuerySet.update() when existing to avoid infinite signal recursion.
    """
    if instance.slug != PRO_MONTHLY_PLAN_SLUG or instance.community_id is not None:
        return

    price_float = float(instance.price)
    existing = SystemSetting.objects.filter(key=PRO_MONTHLY_PRICE_SETTING_KEY).first()
    if existing is not None:
        current_dec = BillingService.parse_price_value(existing.value)
        if current_dec != instance.price:
            SystemSetting.objects.filter(pk=existing.pk).update(
                value=price_float,
                is_public=True,
                updated_at=timezone.now(),
            )
            logger.info(f"[Billing Signals] Synced SystemSetting '{PRO_MONTHLY_PRICE_SETTING_KEY}' to {price_float} XOF from Plan.")
    else:
        SystemSetting.objects.create(
            key=PRO_MONTHLY_PRICE_SETTING_KEY,
            value=price_float,
            description="Montant mensuel de l'abonnement Kodinga Pro (en XOF / FCFA), modifiable par le superadmin.",
            is_public=True,
        )

