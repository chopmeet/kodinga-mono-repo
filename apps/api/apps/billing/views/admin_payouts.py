import logging
from decimal import Decimal

from django.db.models import Q, Sum
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.billing.models.wallet import CommunityPayout, PayoutStatus
from apps.billing.serializers.community_billing import (
    AdminDisbursePayoutSerializer,
    AdminRejectPayoutSerializer,
    CommunityPayoutSerializer,
)
from apps.billing.services.payout_service import PayoutService
from common.permissions.base import IsPlatformAdmin
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response

logger = logging.getLogger("kodinga.billing.admin_payouts")


class AdminPayoutsListView(APIView):
    """
    Backoffice Administrator view to inspect, search, and filter all community payout requests.
    Supports filtering by status, community, search keywords, and date range.
    """

    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        tags=["Admin Billing (Backoffice)"],
        summary="Lister et filtrer toutes les demandes de reversement de la plateforme",
        parameters=[
            OpenApiParameter(
                name="status",
                description="Filtrer par statut: pending, approved, processed, rejected, failed",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="community",
                description="Filtrer par slug ou identifiant de communauté",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="search",
                description="Recherche textuelle sur le créateur, la communauté, le compte ou la référence",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="date_from",
                description="Date de début (YYYY-MM-DD)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="date_to",
                description="Date de fin (YYYY-MM-DD)",
                required=False,
                type=str,
            ),
        ],
        responses={200: CommunityPayoutSerializer(many=True)},
    )
    def get(self, request):
        queryset = (
            CommunityPayout.objects.select_related("community", "requested_by", "processed_by")
            .all()
            .order_by("-created_at")
        )

        # Filters
        payout_status = request.query_params.get("status")
        if payout_status:
            queryset = queryset.filter(status=payout_status.lower())

        community_param = request.query_params.get("community")
        if community_param:
            queryset = queryset.filter(
                Q(community__slug__iexact=community_param)
                | Q(community__name__icontains=community_param)
            )

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(community__name__icontains=search)
                | Q(requested_by__username__icontains=search)
                | Q(requested_by__email__icontains=search)
                | Q(account_identifier__icontains=search)
                | Q(account_name__icontains=search)
                | Q(reference__icontains=search)
            )

        date_from = request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        # Global Statistics / KPIs for the admin dashboard
        all_payouts = CommunityPayout.objects.all()
        pending_agg = all_payouts.filter(status=PayoutStatus.PENDING).aggregate(
            total=Sum("amount")
        )
        processed_agg = all_payouts.filter(status=PayoutStatus.PROCESSED).aggregate(
            total=Sum("amount"), fees=Sum("fee_amount")
        )

        summary = {
            "pending_count": all_payouts.filter(status=PayoutStatus.PENDING).count(),
            "pending_amount": str(pending_agg.get("total") or Decimal("0.00")),
            "processed_count": all_payouts.filter(status=PayoutStatus.PROCESSED).count(),
            "processed_amount": str(processed_agg.get("total") or Decimal("0.00")),
            "fees_collected": str(processed_agg.get("fees") or Decimal("0.00")),
        }

        # Pagination
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        if page is not None:
            serializer = CommunityPayoutSerializer(page, many=True, context={"request": request})
            paginated_response = paginator.get_paginated_response(serializer.data)
            # Add summary KPIs to paginated response data
            paginated_response.data["summary"] = summary
            return paginated_response

        serializer = CommunityPayoutSerializer(queryset, many=True, context={"request": request})
        return success_response(
            data={"results": serializer.data, "summary": summary}
        )


class AdminPayoutDetailView(APIView):
    """
    Retrieve single payout request details for administrator review.
    """

    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        tags=["Admin Billing (Backoffice)"],
        summary="Détails d'une demande de reversement",
        responses={200: CommunityPayoutSerializer},
    )
    def get(self, request, payout_id):
        try:
            payout = CommunityPayout.objects.select_related(
                "community", "requested_by", "processed_by"
            ).get(id=payout_id)
        except CommunityPayout.DoesNotExist:
            return error_response(
                message="Demande de reversement introuvable.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        serializer = CommunityPayoutSerializer(payout, context={"request": request})
        return success_response(data=serializer.data)


class AdminPayoutApproveView(APIView):
    """
    Approve a pending payout request.
    Transitions status: PENDING -> APPROVED.
    """

    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        tags=["Admin Billing (Backoffice)"],
        summary="Approuver une demande de reversement",
        request=AdminDisbursePayoutSerializer,
        responses={200: CommunityPayoutSerializer},
    )
    def post(self, request, payout_id):
        try:
            payout = CommunityPayout.objects.get(id=payout_id)
        except CommunityPayout.DoesNotExist:
            return error_response(
                message="Demande de reversement introuvable.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        serializer = AdminDisbursePayoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.validated_data.get("admin_note", "")

        try:
            payout = PayoutService.approve_payout(
                payout=payout, admin_user=request.user, note=note
            )
        except Exception as exc:
            return error_response(
                message=str(exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        out_serializer = CommunityPayoutSerializer(payout, context={"request": request})
        return success_response(
            data=out_serializer.data,
            message="Demande de reversement approuvée avec succès.",
        )


class AdminPayoutRejectView(APIView):
    """
    Reject a pending or approved payout request.
    Immediately refunds the reserved amount back to the community wallet's available_balance.
    Requires a non-empty rejection reason.
    """

    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        tags=["Admin Billing (Backoffice)"],
        summary="Rejeter une demande de reversement et rembourser le solde",
        request=AdminRejectPayoutSerializer,
        responses={200: CommunityPayoutSerializer},
    )
    def post(self, request, payout_id):
        try:
            payout = CommunityPayout.objects.get(id=payout_id)
        except CommunityPayout.DoesNotExist:
            return error_response(
                message="Demande de reversement introuvable.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        serializer = AdminRejectPayoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data["reason"]
        note = serializer.validated_data.get("admin_note", "")

        try:
            payout = PayoutService.reject_payout(
                payout=payout,
                rejection_reason=reason,
                admin_user=request.user,
                note=note,
            )
        except Exception as exc:
            return error_response(
                message=str(exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        out_serializer = CommunityPayoutSerializer(payout, context={"request": request})
        return success_response(
            data=out_serializer.data,
            message="Demande de reversement rejetée. Le montant a été re-crédité sur le solde disponible.",
        )


class AdminPayoutDisburseView(APIView):
    """
    Executes actual payout disbursement via PayDunya to the creator's account
    (Wave, Orange Money, or PayDunya account).
    Transfers net_amount (after deduction of 2% platform fees).
    Transitions status to PROCESSED on success, or FAILED (with refund) on critical error.
    """

    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        tags=["Admin Billing (Backoffice)"],
        summary="Exécuter le virement vers le bénéficiaire via PayDunya",
        request=AdminDisbursePayoutSerializer,
        responses={200: CommunityPayoutSerializer},
    )
    def post(self, request, payout_id):
        try:
            payout = CommunityPayout.objects.get(id=payout_id)
        except CommunityPayout.DoesNotExist:
            return error_response(
                message="Demande de reversement introuvable.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        serializer = AdminDisbursePayoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.validated_data.get("admin_note", "")

        try:
            payout = PayoutService.disburse_via_paydunya(
                payout_id=payout.id, admin_user=request.user, note=note
            )
        except Exception as exc:
            return error_response(
                message=f"Échec de l'exécution du reversement: {str(exc)}",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        out_serializer = CommunityPayoutSerializer(payout, context={"request": request})
        return success_response(
            data=out_serializer.data,
            message=f"Virement de {int(payout.net_amount)} {payout.currency} exécuté avec succès vers {payout.account_identifier} (Réf: {payout.reference}).",
        )

