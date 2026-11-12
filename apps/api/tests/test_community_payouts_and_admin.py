from decimal import Decimal
from unittest.mock import patch

import pytest
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.billing.gateways.paydunya import PayDunyaAPIException
from apps.billing.models.wallet import CommunityWallet, PayoutStatus
from apps.billing.services.payout_service import (
    MIN_PAYOUT_AMOUNT,
    PAYOUT_FEE_RATE,
    PayoutService,
)
from apps.communities.models.community import (
    Community,
    CommunityCategory,
    CommunityPricing,
)


@pytest.fixture
def creator_user(db):
    return User.objects.create_user(
        username="creator_john",
        email="john@example.com",
        password="Password123!",
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        username="other_user",
        email="other@example.com",
        password="Password123!",
    )


@pytest.fixture
def admin_user(db):
    user = User.objects.create_user(
        username="superadmin_sarah",
        email="admin@example.com",
        password="Password123!",
    )
    user.is_superuser = True
    user.is_staff = True
    user.save()
    return user


@pytest.fixture
def test_category(db):
    return CommunityCategory.objects.create(name="Tech", slug="tech-payout")


@pytest.fixture
def community(db, creator_user, test_category):
    return Community.objects.create(
        name="Kodinga Founders Club",
        slug="kodinga-founders",
        owner=creator_user,
        category=test_category,
        pricing_type=CommunityPricing.PAID,
    )


@pytest.fixture
def funded_wallet(db, community):
    wallet, _ = CommunityWallet.objects.get_or_create(
        community=community,
        defaults={
            "total_gross": Decimal("150000.00"),
            "total_platform_fees": Decimal("30000.00"),
            "total_net": Decimal("120000.00"),
            "available_balance": Decimal("100000.00"),
            "withdrawn_amount": Decimal("20000.00"),
            "currency": "XOF",
        },
    )
    return wallet


@pytest.mark.django_db
class TestCommunityPayoutsSystem:
    def test_fee_calculation_two_percent(self):
        """Test strict 2% platform fee on payout amounts."""
        assert Decimal("0.02") == PAYOUT_FEE_RATE

        fee, net = PayoutService.calculate_payout_amounts(Decimal("40000.00"))
        assert fee == Decimal("800.00")
        assert net == Decimal("39200.00")
        assert fee + net == Decimal("40000.00")

        # Rounding check
        fee_small, net_small = PayoutService.calculate_payout_amounts(Decimal("1050.00"))
        assert fee_small == Decimal("21.00")
        assert net_small == Decimal("1029.00")

    def test_create_payout_atomic_reservation(self, community, creator_user, funded_wallet):
        """Creating a payout immediately reserves available balance and applies 2% fee."""
        initial_available = funded_wallet.available_balance  # 100 000
        withdrawal_amount = Decimal("40000.00")

        payout = PayoutService.create_payout_request(
            community=community,
            requested_by=creator_user,
            amount=withdrawal_amount,
            payment_method="wave",
            account_identifier="221771234567",
            account_name="John Doe",
        )

        assert payout.status == PayoutStatus.PENDING
        assert payout.amount == Decimal("40000.00")
        assert payout.fee_amount == Decimal("800.00")
        assert payout.net_amount == Decimal("39200.00")
        assert payout.account_identifier == "221771234567"

        funded_wallet.refresh_from_db()
        # Available balance must decrease by full 40 000 FCFA
        assert funded_wallet.available_balance == initial_available - withdrawal_amount
        assert funded_wallet.available_balance == Decimal("60000.00")

    def test_reject_insufficient_balance(self, community, creator_user, funded_wallet):
        """Payout creation must fail if requested amount exceeds available balance."""
        excessive_amount = Decimal("150000.00")  # Balance is 100 000
        with pytest.raises(ValidationError) as exc_info:
            PayoutService.create_payout_request(
                community=community,
                requested_by=creator_user,
                amount=excessive_amount,
                payment_method="orange_money",
                account_identifier="221771234567",
            )
        assert "Solde disponible insuffisant" in str(exc_info.value)

    def test_reject_below_minimum_amount(self, community, creator_user, funded_wallet):
        """Payout creation must respect the minimum payout threshold (1000 XOF)."""
        tiny_amount = Decimal("500.00")
        with pytest.raises(ValidationError) as exc_info:
            PayoutService.create_payout_request(
                community=community,
                requested_by=creator_user,
                amount=tiny_amount,
                payment_method="wave",
                account_identifier="221771234567",
            )
        assert f"{int(MIN_PAYOUT_AMOUNT)}" in str(exc_info.value)

    def test_admin_approve_payout(self, community, creator_user, admin_user, funded_wallet):
        """Admin can approve a pending payout."""
        payout = PayoutService.create_payout_request(
            community=community,
            requested_by=creator_user,
            amount=Decimal("30000.00"),
            payment_method="wave",
            account_identifier="221770000000",
        )
        approved = PayoutService.approve_payout(
            payout=payout, admin_user=admin_user, note="Documents vérifiés"
        )
        assert approved.status == PayoutStatus.APPROVED
        assert approved.processed_by == admin_user
        assert approved.admin_note == "Documents vérifiés"

    def test_admin_reject_payout_refunds_balance(
        self, community, creator_user, admin_user, funded_wallet
    ):
        """Rejection must refund the reserved amount back to available_balance."""
        initial_balance = funded_wallet.available_balance  # 100 000
        payout = PayoutService.create_payout_request(
            community=community,
            requested_by=creator_user,
            amount=Decimal("25000.00"),
            payment_method="wave",
            account_identifier="221770000000",
        )
        funded_wallet.refresh_from_db()
        assert funded_wallet.available_balance == Decimal("75000.00")

        # Reject with mandatory reason
        rejected = PayoutService.reject_payout(
            payout=payout,
            rejection_reason="Numéro de compte non conforme à l'identité du titulaire.",
            admin_user=admin_user,
        )

        assert rejected.status == PayoutStatus.REJECTED
        assert "non conforme" in rejected.rejection_reason

        # Verify automatic wallet refund
        funded_wallet.refresh_from_db()
        assert funded_wallet.available_balance == initial_balance  # Restored to 100 000

    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.disburse_payout")
    def test_disburse_via_paydunya_success(
        self, mock_disburse, community, creator_user, admin_user, funded_wallet
    ):
        """Successful PayDunya disbursement marks PROCESSED and increments withdrawn_amount."""
        mock_disburse.return_value = {
            "success": True,
            "reference": "TX-PAYDUNYA-WAVE-987654",
        }

        payout = PayoutService.create_payout_request(
            community=community,
            requested_by=creator_user,
            amount=Decimal("50000.00"),
            payment_method="wave",
            account_identifier="221770000000",
        )
        initial_withdrawn = funded_wallet.withdrawn_amount  # 20 000

        processed = PayoutService.disburse_via_paydunya(
            payout_id=payout.id, admin_user=admin_user, note="Virement validé"
        )

        assert processed.status == PayoutStatus.PROCESSED
        assert processed.reference == "TX-PAYDUNYA-WAVE-987654"
        assert processed.processed_by == admin_user
        assert processed.processed_at is not None

        # Gateway must receive net_amount (49 000 after 2% fee)
        mock_disburse.assert_called_once_with(
            account_identifier="221770000000",
            amount=49000.0,
            payment_method="wave",
            payout_id=str(payout.id),
            account_name="",
        )

        # Wallet withdrawn_amount updated by full gross amount (50 000)
        funded_wallet.refresh_from_db()
        assert funded_wallet.withdrawn_amount == initial_withdrawn + Decimal("50000.00")

    @patch("apps.billing.gateways.paydunya.PayDunyaGateway.disburse_payout")
    def test_disburse_via_paydunya_failure_refunds_balance(
        self, mock_disburse, community, creator_user, admin_user, funded_wallet
    ):
        """Hard PayDunya failure marks FAILED and automatically recredits available balance."""
        mock_disburse.side_effect = PayDunyaAPIException("Numéro mobile money invalide ou bloqué")

        payout = PayoutService.create_payout_request(
            community=community,
            requested_by=creator_user,
            amount=Decimal("40000.00"),
            payment_method="wave",
            account_identifier="000000",
        )

        with pytest.raises(ValidationError):
            PayoutService.disburse_via_paydunya(payout_id=payout.id, admin_user=admin_user)

        payout.refresh_from_db()
        assert payout.status == PayoutStatus.FAILED
        assert "Échec du transfert PayDunya" in payout.rejection_reason

        # Wallet balance refunded back to 100 000
        funded_wallet.refresh_from_db()
        assert funded_wallet.available_balance == Decimal("100000.00")


@pytest.mark.django_db
class TestCommunityPayoutsAPIEndpoints:
    def test_creator_can_request_payout_via_api(
        self, community, creator_user, funded_wallet
    ):
        """Creator can submit a withdrawal request through REST API."""
        client = APIClient()
        client.force_authenticate(user=creator_user)

        url = f"/api/v1/billing/communities/{community.slug}/payouts/"
        payload = {
            "amount": "40000.00",
            "payment_method": "wave",
            "account_identifier": "221771234567",
            "account_name": "John Doe",
        }
        response = client.post(url, data=payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()["data"]
        assert data["amount"] == "40000.00"
        assert data["fee_amount"] == "800.00"
        assert data["net_amount"] == "39200.00"
        assert data["status"] == "pending"

    def test_creator_cannot_request_more_than_balance(
        self, community, creator_user, funded_wallet
    ):
        """Attempting to withdraw more than available returns 400."""
        client = APIClient()
        client.force_authenticate(user=creator_user)

        url = f"/api/v1/billing/communities/{community.slug}/payouts/"
        payload = {
            "amount": "999999.00",
            "payment_method": "wave",
            "account_identifier": "221771234567",
        }
        response = client.post(url, data=payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_admin_backoffice_payouts_endpoints(
        self, community, creator_user, admin_user, other_user, funded_wallet
    ):
        """Admin can list, approve, and reject payouts. Non-admins receive 403."""
        # Non-admin access rejected
        client = APIClient()
        client.force_authenticate(user=other_user)
        list_url = "/api/v1/billing/admin/payouts/"
        assert client.get(list_url).status_code == status.HTTP_403_FORBIDDEN

        # Admin access granted
        client.force_authenticate(user=admin_user)
        resp = client.get(list_url)
        assert resp.status_code == status.HTTP_200_OK

        # Create payout to approve
        payout = PayoutService.create_payout_request(
            community=community,
            requested_by=creator_user,
            amount=Decimal("20000.00"),
            payment_method="wave",
            account_identifier="221779999999",
        )

        approve_url = f"/api/v1/billing/admin/payouts/{payout.id}/approve/"
        app_resp = client.post(approve_url, data={"admin_note": "Approuvé par Admin"})
        assert app_resp.status_code == status.HTTP_200_OK
        assert app_resp.json()["data"]["status"] == "approved"

        # Create second payout to reject
        payout2 = PayoutService.create_payout_request(
            community=community,
            requested_by=creator_user,
            amount=Decimal("15000.00"),
            payment_method="wave",
            account_identifier="221778888888",
        )
        reject_url = f"/api/v1/billing/admin/payouts/{payout2.id}/reject/"
        rej_resp = client.post(reject_url, data={"reason": "Compte mobile money inactif"})
        assert rej_resp.status_code == status.HTTP_200_OK
        assert rej_resp.json()["data"]["status"] == "rejected"

