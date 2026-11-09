import hashlib
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.billing.models.affiliate import Affiliate, AffiliateCommission
from apps.billing.models.payment import Payment, PaymentStatus
from apps.billing.models.plan import BillingInterval, Plan
from apps.billing.models.subscription import Subscription, SubscriptionStatus
from apps.billing.models.wallet import CommunityWallet
from apps.billing.tasks import check_and_expire_subscriptions
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.communities.models.settings import CommunitySettings
from apps.memberships.models.member import (
    CommunityMember,
    MembershipStatus,
)


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
        last_name="Smith",
    )


@pytest.fixture
def user_bob(db):
    return User.objects.create_user(
        email="bob@kodinga.com",
        username="bobdev",
        password="SecurePassword123!",
        first_name="Bob",
        last_name="Johnson",
    )


@pytest.fixture
def affiliate_partner(db):
    user = User.objects.create_user(
        email="affiliate@kodinga.com",
        username="affiliatepro",
        password="SecurePassword123!",
        first_name="Affiliate",
        last_name="Partner",
    )
    return Affiliate.objects.create(
        user=user, referral_code="AFFILIATE_2026", commission_rate=Decimal("0.50")
    )


@pytest.fixture
def pro_plan(db):
    return Plan.objects.create(
        name="Kodinga Pro Mensuel",
        slug="kodinga-pro-monthly",
        description="Accès illimité aux formations et salons VIP",
        price=Decimal("10000.00"),  # 10 000 XOF
        currency="XOF",
        billing_interval=BillingInterval.MONTH,
        interval_count=1,
        features=["Formations VIP", "Support 24/7"],
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
        pricing_type=CommunityPricing.PAID,
    )
    CommunitySettings.objects.create(community=comm)
    return Plan.objects.create(
        name="Pass VIP React Masters",
        slug="pass-vip-react-masters",
        description="Accès complet au salon React",
        price=Decimal("5000.00"),
        currency="XOF",
        billing_interval=BillingInterval.MONTH,
        interval_count=1,
        community=comm,
    )


@pytest.mark.django_db
class TestPayDunyaBilling:
    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice")
    def test_create_checkout_session_success(
        self, mock_create_invoice, api_client, user_alice, pro_plan
    ):
        mock_create_invoice.return_value = {
            "token": "sandbox_invoice_token_123",
            "checkout_url": "https://app.paydunya.com/sandbox-checkout/invoice/sandbox_invoice_token_123",
            "raw_response": {"response_code": "00"},
        }

        api_client.force_authenticate(user=user_alice)
        url = "/api/v1/billing/checkout/"
        payload = {
            "plan_id": str(pro_plan.id),
            "referral_code": "AFFILIATE_2026",
            "return_url": "http://localhost:3000/payment/success",
            "cancel_url": "http://localhost:3000/payment/cancel",
        }

        response = api_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        data = response.data.get("data") or response.data

        assert data["token"] == "sandbox_invoice_token_123"
        assert (
            data["checkout_url"]
            == "https://app.paydunya.com/sandbox-checkout/invoice/sandbox_invoice_token_123"
        )
        assert Decimal(str(data["amount"])) == pro_plan.price
        assert data["currency"] == "XOF"

        # Verify DB Payment record
        payment = Payment.objects.get(id=data["payment_id"])
        assert payment.user == user_alice
        assert payment.plan == pro_plan
        assert payment.status == PaymentStatus.PENDING
        assert payment.provider_token == "sandbox_invoice_token_123"

    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice")
    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice")
    def test_ipn_successful_payment_activates_subscription_and_affiliate_commission(
        self,
        mock_create_invoice,
        mock_confirm_invoice,
        api_client,
        user_alice,
        affiliate_partner,
        pro_plan,
    ):
        mock_create_invoice.return_value = {
            "token": "sandbox_token_success_999",
            "checkout_url": "https://app.paydunya.com/sandbox-checkout/invoice/sandbox_token_success_999",
            "raw_response": {"response_code": "00"},
        }

        # Step 1: User Alice creates checkout session with affiliate referral
        api_client.force_authenticate(user=user_alice)
        res = api_client.post(
            "/api/v1/billing/checkout/",
            {
                "plan_id": str(pro_plan.id),
                "referral_code": affiliate_partner.referral_code,
            },
            format="json",
        )
        payment_id = (res.data.get("data") or res.data)["payment_id"]

        # Step 2: PayDunya triggers IPN webhook
        mock_confirm_invoice.return_value = {
            "status": "completed",
            "receipt_url": "https://app.paydunya.com/receipt/REC-999",
            "custom_data": {
                "payment_id": str(payment_id),
                "referral_code": affiliate_partner.referral_code,
            },
            "invoice": {"total_amount": float(pro_plan.price)},
        }

        ipn_client = APIClient()  # Unauthenticated server-to-server IPN call
        ipn_response = ipn_client.post(
            "/api/v1/billing/paydunya/ipn/",
            {"data": {"token": "sandbox_token_success_999"}},
            format="json",
        )

        assert ipn_response.status_code == status.HTTP_200_OK

        # Step 3: Verify Payment status = PAID
        payment = Payment.objects.get(id=payment_id)
        assert payment.status == PaymentStatus.PAID
        assert payment.paid_at is not None
        assert payment.provider_reference == "https://app.paydunya.com/receipt/REC-999"

        # Step 4: Verify Subscription activated
        subscription = Subscription.objects.filter(
            user=user_alice, plan=pro_plan
        ).first()
        assert subscription is not None
        assert subscription.status == SubscriptionStatus.ACTIVE
        assert subscription.is_currently_valid is True

        # Step 5: Verify 50% Affiliate commission credited
        # (5,000 XOF on 10,000 XOF payment)
        commission = AffiliateCommission.objects.filter(payment=payment).first()
        assert commission is not None
        assert commission.affiliate == affiliate_partner
        assert commission.referred_user == user_alice
        assert commission.amount == Decimal("5000.00")

        affiliate_partner.refresh_from_db()
        assert affiliate_partner.total_earnings == Decimal("5000.00")
        assert affiliate_partner.balance == Decimal("5000.00")

    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice")
    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice")
    def test_ipn_idempotency_prevents_duplicate_activation_and_commissions(
        self,
        mock_create_invoice,
        mock_confirm_invoice,
        api_client,
        user_alice,
        affiliate_partner,
        pro_plan,
    ):
        mock_create_invoice.return_value = {
            "token": "sandbox_token_idempotent",
            "checkout_url": "https://app.paydunya.com/sandbox-checkout/invoice/sandbox_token_idempotent",
            "raw_response": {"response_code": "00"},
        }

        api_client.force_authenticate(user=user_alice)
        res = api_client.post(
            "/api/v1/billing/checkout/",
            {
                "plan_id": str(pro_plan.id),
                "referral_code": affiliate_partner.referral_code,
            },
            format="json",
        )
        payment_id = (res.data.get("data") or res.data)["payment_id"]

        mock_confirm_invoice.return_value = {
            "status": "completed",
            "receipt_url": "https://app.paydunya.com/receipt/REC-IDEM",
            "custom_data": {
                "payment_id": str(payment_id),
                "referral_code": affiliate_partner.referral_code,
            },
        }

        ipn_client = APIClient()
        # Fire IPN notification twice
        ipn_client.post(
            "/api/v1/billing/paydunya/ipn/",
            {"token": "sandbox_token_idempotent"},
            format="json",
        )
        ipn_client.post(
            "/api/v1/billing/paydunya/ipn/",
            {"token": "sandbox_token_idempotent"},
            format="json",
        )

        # Verify only 1 subscription and 1 commission exists
        assert Subscription.objects.filter(user=user_alice, plan=pro_plan).count() == 1
        assert AffiliateCommission.objects.filter(payment_id=payment_id).count() == 1

        affiliate_partner.refresh_from_db()
        assert affiliate_partner.total_earnings == Decimal("5000.00")

    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice")
    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice")
    def test_ipn_cancelled_payment_does_not_activate_subscription(
        self,
        mock_create_invoice,
        mock_confirm_invoice,
        api_client,
        user_alice,
        pro_plan,
    ):
        mock_create_invoice.return_value = {
            "token": "sandbox_token_cancel",
            "checkout_url": "https://app.paydunya.com/sandbox-checkout/invoice/sandbox_token_cancel",
            "raw_response": {"response_code": "00"},
        }

        api_client.force_authenticate(user=user_alice)
        res = api_client.post(
            "/api/v1/billing/checkout/", {"plan_id": str(pro_plan.id)}, format="json"
        )
        payment_id = (res.data.get("data") or res.data)["payment_id"]

        mock_confirm_invoice.return_value = {
            "status": "cancelled",
            "custom_data": {"payment_id": str(payment_id)},
        }

        ipn_client = APIClient()
        ipn_client.post(
            "/api/v1/billing/paydunya/ipn/",
            {"token": "sandbox_token_cancel"},
            format="json",
        )

        payment = Payment.objects.get(id=payment_id)
        assert payment.status == PaymentStatus.CANCELLED
        assert Subscription.objects.filter(user=user_alice, plan=pro_plan).count() == 0

    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice")
    def test_security_client_controlled_price_manipulation_is_ignored(
        self, mock_create_invoice, api_client, user_alice, pro_plan
    ):
        mock_create_invoice.return_value = {
            "token": "sandbox_token_secure",
            "checkout_url": "https://app.paydunya.com/sandbox-checkout/invoice/sandbox_token_secure",
            "raw_response": {"response_code": "00"},
        }

        api_client.force_authenticate(user=user_alice)
        # Attempt to pass fake amount 100 XOF instead of 10000 XOF
        res = api_client.post(
            "/api/v1/billing/checkout/",
            {
                "plan_id": str(pro_plan.id),
                "amount": 100,
                "price": 100,
                "currency": "EUR",
            },
            format="json",
        )

        assert res.status_code == status.HTTP_201_CREATED
        data = res.data.get("data") or res.data
        # Server charged exact plan price
        assert Decimal(str(data["amount"])) == Decimal("10000.00")
        assert data["currency"] == "XOF"

    def test_security_user_cannot_view_other_user_payment_status(
        self, api_client, user_alice, user_bob, pro_plan
    ):
        # Alice owns payment
        payment_alice = Payment.objects.create(
            user=user_alice,
            plan=pro_plan,
            amount=pro_plan.price,
            status=PaymentStatus.PAID,
        )

        # Bob tries to check Alice's payment status
        api_client.force_authenticate(user=user_bob)
        url = f"/api/v1/billing/payments/{payment_alice.id}/status/"
        res = api_client.get(url)

        # Must be 403 Forbidden
        assert res.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]

    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice")
    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice")
    def test_community_plan_payment_unlocks_community_membership(
        self,
        mock_create_invoice,
        mock_confirm_invoice,
        api_client,
        user_bob,
        community_plan,
    ):
        mock_create_invoice.return_value = {
            "token": "sandbox_token_comm",
            "checkout_url": "https://app.paydunya.com/sandbox-checkout/invoice/sandbox_token_comm",
            "raw_response": {"response_code": "00"},
        }

        # Bob pays for VIP Community pass
        api_client.force_authenticate(user=user_bob)
        res = api_client.post(
            "/api/v1/billing/checkout/",
            {"plan_id": str(community_plan.id)},
            format="json",
        )
        payment_id = (res.data.get("data") or res.data)["payment_id"]

        mock_confirm_invoice.return_value = {
            "status": "completed",
            "custom_data": {"payment_id": str(payment_id)},
        }

        # PayDunya IPN confirms payment
        ipn_client = APIClient()
        ipn_client.post(
            "/api/v1/billing/paydunya/ipn/",
            {"token": "sandbox_token_comm"},
            format="json",
        )

        # Bob is now an active member of React Masters community
        membership = CommunityMember.objects.filter(
            community=community_plan.community, user=user_bob
        ).first()
        assert membership is not None
        assert membership.status == MembershipStatus.ACTIVE

    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice")
    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice")
    def test_ipn_form_urlencoded_with_data_invoice_token_and_sha512_hash(
        self,
        mock_create_invoice,
        mock_confirm_invoice,
        api_client,
        user_alice,
        pro_plan,
        settings,
    ):
        mock_create_invoice.return_value = {
            "token": "token_form_urlencoded_123",
            "checkout_url": "https://app.paydunya.com/invoice/token_form_urlencoded_123",
            "raw_response": {"response_code": "00"},
        }

        api_client.force_authenticate(user=user_alice)
        res = api_client.post(
            "/api/v1/billing/checkout/",
            {"plan_id": str(pro_plan.id)},
            format="json",
        )
        payment_id = (res.data.get("data") or res.data)["payment_id"]

        mock_confirm_invoice.return_value = {
            "status": "completed",
            "receipt_url": "https://app.paydunya.com/receipt/REC-FORM",
            "custom_data": {"payment_id": str(payment_id)},
            "invoice": {"total_amount": float(pro_plan.price)},
        }

        settings.PAYDUNYA_MASTER_KEY = "test_paydunya_master_key_12345"
        master_key = settings.PAYDUNYA_MASTER_KEY
        correct_hash = hashlib.sha512(master_key.encode("utf-8")).hexdigest()

        ipn_client = APIClient()

        # Step 1: Bad hash should be rejected with 400
        bad_hash_res = ipn_client.post(
            "/api/v1/billing/paydunya/ipn/",
            data={
                "data[invoice][token]": "token_form_urlencoded_123",
                "data[hash]": "invalid_sha512_hash",
            },
            format="multipart",
        )
        assert bad_hash_res.status_code == status.HTTP_400_BAD_REQUEST

        # Step 2: Valid form-urlencoded IPN with data[invoice][token] and valid SHA-512 hash
        good_res = ipn_client.post(
            "/api/v1/billing/paydunya/ipn/",
            data={
                "data[invoice][token]": "token_form_urlencoded_123",
                "data[hash]": correct_hash,
            },
            format="multipart",
        )
        assert good_res.status_code == status.HTTP_200_OK

        payment = Payment.objects.get(id=payment_id)
        assert payment.status == PaymentStatus.PAID
        assert payment.paid_at is not None

    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice")
    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice")
    def test_ipn_or_polling_pending_status_maintains_pending(
        self,
        mock_create_invoice,
        mock_confirm_invoice,
        api_client,
        user_alice,
        pro_plan,
    ):
        mock_create_invoice.return_value = {
            "token": "token_pending_flow",
            "checkout_url": "https://app.paydunya.com/invoice/token_pending_flow",
            "raw_response": {"response_code": "00"},
        }

        api_client.force_authenticate(user=user_alice)
        res = api_client.post(
            "/api/v1/billing/checkout/",
            {"plan_id": str(pro_plan.id)},
            format="json",
        )
        payment_id = (res.data.get("data") or res.data)["payment_id"]

        # PayDunya transaction is still pending / in progress
        mock_confirm_invoice.return_value = {
            "status": "pending",
            "custom_data": {"payment_id": str(payment_id)},
        }

        # User return page polls status
        status_res = api_client.get(f"/api/v1/billing/payments/{payment_id}/status/")
        assert status_res.status_code == status.HTTP_200_OK
        data = status_res.data.get("data") or status_res.data
        assert data["status"] == PaymentStatus.PENDING

        # Verify DB payment is STILL PENDING (not erroneously marked FAILED)
        payment = Payment.objects.get(id=payment_id)
        assert payment.status == PaymentStatus.PENDING

        # Now payment completes on PayDunya side
        mock_confirm_invoice.return_value = {
            "status": "completed",
            "receipt_url": "https://app.paydunya.com/receipt/REC-LATER",
            "custom_data": {"payment_id": str(payment_id)},
        }
        second_poll = api_client.get(f"/api/v1/billing/payments/{payment_id}/status/")
        assert second_poll.status_code == status.HTTP_200_OK
        data2 = second_poll.data.get("data") or second_poll.data
        assert data2["status"] == PaymentStatus.PAID

    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice")
    def test_referral_code_forwarded_to_gateway_and_persisted(
        self,
        mock_create_invoice,
        api_client,
        user_alice,
        pro_plan,
        affiliate_partner,
    ):
        mock_create_invoice.return_value = {
            "token": "token_ref_check",
            "checkout_url": "https://app.paydunya.com/invoice/token_ref_check",
            "raw_response": {"response_code": "00"},
        }

        api_client.force_authenticate(user=user_alice)
        res = api_client.post(
            "/api/v1/billing/checkout/",
            {
                "plan_id": str(pro_plan.id),
                "referral_code": affiliate_partner.referral_code,
            },
            format="json",
        )
        assert res.status_code == status.HTTP_201_CREATED
        payment_id = (res.data.get("data") or res.data)["payment_id"]

        # 1. Check referral_code persisted in Payment model
        payment = Payment.objects.get(id=payment_id)
        assert payment.referral_code == affiliate_partner.referral_code

        # 2. Check create_checkout_invoice was called with referral_code
        mock_create_invoice.assert_called_once()
        call_kwargs = mock_create_invoice.call_args.kwargs
        assert call_kwargs.get("referral_code") == affiliate_partner.referral_code

    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice")
    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.create_checkout_invoice")
    def test_community_platform_fee_and_creator_wallet_split(
        self,
        mock_create_invoice,
        mock_confirm_invoice,
        api_client,
        user_bob,
        community_plan,
    ):
        mock_create_invoice.return_value = {
            "token": "token_wallet_split",
            "checkout_url": "https://app.paydunya.com/invoice/token_wallet_split",
            "raw_response": {"response_code": "00"},
        }

        api_client.force_authenticate(user=user_bob)
        res = api_client.post(
            "/api/v1/billing/checkout/",
            {"plan_id": str(community_plan.id)},
            format="json",
        )
        payment_id = (res.data.get("data") or res.data)["payment_id"]

        mock_confirm_invoice.return_value = {
            "status": "completed",
            "receipt_url": "https://app.paydunya.com/receipt/REC-WALLET",
            "custom_data": {"payment_id": str(payment_id)},
            "invoice": {"total_amount": float(community_plan.price)},
        }

        ipn_client = APIClient()
        ipn_client.post(
            "/api/v1/billing/paydunya/ipn/",
            {"data": {"invoice": {"token": "token_wallet_split"}}},
            format="json",
        )

        # Community plan price is 5000 XOF
        # 10% platform fee = 500 XOF, 90% net creator = 4500 XOF
        payment = Payment.objects.get(id=payment_id)
        assert payment.status == PaymentStatus.PAID
        assert payment.platform_fee == Decimal("500.00")
        assert payment.net_amount == Decimal("4500.00")

        # Verify CommunityWallet
        wallet = CommunityWallet.objects.get(community=community_plan.community)
        assert wallet.total_gross == Decimal("5000.00")
        assert wallet.total_platform_fees == Decimal("500.00")
        assert wallet.total_net == Decimal("4500.00")
        assert wallet.available_balance == Decimal("4500.00")

    def test_cancel_subscription_endpoint(self, api_client, user_alice, pro_plan):
        now = timezone.now()
        sub = Subscription.objects.create(
            user=user_alice,
            plan=pro_plan,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            cancel_at_period_end=False,
        )

        api_client.force_authenticate(user=user_alice)
        res = api_client.post(f"/api/v1/billing/subscriptions/{sub.id}/cancel/")
        assert res.status_code == status.HTTP_200_OK

        sub.refresh_from_db()
        assert sub.cancel_at_period_end is True
        assert sub.canceled_at is not None
        assert sub.is_currently_valid is True  # still valid until period_end

    def test_expired_subscription_task_suspends_community_member(
        self, user_alice, user_bob, community_plan
    ):
        now = timezone.now()
        # Bob's subscription has expired in the past
        sub_bob = Subscription.objects.create(
            user=user_bob,
            plan=community_plan,
            community=community_plan.community,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now - timedelta(days=60),
            current_period_end=now - timedelta(days=1),  # Expired yesterday
        )
        # Bob is currently an active member
        member_bob = CommunityMember.objects.create(
            community=community_plan.community,
            user=user_bob,
            status=MembershipStatus.ACTIVE,
        )

        # Alice (community owner) also has a member record
        member_alice = CommunityMember.objects.create(
            community=community_plan.community,
            user=user_alice,
            status=MembershipStatus.ACTIVE,
        )

        # Execute expiration task
        results = check_and_expire_subscriptions()
        assert results["expired_subscriptions"] >= 1

        sub_bob.refresh_from_db()
        assert sub_bob.status == SubscriptionStatus.EXPIRED

        member_bob.refresh_from_db()
        assert member_bob.status == MembershipStatus.SUSPENDED

        # Alice (owner) should never be suspended
        member_alice.refresh_from_db()
        assert member_alice.status == MembershipStatus.ACTIVE

    def test_creator_endpoints_subscribers_transactions_revenue_and_payout(
        self, api_client, user_alice, user_bob, community_plan
    ):
        community = community_plan.community
        now = timezone.now()

        # Create wallet with funds for community
        wallet, _ = CommunityWallet.objects.get_or_create(
            community=community,
            defaults={
                "total_gross": Decimal("10000.00"),
                "total_platform_fees": Decimal("1000.00"),
                "total_net": Decimal("9000.00"),
                "available_balance": Decimal("9000.00"),
            },
        )
        wallet.total_gross = Decimal("10000.00")
        wallet.total_platform_fees = Decimal("1000.00")
        wallet.total_net = Decimal("9000.00")
        wallet.available_balance = Decimal("9000.00")
        wallet.save()

        # Create active subscription for Bob
        sub = Subscription.objects.create(
            user=user_bob,
            plan=community_plan,
            community=community,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
        )

        # Create paid transaction
        Payment.objects.create(
            user=user_bob,
            plan=community_plan,
            subscription=sub,
            amount=Decimal("5000.00"),
            platform_fee=Decimal("500.00"),
            net_amount=Decimal("4500.00"),
            status=PaymentStatus.PAID,
            paid_at=now,
        )

        # 1. Subscribers endpoint (Alice is owner)
        api_client.force_authenticate(user=user_alice)
        res_sub = api_client.get(
            f"/api/v1/billing/communities/{community.slug}/subscribers/"
        )
        assert res_sub.status_code == status.HTTP_200_OK
        subs_data = res_sub.data.get("data") or res_sub.data
        assert len(subs_data) == 1
        assert subs_data[0]["user"]["username"] == user_bob.username

        # 2. Transactions endpoint
        res_tx = api_client.get(
            f"/api/v1/billing/communities/{community.slug}/transactions/"
        )
        assert res_tx.status_code == status.HTTP_200_OK
        tx_data = res_tx.data.get("data") or res_tx.data
        assert len(tx_data) == 1
        assert Decimal(str(tx_data[0]["platform_fee"])) == Decimal("500.00")
        assert Decimal(str(tx_data[0]["net_amount"])) == Decimal("4500.00")

        # 3. Revenue overview & chart endpoint
        res_rev = api_client.get(
            f"/api/v1/billing/communities/{community.slug}/revenue/"
        )
        assert res_rev.status_code == status.HTTP_200_OK
        rev_data = res_rev.data.get("data") or res_rev.data
        assert Decimal(str(rev_data["available_balance"])) == Decimal("9000.00")
        assert len(rev_data["monthly_revenue"]) >= 1

        # 4. Request payout
        payout_res = api_client.post(
            f"/api/v1/billing/communities/{community.slug}/payouts/",
            {
                "amount": "3000.00",
                "payment_method": "wave",
                "account_identifier": "+221771234567",
                "account_name": "Alice Smith",
            },
            format="json",
        )
        assert payout_res.status_code == status.HTTP_201_CREATED

        # Available balance should be deducted (9000 - 3000 = 6000)
        wallet.refresh_from_db()
        assert wallet.available_balance == Decimal("6000.00")

        # 5. Security: Bob (not owner) is forbidden from viewing financials
        api_client.force_authenticate(user=user_bob)
        sec_res = api_client.get(
            f"/api/v1/billing/communities/{community.slug}/revenue/"
        )
        assert sec_res.status_code == status.HTTP_403_FORBIDDEN

    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.confirm_invoice")
    def test_verify_payment_endpoint_reconciles_and_activates_access(
        self,
        mock_confirm_invoice,
        api_client,
        user_alice,
        community_plan,
    ):
        """
        Verify that POST /api/v1/billing/payments/<payment_id>/verify/ directly
        reconciles with PayDunya, handles outer joins properly without Postgres lock error,
        marks the payment PAID, and activates subscription and community membership.
        """
        community = community_plan.community
        payment = Payment.objects.create(
            user=user_alice,
            plan=community_plan,
            amount=community_plan.price,
            currency="XOF",
            status=PaymentStatus.PENDING,
            provider="paydunya",
            provider_token="test_token_verify_endpoint",
        )

        mock_confirm_invoice.return_value = {
            "response_code": "00",
            "status": "completed",
            "receipt_url": "https://paydunya.com/receipt.pdf",
            "custom_data": {"payment_id": str(payment.id)},
        }

        api_client.force_authenticate(user=user_alice)
        res = api_client.post(f"/api/v1/billing/payments/{payment.id}/verify/")

        assert res.status_code == status.HTTP_200_OK
        data = res.data.get("data") or res.data
        assert data["status"] == "PAID"
        assert data["is_paid"] is True

        payment.refresh_from_db()
        assert payment.status == PaymentStatus.PAID
        assert payment.subscription is not None
        assert payment.subscription.status == SubscriptionStatus.ACTIVE

        member = CommunityMember.objects.filter(
            community=community, user=user_alice
        ).first()
        assert member is not None
        assert member.status == MembershipStatus.ACTIVE
        assert member.role == "member"
