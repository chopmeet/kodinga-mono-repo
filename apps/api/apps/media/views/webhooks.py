import json
import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.media.services.mux_service import MuxVideoService

logger = logging.getLogger('kodinga.media.webhooks')


class MuxWebhookView(APIView):
    """
    Handles asynchronous webhook notifications from Mux for video processing and asset states.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        tags=['Media'],
        summary="Webhook récepteur d'événements Mux (transcodage, readiness)",
        request=dict,
        responses={200: None}
    )
    def post(self, request):
        signature = request.headers.get('Mux-Signature', '')
        raw_body = request.body

        # Verify signature
        if not MuxVideoService.verify_webhook_signature(raw_body, signature):
            logger.warning("Rejected Mux webhook due to invalid signature.")
            return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = json.loads(raw_body.decode('utf-8'))
        except Exception as exc:
            logger.error(f"Failed to decode webhook JSON: {exc}")
            return Response({'error': 'Invalid JSON body'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            MuxVideoService.handle_webhook_event(payload)
        except Exception as exc:
            logger.error(f"Error handling Mux webhook: {exc}")
            return Response({'error': 'Webhook processing failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'status': 'received'}, status=status.HTTP_200_OK)
