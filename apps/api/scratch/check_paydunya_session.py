import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from apps.accounts.models.user import User
from apps.billing.models.plan import Plan
from apps.billing.services.billing_service import BillingService
from apps.billing.gateways.paydunya import PayDunyaGateway

def test_paydunya():
    print("=" * 60)
    print("KODINGA - TEST DE L'INTÉGRATION PAYDUNYA (SANDBOX)")
    print("=" * 60)
    
    mode = getattr(settings, 'PAYDUNYA_MODE', 'test')
    master_key = getattr(settings, 'PAYDUNYA_MASTER_KEY', '')
    private_key = getattr(settings, 'PAYDUNYA_PRIVATE_KEY', '')
    token = getattr(settings, 'PAYDUNYA_TOKEN', '')
    
    print(f"Mode         : {mode}")
    print(f"API Base URL : {PayDunyaGateway.get_base_url()}")
    print(f"Master Key   : {master_key[:4]}***{master_key[-4:] if len(master_key) > 8 else ''} (Longueur: {len(master_key)})")
    print(f"Private Key  : {private_key[:4]}***{private_key[-4:] if len(private_key) > 8 else ''} (Longueur: {len(private_key)})")
    print(f"Token        : {token[:4]}***{token[-4:] if len(token) > 8 else ''} (Longueur: {len(token)})")
    print("-" * 60)

    # Check for placeholder keys
    if "test_master_key" in master_key or not master_key:
        print("[ATTENTION] Vos cles dans apps/api/.env semblent etre des valeurs par defaut ou sont vides !")
        print("Veuillez sauvegarder vos veritables cles Sandbox dans apps/api/.env :")
        print("  PAYDUNYA_MASTER_KEY=...")
        print("  PAYDUNYA_PRIVATE_KEY=...")
        print("  PAYDUNYA_PUBLIC_KEY=...")
        print("  PAYDUNYA_TOKEN=...")
        print("-" * 60)

    # Get a paid plan (e.g. Kodinga Pro Mensuel 5000 XOF)
    plan = Plan.objects.filter(price__gt=0, is_active=True).first()
    if not plan:
        print("[ERREUR] Aucun plan actif trouve en base de donnees !")
        return

    # Get or create a test user
    user = User.objects.filter(email="diallofulanisidi@gmail.com").first()
    if not user:
        user = User.objects.first()

    print(f"Utilisateur de test : {user.email} (ID: {user.id})")
    print(f"Plan selectionne    : {plan.name} - {plan.price} {plan.currency}")
    print("-" * 60)
    print("Tentative d'initialisation de session PayDunya Checkout...")

    try:
        payment, checkout_url = BillingService.create_checkout_session(
            user=user,
            plan_id=str(plan.id),
            return_url="http://localhost:3000/payment/success",
            cancel_url="http://localhost:3000/payment/cancel"
        )
        print("\n[SUCCÈS] Session PayDunya creee avec succes !")
        print(f"Payment ID   : {payment.id}")
        print(f"Token        : {payment.provider_token}")
        print(f"Checkout URL : {checkout_url}")
        print("\nVous pouvez ouvrir cette URL dans votre navigateur pour tester le paiement PayDunya !")
    except Exception as e:
        print(f"\n[ECHEC] Erreur lors de l'appel PayDunya : {e}")

if __name__ == '__main__':
    test_paydunya()
