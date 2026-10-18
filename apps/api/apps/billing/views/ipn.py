import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.billing.services.billing_service import BillingService
from common.utils.responses import error_response, success_response

logger = logging.getLogger('kodinga.billing.ipn')


class PayDunyaIPNView(APIView):
    """
    Public server-to-server IPN (Instant Payment Notification) callback webhook from PayDunya.
    Idempotently verifies transaction status directly with PayDunya API and activates subscription.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Billing & Affiliates'],
        summary="Webhook / IPN Callback PayDunya (Server-to-Server)",
        request=dict,
        responses={200: dict}
    )
    def post(self, request):
        logger.info(f"[PayDunya IPN] Received notification: {request.data}")

        # Extract token from various PayDunya IPN payload formats
        token = (
            request.data.get('data', {}).get('token')
            if isinstance(request.data.get('data'), dict)
            else request.data.get('data[token]')
        )

        if not token:
            token = request.data.get('token') or request.data.get('invoice', {}).get('token')

        if not token:
            logger.error(f"[PayDunya IPN] Missing token in payload: {request.data}")
            return error_response(
                "Jeton de transaction PayDunya manquant.",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            payment = BillingService.process_paydunya_ipn(token=str(token), raw_payload=request.data)
            logger.info(f"[PayDunya IPN] Payment {payment.id} processed successfully with status {payment.status}")
            return success_response(
                data={'payment_id': payment.id, 'status': payment.status},
                message="Notification IPN traitée avec succès."
            )
        except Exception as e:
            logger.error(f"[PayDunya IPN] Error processing IPN: {e}", exc_info=True)
            return error_response(
                f"Erreur de traitement IPN: {str(e)}",
                status_code=status.HTTP_400_BAD_REQUEST
            )
