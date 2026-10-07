from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from common.utils.responses import success_response
from apps.billing.serializers.payment import (
    CheckoutResponseSerializer,
    CreateCheckoutRequestSerializer,
)
from apps.billing.services.billing_service import BillingService


class CreateCheckoutView(APIView):
    """
    Initiates a secure PayDunya checkout session for the authenticated user.
    Calculates prices exclusively on the server side.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Billing & PayDunya'],
        summary="Initialiser une session de paiement sécurisée PayDunya (Sandbox / Live)",
        request=CreateCheckoutRequestSerializer,
        responses={201: CheckoutResponseSerializer}
    )
    def post(self, request):
        serializer = CreateCheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        plan_id = serializer.validated_data['plan_id']
        referral_code = serializer.validated_data.get('referral_code')
        return_url = serializer.validated_data.get('return_url')
        cancel_url = serializer.validated_data.get('cancel_url')

        payment, checkout_url = BillingService.create_checkout_session(
            user=request.user,
            plan_id=str(plan_id),
            referral_code=referral_code,
            return_url=return_url,
            cancel_url=cancel_url
        )

        response_data = {
            'payment_id': payment.id,
            'token': payment.provider_token,
            'checkout_url': checkout_url,
            'amount': payment.amount,
            'currency': payment.currency,
            'plan_name': payment.plan.name,
        }

        return success_response(
            data=response_data,
            message="Session de paiement PayDunya initialisée avec succès.",
            status_code=status.HTTP_201_CREATED
        )
