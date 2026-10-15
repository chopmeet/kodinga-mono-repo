from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.billing.models.plan import Plan, BillingInterval

PLANS_DATA = [
    {
        "name": "Kodinga Hobby",
        "slug": "kodinga-hobby",
        "description": "Formule gratuite pour découvrir la plateforme, explorer les communautés et échanger.",
        "price": Decimal("0.00"),
        "currency": "XOF",
        "billing_interval": BillingInterval.MONTH,
        "interval_count": 1,
        "features": [
            "Accès aux communautés gratuites",
            "Profil développeur public",
            "Participation aux salons et discussions publiques",
            "Création de communautés gratuites (selon autorisation)"
        ],
        "order": 0,
        "is_active": True,
    },
    {
        "name": "Kodinga Pro Mensuel",
        "slug": "kodinga-pro-monthly",
        "description": "Formule Pro officielle : monétisation de vos communautés et accès illimité.",
        "price": Decimal("5000.00"),  # 5 000 FCFA / mois
        "currency": "XOF",
        "billing_interval": BillingInterval.MONTH,
        "interval_count": 1,
        "features": [
            "Création et monétisation de communautés payantes (abonnements mensuels ou définitifs)",
            "Accès illimité aux formations exclusives et salons VIP",
            "Badge Pro vérifié sur le profil",
            "Salons vocaux et vidéo LiveKit haute qualité",
            "Support prioritaire"
        ],
        "order": 1,
        "is_active": True,
    },
    {
        "name": "Kodinga Pro Annuel",
        "slug": "kodinga-pro-yearly",
        "description": "Formule Pro annuelle avec 2 mois offerts (50 000 FCFA/an au lieu de 60 000 FCFA).",
        "price": Decimal("50000.00"),  # 50 000 FCFA / an
        "currency": "XOF",
        "billing_interval": BillingInterval.YEAR,
        "interval_count": 1,
        "features": [
            "Tous les avantages du forfait Pro Mensuel",
            "Économisez 10 000 FCFA (2 mois offerts)",
            "Certificats de complétion vérifiés",
            "Mise en avant prioritaire de vos communautés dans l'annuaire"
        ],
        "order": 2,
        "is_active": True,
    },
    {
        "name": "Kodinga Pro Lifetime",
        "slug": "kodinga-pro-lifetime",
        "description": "Accès Pro à vie en paiement unique définitif.",
        "price": Decimal("150000.00"),  # 150 000 FCFA paiement unique
        "currency": "XOF",
        "billing_interval": BillingInterval.ONE_TIME,
        "interval_count": 1,
        "features": [
            "Tous les avantages Pro à vie sans réabonnement",
            "Badge Fondateur VIP exclusif",
            "Accès prioritaire aux futures innovations de la plateforme"
        ],
        "order": 3,
        "is_active": True,
    },
]


class Command(BaseCommand):
    help = "Seed standard subscription plans (Hobby gratuit, Pro 5000 FCFA/mois, Annuel, Lifetime)."

    def handle(self, *args, **options):
        self.stdout.write("Seeding billing plans (Hobby & Pro)...")
        created_count = 0
        updated_count = 0

        for plan_dict in PLANS_DATA:
            plan, created = Plan.objects.update_or_create(
                slug=plan_dict["slug"],
                defaults=plan_dict,
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  + Created: {plan.name} ({plan.price} {plan.currency})"))
            else:
                updated_count += 1
                self.stdout.write(self.style.WARNING(f"  ~ Updated: {plan.name} ({plan.price} {plan.currency})"))

        self.stdout.write(
            self.style.SUCCESS(
                f"\nPlans seeding completed! Total: {len(PLANS_DATA)} | Created: {created_count} | Updated: {updated_count}"
            )
        )

        from apps.administration.models.setting import SystemSetting
        setting, s_created = SystemSetting.objects.get_or_create(
            key="community_creation_allowed_for",
            defaults={
                "value": "all",
                "description": "Qui peut créer une communauté ('all' pour Hobby et Pro, 'pro_only' pour Pro uniquement).",
                "is_public": True
            }
        )
        if s_created:
            self.stdout.write(self.style.SUCCESS("  + Created SystemSetting: community_creation_allowed_for = 'all'"))
        else:
            self.stdout.write(f"  * Existing SystemSetting: community_creation_allowed_for = '{setting.value}'")
