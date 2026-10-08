from decimal import Decimal
from unittest.mock import patch
import pytest
from rest_framework import status
from rest_framework.test import APIClient
from apps.accounts.models.user import User
from apps.billing.models.affiliate import Affiliate, AffiliateCommission
from apps.billing.models.payment import Payment, PaymentStatus
from apps.billing.models.plan import BillingInterval, Plan
from apps.billing.models.subscription import Subscription, SubscriptionStatus
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import Community, CommunityPrivacy, CommunityPricing
from apps.communities.models.settings import CommunitySettings
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_alice(db):
    return User.objects.create_user(
        email="alice@kodinga.com",
        username="alicedev",
        password="SecurePassword123!",
        first_name="Alice",
        last_name="Smith"
    )


@pytest.fixture
def user_bob(db):
    return User.objects.create_user(
        email="bob@kodinga.com",
        username="bobdev",
        password="SecurePassword123!",
        first_name="Bob",
        last_name="Johnson"
    )


@pytest.fixture
def affiliate_partner(db):
    user = User.objects.create_user(
        email="affiliate@kodinga.com",
        username="affiliatepro",
        password="SecurePassword123!",
        first_name="Affiliate",
        last_name="Partner"
    )
    return Affiliate.objects.create(
        user=user,
        referral_code="AFFILIATE_2026",
        commission_rate=Decimal('0.50')
    )


@pytest.fixture
def pro_plan(db):
    return Plan.objects.create(
        name="Kodinga Pro Mensuel",
        slug="kodinga-pro-monthly",
        description="Accès illimité aux formations et salons VIP",
        price=Decimal('10000.00'),  # 10 000 XOF
        currency="XOF",
        billing_interval=BillingInterval.MONTH,
        interval_count=1,
        features=["Formations VIP", "Support 24/7"]
    )


@pytest.fixture
def community_plan(db, user_alice):
    cat = CommunityCategory.objects.create(name="Web Dev", slug="webdev")
    comm = Community.objects.create(
        name="React Masters",
        slug="react-masters",
        owner=user_alice,
        category=cat,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.PAID
    )
    CommunitySettings.objects.create(community=comm)
    return Plan.objects.create(
        name="Pass VIP React Masters",
        slug="pass-vip-react-masters",
        description="Accès complet au salon React",
        price=Decimal('5000.00'),
        currency="XOF",
        billing_interval=BillingInterval.MONTH,
        interval_count=1,
        community=comm
    )


@pytest.mark.django_db
class TestPayDunyaBilling:

    @patch('apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice')
    def test_create_checkout_session_success(self, mock_create_invoice, api_client, user_alice, pro_plan):
        mock_create_invoice.return_value = {
            'token': 'sandbox_invoice_token_123',
            'checkout_url': 'https://app.paydunya.com/sandbox-checkout/invoice/sandbox_invoice_token_123',
            'raw_response': {'response_code': '00'}
        }

        api_client.force_authenticate(user=user_alice)
        url = "/api/v1/billing/checkout/"
        payload = {
            "plan_id": str(pro_plan.id),
            "referral_code": "AFFILIATE_2026",
            "return_url": "http://localhost:3000/payment/success",
            "cancel_url": "http://localhost:3000/payment/cancel"
        }

        response = api_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        data = response.data.get("data") or response.data

        assert data["token"] == "sandbox_invoice_token_123"
        assert data["checkout_url"] == "https://app.paydunya.com/sandbox-checkout/invoice/sandbox_invoice_token_123"
        assert Decimal(str(data["amount"])) == pro_plan.price
        assert data["currency"] == "XOF"

        # Verify DB Payment record
        payment = Payment.objects.get(id=data["payment_id"])
        assert payment.user == user_alice
        assert payment.plan == pro_plan
        assert payment.status == PaymentStatus.PENDING
        assert payment.provider_token == "sandbox_invoice_token_123"

    @patch('apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice')
    @patch('apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice')
    def test_ipn_successful_payment_activates_subscription_and_affiliate_commission(
        self, mock_create_invoice, mock_confirm_invoice, api_client, user_alice, affiliate_partner, pro_plan
    ):
        mock_create_invoice.return_value = {
            'token': 'sandbox_token_success_999',
            'checkout_url': 'https://app.paydunya.com/sandbox-checkout/invoice/sandbox_token_success_999',
            'raw_response': {'response_code': '00'}
        }

        # Step 1: User Alice creates checkout session with affiliate referral
        api_client.force_authenticate(user=user_alice)
        res = api_client.post("/api/v1/billing/checkout/", {
            "plan_id": str(pro_plan.id),
            "referral_code": affiliate_partner.referral_code
        }, format="json")
        payment_id = (res.data.get("data") or res.data)["payment_id"]

        # Step 2: PayDunya triggers IPN webhook
        mock_confirm_invoice.return_value = {
            'status': 'completed',
            'receipt_url': 'https://app.paydunya.com/receipt/REC-999',
            'custom_data': {
                'payment_id': str(payment_id),
                'referral_code': affiliate_partner.referral_code
            },
            'invoice': {
                'total_amount': float(pro_plan.price)
            }
        }

        ipn_client = APIClient()  # Unauthenticated server-to-server IPN call
        ipn_response = ipn_client.post("/api/v1/billing/paydunya/ipn/", {
            "data": {"token": "sandbox_token_success_999"}
        }, format="json")

        assert ipn_response.status_code == status.HTTP_200_OK

        # Step 3: Verify Payment status = PAID
        payment = Payment.objects.get(id=payment_id)
        assert payment.status == PaymentStatus.PAID
        assert payment.paid_at is not None
        assert payment.provider_reference == 'https://app.paydunya.com/receipt/REC-999'

        # Step 4: Verify Subscription activated
        subscription = Subscription.objects.filter(user=user_alice, plan=pro_plan).first()
        assert subscription is not None
        assert subscription.status == SubscriptionStatus.ACTIVE
        assert subscription.is_currently_valid is True

        # Step 5: Verify 50% Affiliate commission credited (5,000 XOF on 10,000 XOF payment)
        commission = AffiliateCommission.objects.filter(payment=payment).first()
        assert commission is not None
        assert commission.affiliate == affiliate_partner
        assert commission.referred_user == user_alice
        assert commission.amount == Decimal('5000.00')

        affiliate_partner.refresh_from_db()
        assert affiliate_partner.total_earnings == Decimal('5000.00')
        assert affiliate_partner.balance == Decimal('5000.00')

    @patch('apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice')
    @patch('apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice')
    def test_ipn_idempotency_prevents_duplicate_activation_and_commissions(
        self, mock_create_invoice, mock_confirm_invoice, api_client, user_alice, affiliate_partner, pro_plan
    ):
        mock_create_invoice.return_value = {
            'token': 'sandbox_token_idempotent',
            'checkout_url': 'https://app.paydunya.com/sandbox-checkout/invoice/sandbox_token_idempotent',
            'raw_response': {'response_code': '00'}
        }

        api_client.force_authenticate(user=user_alice)
        res = api_client.post("/api/v1/billing/checkout/", {
            "plan_id": str(pro_plan.id),
            "referral_code": affiliate_partner.referral_code
        }, format="json")
        payment_id = (res.data.get("data") or res.data)["payment_id"]

        mock_confirm_invoice.return_value = {
            'status': 'completed',
            'receipt_url': 'https://app.paydunya.com/receipt/REC-IDEM',
            'custom_data': {
                'payment_id': str(payment_id),
                'referral_code': affiliate_partner.referral_code
            }
        }

        ipn_client = APIClient()
        # Fire IPN notification twice
        ipn_client.post("/api/v1/billing/paydunya/ipn/", {"token": "sandbox_token_idempotent"}, format="json")
        ipn_client.post("/api/v1/billing/paydunya/ipn/", {"token": "sandbox_token_idempotent"}, format="json")

        # Verify only 1 subscription and 1 commission exists
        assert Subscription.objects.filter(user=user_alice, plan=pro_plan).count() == 1
        assert AffiliateCommission.objects.filter(payment_id=payment_id).count() == 1

        affiliate_partner.refresh_from_db()
        assert affiliate_partner.total_earnings == Decimal('5000.00')

    @patch('apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice')
    @patch('apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice')
    def test_ipn_cancelled_payment_does_not_activate_subscription(
        self, mock_create_invoice, mock_confirm_invoice, api_client, user_alice, pro_plan
    ):
        mock_create_invoice.return_value = {
            'token': 'sandbox_token_cancel',
            'checkout_url': 'https://app.paydunya.com/sandbox-checkout/invoice/sandbox_token_cancel',
            'raw_response': {'response_code': '00'}
        }

        api_client.force_authenticate(user=user_alice)
        res = api_client.post("/api/v1/billing/checkout/", {"plan_id": str(pro_plan.id)}, format="json")
        payment_id = (res.data.get("data") or res.data)["payment_id"]

        mock_confirm_invoice.return_value = {
            'status': 'cancelled',
            'custom_data': {'payment_id': str(payment_id)}
        }

        ipn_client = APIClient()
        ipn_client.post("/api/v1/billing/paydunya/ipn/", {"token": "sandbox_token_cancel"}, format="json")

        payment = Payment.objects.get(id=payment_id)
        assert payment.status == PaymentStatus.CANCELLED
        assert Subscription.objects.filter(user=user_alice, plan=pro_plan).count() == 0

    @patch('apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice')
    def test_security_client_controlled_price_manipulation_is_ignored(
        self, mock_create_invoice, api_client, user_alice, pro_plan
    ):
        mock_create_invoice.return_value = {
            'token': 'sandbox_token_secure',
            'checkout_url': 'https://app.paydunya.com/sandbox-checkout/invoice/sandbox_token_secure',
            'raw_response': {'response_code': '00'}
        }

        api_client.force_authenticate(user=user_alice)
        # Attempt to pass fake amount 100 XOF instead of 10000 XOF
        res = api_client.post("/api/v1/billing/checkout/", {
            "plan_id": str(pro_plan.id),
            "amount": 100,
            "price": 100,
            "currency": "EUR"
        }, format="json")

        assert res.status_code == status.HTTP_201_CREATED
        data = res.data.get("data") or res.data
        # Server charged exact plan price
        assert Decimal(str(data["amount"])) == Decimal('10000.00')
        assert data["currency"] == "XOF"

    def test_security_user_cannot_view_other_user_payment_status(self, api_client, user_alice, user_bob, pro_plan):
        # Alice owns payment
        payment_alice = Payment.objects.create(
            user=user_alice,
            plan=pro_plan,
            amount=pro_plan.price,
            status=PaymentStatus.PAID
        )

        # Bob tries to check Alice's payment status
        api_client.force_authenticate(user=user_bob)
        url = f"/api/v1/billing/payments/{payment_alice.id}/status/"
        res = api_client.get(url)

        # Must be 403 Forbidden
        assert res.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]

    @patch('apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice')
    @patch('apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice')
    def test_community_plan_payment_unlocks_community_membership(
        self, mock_create_invoice, mock_confirm_invoice, api_client, user_bob, community_plan
    ):
        mock_create_invoice.return_value = {
            'token': 'sandbox_token_comm',
            'checkout_url': 'https://app.paydunya.com/sandbox-checkout/invoice/sandbox_token_comm',
            'raw_response': {'response_code': '00'}
        }

        # Bob pays for VIP Community pass
        api_client.force_authenticate(user=user_bob)
        res = api_client.post("/api/v1/billing/checkout/", {
            "plan_id": str(community_plan.id)
        }, format="json")
        payment_id = (res.data.get("data") or res.data)["payment_id"]

        mock_confirm_invoice.return_value = {
            'status': 'completed',
            'custom_data': {'payment_id': str(payment_id)}
        }

        # PayDunya IPN confirms payment
        ipn_client = APIClient()
        ipn_client.post("/api/v1/billing/paydunya/ipn/", {"token": "sandbox_token_comm"}, format="json")

        # Bob is now an active member of React Masters community
        membership = CommunityMember.objects.filter(
            community=community_plan.community,
            user=user_bob
        ).first()
        assert membership is not None
        assert membership.status == MembershipStatus.ACTIVE
