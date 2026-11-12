import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.billing.selectors.billing_selector import BillingSelector
from apps.billing.serializers.community_billing import (
    CommunityPayoutSerializer,
    CommunityRevenueOverviewSerializer,
    CommunitySubscriberSerializer,
    CommunityTransactionSerializer,
    CreateCommunityPayoutRequestSerializer,
)
from apps.billing.services.payout_service import PayoutService
from common.utils.responses import error_response, success_response

logger = logging.getLogger("kodinga.billing.community")


class CommunitySubscribersView(APIView):
    """
    List subscriptions and members of a paid community for its owner.
    Powers the 'Abonnés' tab in /c/:slug/payments.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Community Billing (Creator)"],
        summary="Liste des abonnés d'une communauté",
        responses={200: CommunitySubscriberSerializer(many=True)},
    )
    def get(self, request, community_slug):
        from apps.billing.models.payment import Payment
        from apps.billing.services.billing_service import BillingService

        community = BillingSelector.get_community_for_creator(
            community_slug=community_slug, user=request.user
        )
        BillingService.reconcile_pending_payments(
            Payment.objects.filter(plan__community=community)
        )
        subscribers = BillingSelector.get_community_subscribers(community=community)
        serializer = CommunitySubscriberSerializer(
            subscribers, many=True, context={"request": request}
        )
        return success_response(data=serializer.data)


class CommunityTransactionsView(APIView):
    """
    List historical transactions and payments received for this community.
    Powers the 'Paiements / Transactions' tab in /c/:slug/payments.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Community Billing (Creator)"],
        summary="Historique des paiements reçus par une communauté",
        responses={200: CommunityTransactionSerializer(many=True)},
    )
    def get(self, request, community_slug):
        from apps.billing.models.payment import Payment
        from apps.billing.services.billing_service import BillingService

        community = BillingSelector.get_community_for_creator(
            community_slug=community_slug, user=request.user
        )
        BillingService.reconcile_pending_payments(
            Payment.objects.filter(plan__community=community)
        )
        payments = BillingSelector.get_community_payments(community=community)
        serializer = CommunityTransactionSerializer(
            payments, many=True, context={"request": request}
        )
        return success_response(data=serializer.data)


class CommunityRevenueView(APIView):
    """
    Financial summary & monthly breakdown (Gross, Platform Fees, Net Creator Revenue).
    Powers the 'Courbe des encaissements' chart and KPI cards in /c/:slug/payments.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Community Billing (Creator)"],
        summary="Indicateurs de revenus et courbe des encaissements mensuels",
        responses={200: CommunityRevenueOverviewSerializer},
    )
    def get(self, request, community_slug):
        from apps.billing.models.payment import Payment
        from apps.billing.services.billing_service import BillingService

        community = BillingSelector.get_community_for_creator(
            community_slug=community_slug, user=request.user
        )
        BillingService.reconcile_pending_payments(
            Payment.objects.filter(plan__community=community)
        )
        revenue_overview = BillingSelector.get_community_revenue_overview(
            community=community
        )
        serializer = CommunityRevenueOverviewSerializer(revenue_overview)
        return success_response(data=serializer.data)


class CommunityPayoutsView(APIView):
    """
    Manage withdrawals of net earnings (Wave, Orange Money, Bank Transfer).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Community Billing (Creator)"],
        summary="Historique des demandes de reversement",
        responses={200: CommunityPayoutSerializer(many=True)},
    )
    def get(self, request, community_slug):
        community = BillingSelector.get_community_for_creator(
            community_slug=community_slug, user=request.user
        )
        payouts = BillingSelector.get_community_payouts(community=community)
        serializer = CommunityPayoutSerializer(
            payouts, many=True, context={"request": request}
        )
        return success_response(data=serializer.data)

    @extend_schema(
        tags=["Community Billing (Creator)"],
        summary="Demander un reversement des gains disponibles",
        request=CreateCommunityPayoutRequestSerializer,
        responses={201: CommunityPayoutSerializer},
    )
    def post(self, request, community_slug):
        community = BillingSelector.get_community_for_creator(
            community_slug=community_slug, user=request.user
        )
        serializer = CreateCommunityPayoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data["amount"]
        payment_method = serializer.validated_data["payment_method"]
        account_identifier = serializer.validated_data["account_identifier"]
        account_name = serializer.validated_data.get("account_name", "")

        try:
            payout = PayoutService.create_payout_request(
                community=community,
                requested_by=request.user,
                amount=amount,
                payment_method=payment_method,
                account_identifier=account_identifier,
                account_name=account_name,
            )
        except Exception as exc:
            return error_response(
                message=str(exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        out_serializer = CommunityPayoutSerializer(payout, context={"request": request})
        return success_response(
            data=out_serializer.data,
            message="Demande de reversement enregistrée avec succès. Elle sera traitée sous 24-48h.",
            status_code=status.HTTP_201_CREATED,
        )
