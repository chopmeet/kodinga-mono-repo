from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.billing.models.payment import PaymentStatus
from apps.billing.selectors.billing_selector import BillingSelector
from apps.billing.serializers.payment import (
    PaymentDetailSerializer,
    PaymentStatusSerializer,
)
from apps.billing.serializers.subscription import SubscriptionSerializer
from common.utils.responses import error_response, success_response


class MySubscriptionsView(APIView):
    """
    List user's active and historical subscriptions.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Billing & Affiliates"],
        summary="Mes abonnements actifs et passés",
        responses={200: SubscriptionSerializer(many=True)},
    )
    def get(self, request):
        from apps.billing.models.payment import Payment
        from apps.billing.services.billing_service import BillingService

        BillingService.reconcile_pending_payments(
            Payment.objects.filter(user=request.user)
        )
        subscriptions = BillingSelector.get_user_subscriptions(user=request.user)
        serializer = SubscriptionSerializer(
            subscriptions, many=True, context={"request": request}
        )
        return success_response(data=serializer.data)


class MyPaymentsView(APIView):
    """
    List user's payment transaction history.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Billing & Affiliates"],
        summary="Historique de mes paiements et factures",
        responses={200: PaymentDetailSerializer(many=True)},
    )
    def get(self, request):
        from apps.billing.models.payment import Payment
        from apps.billing.services.billing_service import BillingService

        BillingService.reconcile_pending_payments(
            Payment.objects.filter(user=request.user)
        )
        payments = BillingSelector.get_user_payments(user=request.user)
        serializer = PaymentDetailSerializer(
            payments, many=True, context={"request": request}
        )
        return success_response(data=serializer.data)


class PaymentStatusView(APIView):
    """
    Query real-time status of a specific payment session.
    Safe endpoint used by frontend /payment/success or /payment/cancel return pages.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Billing & Affiliates"],
        summary="Vérifier le statut d'un paiement (pour la page de retour)",
        responses={200: PaymentStatusSerializer},
    )
    def get(self, request, payment_id):
        try:
            payment = BillingSelector.get_payment_for_user(
                payment_id=payment_id, user=request.user
            )
            # Active on-demand verification fallback:
            # If still PENDING and has a token, query PayDunya directly in case IPN callback was missed/blocked
            if payment.status == PaymentStatus.PENDING and payment.provider_token:
                try:
                    from apps.billing.services.billing_service import BillingService

                    payment = BillingService.process_paydunya_ipn(
                        token=payment.provider_token
                    )
                except Exception:
                    pass
        except Exception as e:
            return error_response(str(e), status_code=status.HTTP_404_NOT_FOUND)

        serializer = PaymentStatusSerializer(payment)
        return success_response(data=serializer.data)


class CancelSubscriptionView(APIView):
    """
    Cancel an active subscription.
    Sets cancel_at_period_end=True, ensuring access remains valid until current_period_end.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Billing & Affiliates"],
        summary="Résilier un abonnement à l'échéance",
        responses={200: SubscriptionSerializer},
    )
    def post(self, request, subscription_id):
        from django.utils import timezone

        from apps.billing.models.subscription import Subscription, SubscriptionStatus

        try:
            subscription = Subscription.objects.select_related("plan").get(
                id=subscription_id, user=request.user
            )
        except Subscription.DoesNotExist:
            return error_response(
                "Abonnement introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        if subscription.status != SubscriptionStatus.ACTIVE:
            return error_response(
                "Cet abonnement n'est pas actif.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        subscription.cancel_at_period_end = True
        subscription.canceled_at = timezone.now()
        subscription.save(
            update_fields=["cancel_at_period_end", "canceled_at", "updated_at"]
        )

        serializer = SubscriptionSerializer(subscription, context={"request": request})
        return success_response(
            data=serializer.data,
            message="Votre abonnement a été résilié et ne sera pas renouvelé à l'échéance.",
        )
