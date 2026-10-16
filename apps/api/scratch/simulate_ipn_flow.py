import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from unittest.mock import patch
from apps.accounts.models.user import User
from apps.billing.models.plan import Plan
from apps.billing.models.payment import Payment, PaymentStatus
from apps.billing.models.subscription import Subscription, SubscriptionStatus
from apps.billing.services.billing_service import BillingService

def simulate_full_flow():
    print("=" * 65)
    print("SIMULATION DU FLUX COMPLET PAYDUNYA (LOCAL / OFFLINE)")
    print("=" * 65)

    user = User.objects.filter(email="diallofulanisidi@gmail.com").first() or User.objects.first()
    plan = Plan.objects.filter(slug="kodinga-pro-monthly").first()

    print(f"Utilisateur : {user.username} ({user.email})")
    print(f"Plan        : {plan.name} - {plan.price} {plan.currency}")

    # 1. Simuler l'initialisation de Checkout (création de facture PayDunya)
    mock_token = f"sandbox_simulated_token_{user.id.hex[:6]}"
    with patch("apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice") as mock_create:
        mock_create.return_value = {
            "token": mock_token,
            "checkout_url": f"https://app.paydunya.com/sandbox-checkout/invoice/{mock_token}",
            "raw_response": {"response_code": "00"}
        }
        
        payment, checkout_url = BillingService.create_checkout_session(
            user=user,
            plan_id=str(plan.id)
        )
        print(f"\n[ÉTAPE 1] Session Checkout générée :")
        print(f"  - Payment ID : {payment.id}")
        print(f"  - Statut     : {payment.status}")
        print(f"  - Token      : {payment.provider_token}")
        print(f"  - URL        : {checkout_url}")

    # 2. Simuler la confirmation IPN de PayDunya (webhook serveur à serveur)
    with patch("apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice") as mock_confirm:
        mock_confirm.return_value = {
            "status": "completed",
            "receipt_url": f"https://app.paydunya.com/receipt/REC-SIMULATED-2026",
            "custom_data": {
                "payment_id": str(payment.id),
                "user_id": str(user.id),
                "plan_id": str(plan.id),
            },
            "invoice": {"total_amount": float(plan.price)}
        }

        print(f"\n[ÉTAPE 2] Réception du Webhook IPN PayDunya (Token={mock_token})...")
        updated_payment = BillingService.process_paydunya_ipn(token=mock_token)

        print(f"\n[ÉTAPE 3] Résultat après traitement IPN :")
        print(f"  - Payment Statut : {updated_payment.status} (Attendu: PAID)")
        print(f"  - Reçu PayDunya  : {updated_payment.provider_reference}")
        print(f"  - Date paiement  : {updated_payment.paid_at}")

        # Vérifier l'abonnement
        sub = Subscription.objects.filter(user=user, plan=plan, status=SubscriptionStatus.ACTIVE).first()
        if sub:
            print(f"\n[SUCCÈS] Abonnement actif validé :")
            print(f"  - Subscription ID : {sub.id}")
            print(f"  - Valide jusqu'au : {sub.current_period_end}")
            print(f"  - Statut actif ?  : {sub.is_currently_valid}")
        else:
            print("\n[ERREUR] Aucun abonnement actif trouvé !")

    print("\n" + "=" * 65)

if __name__ == '__main__':
    simulate_full_flow()
