from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from common.utils.responses import error_response, success_response
from apps.billing.models.payment import PaymentStatus
from apps.billing.selectors.billing_selector import BillingSelector
from apps.billing.serializers.payment import (
    PaymentDetailSerializer,
    PaymentStatusSerializer,
)
from apps.billing.serializers.subscription import SubscriptionSerializer


class MySubscriptionsView(APIView):
    """
    List user's active and historical subscriptions.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Billing & PayDunya'],
        summary="Mes abonnements actifs et passés",
        responses={200: SubscriptionSerializer(many=True)}
    )
    def get(self, request):
        subscriptions = BillingSelector.get_user_subscriptions(user=request.user)
        serializer = SubscriptionSerializer(subscriptions, many=True, context={'request': request})
        return success_response(data=serializer.data)


class MyPaymentsView(APIView):
    """
    List user's payment transaction history.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Billing & PayDunya'],
        summary="Historique de mes paiements et factures",
        responses={200: PaymentDetailSerializer(many=True)}
    )
    def get(self, request):
        payments = BillingSelector.get_user_payments(user=request.user)
        serializer = PaymentDetailSerializer(payments, many=True, context={'request': request})
        return success_response(data=serializer.data)


class PaymentStatusView(APIView):
    """
    Query real-time status of a specific payment session.
    Safe endpoint used by frontend /payment/success or /payment/cancel return pages.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Billing & PayDunya'],
        summary="Vérifier le statut d'un paiement (pour la page de retour)",
        responses={200: PaymentStatusSerializer}
    )
    def get(self, request, payment_id):
        try:
            payment = BillingSelector.get_payment_for_user(payment_id=payment_id, user=request.user)
            # Active on-demand verification fallback:
            # If still PENDING and has a token, query PayDunya directly in case IPN callback was missed/blocked
            if payment.status == PaymentStatus.PENDING and payment.provider_token:
                try:
                    from apps.billing.services.billing_service import BillingService
                    payment = BillingService.process_paydunya_ipn(token=payment.provider_token)
                except Exception:
                    pass
        except Exception as e:
            return error_response(str(e), status_code=status.HTTP_404_NOT_FOUND)

        serializer = PaymentStatusSerializer(payment)
        return success_response(data=serializer.data)
