import hashlib
import hmac
import logging

from apps.billing.services.billing_service import BillingService
from common.utils.responses import error_response, success_response
from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

logger = logging.getLogger('kodinga.billing.ipn')


class PayDunyaIPNView(APIView):
    """
    Public server-to-server IPN (Instant Payment Notification) callback webhook from PayDunya.
    Handles form-urlencoded and JSON formats, optionally verifies SHA-512 master key hash,
    and idempotently verifies transaction status directly with PayDunya API.
    """
    permission_classes = [AllowAny]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    @extend_schema(
        tags=['Billing & Affiliates'],
        summary="Webhook / IPN Callback PayDunya (Server-to-Server)",
        request=dict,
        responses={200: dict}
    )
    def post(self, request):
        logger.info(f"[PayDunya IPN] Received notification: {request.data}")

        # Optional SHA-512 Master Key hash verification as per PayDunya IPN specs
        received_hash = (
            request.data.get('data[hash]')
            or (request.data.get('data', {}).get('hash') if isinstance(request.data.get('data'), dict) else None)
            or request.data.get('hash')
        )
        master_key = getattr(settings, 'PAYDUNYA_MASTER_KEY', '')
        if received_hash and master_key:
            expected_hash = hashlib.sha512(master_key.encode('utf-8')).hexdigest()
            if not hmac.compare_digest(str(received_hash).lower(), expected_hash.lower()):
                logger.warning(f"[PayDunya IPN] Hash mismatch. Expected {expected_hash}, got {received_hash}")
                return error_response(
                    "Signature de sécurité PayDunya invalide.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )

        # Extract invoice token from various PayDunya IPN payload formats
        # PayDunya official form-urlencoded: data[invoice][token]
        token = request.data.get('data[invoice][token]')

        # Nested dict from JSON: data.invoice.token or data.token
        if not token and isinstance(request.data.get('data'), dict):
            token = (
                request.data.get('data', {}).get('invoice', {}).get('token')
                or request.data.get('data', {}).get('token')
            )

        # Flat or root keys: data[token], invoice.token, token
        if not token:
            token = (
                request.data.get('data[token]')
                or (request.data.get('invoice', {}).get('token') if isinstance(request.data.get('invoice'), dict) else None)
                or request.data.get('token')
                or request.POST.get('data[invoice][token]')
                or request.POST.get('token')
            )

        if not token:
            logger.error(f"[PayDunya IPN] Missing token in payload: {request.data}")
            return error_response(
                "Jeton de transaction PayDunya manquant.",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            payment = BillingService.process_paydunya_ipn(token=str(token).strip(), raw_payload=request.data)
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
