from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F, Sum

from apps.billing.models.payment import Payment, PaymentStatus
from apps.billing.models.wallet import CommunityPayout, CommunityWallet, PayoutStatus
from apps.communities.models.community import Community


class Command(BaseCommand):
    help = "Recalcule et réconcilie les soldes des portefeuilles de communautés (net = 100% de l'abonnement reçu)."

    def handle(self, *args, **options):
        with transaction.atomic():
            # 1. Mettre à jour les anciens paiements de communautés pour que net_amount = amount et platform_fee = 0
            updated_payments = Payment.objects.filter(
                plan__community__isnull=False,
                status=PaymentStatus.PAID,
            ).update(
                platform_fee=Decimal("0.00"),
                net_amount=F("amount"),
            )
            self.stdout.write(f"Mise à jour de {updated_payments} paiement(s) de communautés.")

            # Pour chaque communauté avec un portefeuille
            for community in Community.objects.all():
                paid_payments = Payment.objects.filter(
                    plan__community=community,
                    status=PaymentStatus.PAID,
                )
                gross = paid_payments.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

                # Payouts
                processed_payouts = CommunityPayout.objects.filter(
                    community=community,
                    status=PayoutStatus.PROCESSED,
                )
                withdrawn = processed_payouts.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

                pending_payouts = CommunityPayout.objects.filter(
                    community=community,
                    status__in=[PayoutStatus.PENDING, PayoutStatus.APPROVED],
                )
                reserved = pending_payouts.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

                available = gross - withdrawn - reserved
                if available < Decimal("0.00"):
                    available = Decimal("0.00")

                wallet, _ = CommunityWallet.objects.get_or_create(community=community)
                wallet.total_gross = gross
                wallet.total_platform_fees = Decimal("0.00")
                wallet.total_net = gross
                wallet.withdrawn_amount = withdrawn
                wallet.available_balance = available
                wallet.save()

                self.stdout.write(
                    f"Communauté '{community.name}' : Brut={gross} FCFA, Net={gross} FCFA, "
                    f"Déjà reversé={withdrawn} FCFA, Solde disponible={available} FCFA"
                )

        self.stdout.write(self.style.SUCCESS("Réconciliation des portefeuilles terminée avec succès."))
