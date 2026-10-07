import logging
from typing import Any, Dict, Optional
import requests
from django.conf import settings
from rest_framework.exceptions import APIException

logger = logging.getLogger('kodinga.billing.paydunya')


class PayDunyaAPIException(APIException):
    status_code = 502
    default_detail = "Erreur de communication avec la passerelle PayDunya."


class PayDunyaGateway:
    """
    Server-side PayDunya HTTP client for Checkout Invoices and IPN Verification.
    Follows official PayDunya documentation: https://developers.paydunya.com/
    """

    SANDBOX_BASE_URL = "https://app.paydunya.com/sandbox-api/v1"
    LIVE_BASE_URL = "https://app.paydunya.com/api/v1"

    @classmethod
    def get_mode(cls) -> str:
        return getattr(settings, 'PAYDUNYA_MODE', 'test').lower()

    @classmethod
    def is_sandbox(cls) -> bool:
        return cls.get_mode() != 'live'

    @classmethod
    def get_base_url(cls) -> str:
        return cls.SANDBOX_BASE_URL if cls.is_sandbox() else cls.LIVE_BASE_URL

    @classmethod
    def get_headers(cls) -> Dict[str, str]:
        master_key = getattr(settings, 'PAYDUNYA_MASTER_KEY', '')
        private_key = getattr(settings, 'PAYDUNYA_PRIVATE_KEY', '')
        token = getattr(settings, 'PAYDUNYA_TOKEN', '')

        return {
            'PAYDUNYA-MASTER-KEY': master_key,
            'PAYDUNYA-PRIVATE-KEY': private_key,
            'PAYDUNYA-TOKEN': token,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    @classmethod
    def create_checkout_invoice(
        cls,
        payment_id: str,
        amount: float,
        plan_name: str,
        plan_id: str,
        user_id: str,
        user_email: str,
        description: str = "",
        return_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Initializes a PayDunya checkout invoice session.
        Returns {'token': '...', 'checkout_url': '...'}
        """
        app_name = getattr(settings, 'APP_NAME', 'Kodinga')
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        backend_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8000')

        resolved_return_url = return_url or getattr(settings, 'PAYDUNYA_SUCCESS_URL', f"{frontend_url}/payment/success")
        resolved_cancel_url = cancel_url or getattr(settings, 'PAYDUNYA_CANCEL_URL', f"{frontend_url}/payment/cancel")
        resolved_callback_url = callback_url or getattr(settings, 'PAYDUNYA_CALLBACK_URL', f"{backend_url}/api/v1/billing/paydunya/ipn/")

        payload = {
            "invoice": {
                "total_amount": float(amount),
                "description": description or f"Abonnement {plan_name} sur {app_name}",
                "items": {
                    "item_0": {
                        "name": plan_name,
                        "quantity": 1,
                        "unit_price": float(amount),
                        "total_price": float(amount),
                        "description": f"Souscription {plan_name}"
                    }
                }
            },
            "store": {
                "name": app_name,
                "tagline": "Plateforme communautaire et formation tech",
                "postal_address": "Dakar, Sénégal",
                "website_url": frontend_url
            },
            "custom_data": {
                "payment_id": str(payment_id),
                "user_id": str(user_id),
                "plan_id": str(plan_id),
                "user_email": str(user_email)
            },
            "actions": {
                "cancel_url": resolved_cancel_url,
                "return_url": resolved_return_url,
                "callback_url": resolved_callback_url
            }
        }

        url = f"{cls.get_base_url()}/checkout-invoice/create"
        logger.info(f"[PayDunya] Creating checkout invoice for Payment={payment_id}, Amount={amount}")

        try:
            response = requests.post(url, json=payload, headers=cls.get_headers(), timeout=20)
        except requests.RequestException as e:
            logger.error(f"[PayDunya] Network error during checkout creation: {e}")
            raise PayDunyaAPIException("Impossible de joindre les serveurs PayDunya.")

        if response.status_code not in [200, 201]:
            logger.error(f"[PayDunya] Creation failed ({response.status_code}): {response.text}")
            raise PayDunyaAPIException(f"Échec de création de la transaction PayDunya ({response.status_code}).")

        data = response.json()
        response_code = data.get('response_code')
        if response_code != '00':
            error_text = data.get('response_text') or data.get('description') or "Erreur inconnue"
            logger.error(f"[PayDunya] API Error: {error_text}")
            raise PayDunyaAPIException(f"Erreur PayDunya: {error_text}")

        token = data.get('token')
        checkout_url = data.get('response_text') if data.get('response_text', '').startswith('http') else data.get('response_url')

        if not checkout_url and token:
            checkout_url = f"https://app.paydunya.com/sandbox-checkout/invoice/{token}" if cls.is_sandbox() else f"https://app.paydunya.com/checkout/invoice/{token}"

        logger.info(f"[PayDunya] Invoice created successfully. Token={token}")
        return {
            'token': token,
            'checkout_url': checkout_url,
            'raw_response': data
        }

    @classmethod
    def confirm_invoice(cls, token: str) -> Dict[str, Any]:
        """
        Direct server-to-server transaction verification from PayDunya official API.
        Acts as the single source of truth for IPN callbacks.
        """
        if not token:
            raise PayDunyaAPIException("Jeton de transaction PayDunya manquant.")

        url = f"{cls.get_base_url()}/checkout-invoice/confirm/{token}"
        logger.info(f"[PayDunya] Verifying transaction status for Token={token}")

        try:
            response = requests.get(url, headers=cls.get_headers(), timeout=20)
        except requests.RequestException as e:
            logger.error(f"[PayDunya] Network error during transaction confirmation: {e}")
            raise PayDunyaAPIException("Impossible de vérifier la transaction auprès de PayDunya.")

        if response.status_code != 200:
            logger.error(f"[PayDunya] Confirmation failed ({response.status_code}): {response.text}")
            raise PayDunyaAPIException("Impossible de confirmer le statut de la facture PayDunya.")

        data = response.json()
        logger.info(f"[PayDunya] Transaction verified. Status={data.get('status')}")
        return data
