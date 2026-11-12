import logging
from typing import Any, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import requests
from django.conf import settings
from rest_framework.exceptions import APIException

logger = logging.getLogger("kodinga.billing.paydunya")


def _append_query_params(url: str, params: dict[str, str]) -> str:
    """Safely appends query parameters (like payment_id) to a return/cancel URL if not already present."""
    if not url:
        return url
    parsed = urlparse(url)
    query_dict = dict(parse_qsl(parsed.query, keep_blank_values=True))
    for k, v in params.items():
        if v and k not in query_dict:
            query_dict[k] = v
    new_query = urlencode(query_dict)
    return urlunparse(parsed._replace(query=new_query))


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
        return getattr(settings, "PAYDUNYA_MODE", "test").lower()

    @classmethod
    def is_sandbox(cls) -> bool:
        return cls.get_mode() != "live"

    @classmethod
    def get_base_url(cls) -> str:
        return cls.SANDBOX_BASE_URL if cls.is_sandbox() else cls.LIVE_BASE_URL

    @classmethod
    def get_headers(cls) -> dict[str, str]:
        master_key = getattr(settings, "PAYDUNYA_MASTER_KEY", "")
        private_key = getattr(settings, "PAYDUNYA_PRIVATE_KEY", "")
        public_key = getattr(settings, "PAYDUNYA_PUBLIC_KEY", "")
        token = getattr(settings, "PAYDUNYA_TOKEN", "")

        headers = {
            "PAYDUNYA-MASTER-KEY": master_key,
            "PAYDUNYA-PRIVATE-KEY": private_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if token:
            headers["PAYDUNYA-TOKEN"] = token
        if public_key:
            headers["PAYDUNYA-PUBLIC-KEY"] = public_key
        return headers

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
        referral_code: Optional[str] = None,
        return_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Initializes a PayDunya checkout invoice session.
        Returns {'token': '...', 'checkout_url': '...'}
        """
        app_name = getattr(settings, "APP_NAME", "Kodinga")
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:4200")
        backend_url = getattr(settings, "BACKEND_URL", "http://localhost:8000")

        base_return_url = (
            return_url
            or getattr(settings, "PAYDUNYA_SUCCESS_URL", "")
            or f"{frontend_url}/payment/success"
        )
        base_cancel_url = (
            cancel_url
            or getattr(settings, "PAYDUNYA_CANCEL_URL", "")
            or f"{frontend_url}/payment/cancel"
        )
        resolved_return_url = _append_query_params(
            base_return_url, {"payment_id": str(payment_id)}
        )
        resolved_cancel_url = _append_query_params(
            base_cancel_url, {"payment_id": str(payment_id)}
        )
        resolved_callback_url = (
            callback_url
            or getattr(settings, "PAYDUNYA_CALLBACK_URL", "")
            or f"{backend_url}/api/v1/billing/paydunya/ipn/"
        )

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
                        "description": f"Souscription {plan_name}",
                    }
                },
            },
            "store": {
                "name": app_name,
                "tagline": "Plateforme communautaire et formation tech",
                "postal_address": "Dakar, Sénégal",
                "website_url": frontend_url,
            },
            "custom_data": {
                "payment_id": str(payment_id),
                "user_id": str(user_id),
                "plan_id": str(plan_id),
                "user_email": str(user_email),
                "referral_code": str(referral_code or ""),
            },
            "actions": {
                "cancel_url": resolved_cancel_url,
                "return_url": resolved_return_url,
                "callback_url": resolved_callback_url,
            },
        }

        url = f"{cls.get_base_url()}/checkout-invoice/create"
        logger.info(
            f"[PayDunya] Creating checkout invoice for Payment={payment_id}, Amount={amount}"
        )

        try:
            response = requests.post(
                url, json=payload, headers=cls.get_headers(), timeout=20
            )
        except requests.RequestException as e:
            logger.error(f"[PayDunya] Network error during checkout creation: {e}")
            raise PayDunyaAPIException(
                "Impossible de joindre les serveurs PayDunya."
            ) from e

        if response.status_code not in [200, 201]:
            logger.error(
                f"[PayDunya] Creation failed ({response.status_code}): {response.text}"
            )
            raise PayDunyaAPIException(
                f"Échec de création de la transaction PayDunya ({response.status_code})."
            )

        data = response.json()
        response_code = data.get("response_code")
        if response_code != "00":
            error_text = (
                data.get("response_text")
                or data.get("description")
                or "Erreur inconnue"
            )
            logger.error(f"[PayDunya] API Error: {error_text}")
            raise PayDunyaAPIException(f"Erreur PayDunya: {error_text}")

        token = data.get("token")
        checkout_url = (
            data.get("response_text")
            if data.get("response_text", "").startswith("http")
            else data.get("response_url")
        )

        if not checkout_url and token:
            checkout_url = (
                f"https://app.paydunya.com/sandbox-checkout/invoice/{token}"
                if cls.is_sandbox()
                else f"https://app.paydunya.com/checkout/invoice/{token}"
            )

        logger.info(f"[PayDunya] Invoice created successfully. Token={token}")
        return {"token": token, "checkout_url": checkout_url, "raw_response": data}

    @classmethod
    def confirm_invoice(cls, token: str) -> dict[str, Any]:
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
            logger.error(
                f"[PayDunya] Network error during transaction confirmation: {e}"
            )
            raise PayDunyaAPIException(
                "Impossible de vérifier la transaction auprès de PayDunya."
            ) from e

        if response.status_code != 200:
            logger.error(
                f"[PayDunya] Confirmation failed ({response.status_code}): {response.text}"
            )
            raise PayDunyaAPIException(
                "Impossible de confirmer le statut de la facture PayDunya."
            )

        data = response.json()
        logger.info(f"[PayDunya] Transaction verified. Status={data.get('status')}")
        return data

    @classmethod
    def disburse_payout(
        cls,
        account_identifier: str,
        amount: float,
        payment_method: str = "wave",
        payout_id: Optional[str] = None,
        account_name: str = "",
    ) -> dict[str, Any]:
        """
        Executes a payout/disbursement to a community creator via PayDunya.
        Supports:
        - Mobile Money (Wave, Orange Money) via /disburse/get-invoice & /disburse/submit-invoice
        - Direct Pay (PayDunya user account) via /direct-pay/credit-account
        - Fallback gracefully in Sandbox if merchant disburse account is unprovisioned in test mode.
        """
        method = (payment_method or "wave").lower()
        logger.info(
            f"[PayDunya] Initiating disbursement: Method={method}, Account={account_identifier}, "
            f"Amount={amount}, PayoutID={payout_id}"
        )

        # 1. Direct Pay to PayDunya account
        if method in ["paydunya", "direct_pay"]:
            url = f"{cls.get_base_url()}/direct-pay/credit-account"
            payload = {
                "account_alias": account_identifier,
                "amount": float(amount),
            }
            try:
                response = requests.post(
                    url, json=payload, headers=cls.get_headers(), timeout=25
                )
                if response.status_code in [200, 201]:
                    data = response.json()
                    if data.get("response_code") == "00":
                        txn_id = data.get("transaction_id") or data.get("token") or f"PD-DP-{payout_id}"
                        logger.info(f"[PayDunya] Direct-Pay succeeded. Reference: {txn_id}")
                        return {"success": True, "reference": str(txn_id), "raw": data}
            except requests.RequestException as e:
                logger.warning(f"[PayDunya] Direct-pay network exception: {e}")
                if not cls.is_sandbox():
                    raise PayDunyaAPIException("Échec de connexion au service Direct-Pay PayDunya.") from e

        # 2. Mobile Money Disbursement (Wave, Orange Money)
        else:
            withdraw_mode_map = {
                "wave": "wave-senegal",
                "orange_money": "orange-money-senegal",
                "orange": "orange-money-senegal",
                "free_money": "free-money-senegal",
            }
            withdraw_mode = withdraw_mode_map.get(method, "wave-senegal")

            # Step A: Get Invoice Token
            get_invoice_url = f"{cls.get_base_url()}/disburse/get-invoice"
            payload_step1 = {
                "account_alias": account_identifier,
                "amount": float(amount),
                "withdraw_mode": withdraw_mode,
            }

            try:
                resp1 = requests.post(
                    get_invoice_url,
                    json=payload_step1,
                    headers=cls.get_headers(),
                    timeout=25,
                )
                if resp1.status_code in [200, 201]:
                    data1 = resp1.json()
                    if data1.get("response_code") == "00":
                        disburse_token = data1.get("disburse_token") or data1.get("token")
                        # Step B: Submit Invoice
                        submit_url = f"{cls.get_base_url()}/disburse/submit-invoice"
                        resp2 = requests.post(
                            submit_url,
                            json={"disburse_token": disburse_token},
                            headers=cls.get_headers(),
                            timeout=25,
                        )
                        if resp2.status_code in [200, 201]:
                            data2 = resp2.json()
                            if data2.get("response_code") == "00":
                                txn_id = (
                                    data2.get("transaction_id")
                                    or data2.get("token")
                                    or disburse_token
                                )
                                logger.info(
                                    f"[PayDunya] Disburse succeeded via {withdraw_mode}. Reference: {txn_id}"
                                )
                                return {
                                    "success": True,
                                    "reference": str(txn_id),
                                    "raw": data2,
                                }
                            else:
                                err_msg = data2.get("response_text") or "Rejet soumission décaissement"
                                logger.warning(f"[PayDunya] Submit invoice error: {err_msg}")
                                if not cls.is_sandbox():
                                    raise PayDunyaAPIException(f"PayDunya: {err_msg}")
                    else:
                        err_msg = data1.get("response_text") or "Rejet création facture décaissement"
                        logger.warning(f"[PayDunya] Get invoice error: {err_msg}")
                        if not cls.is_sandbox():
                            raise PayDunyaAPIException(f"PayDunya: {err_msg}")
            except requests.RequestException as e:
                logger.warning(f"[PayDunya] Disburse request network exception: {e}")
                if not cls.is_sandbox():
                    raise PayDunyaAPIException("Échec de connexion au service Disburse PayDunya.") from e

        # 3. Sandbox / Test Simulation fallback
        if cls.is_sandbox():
            simulated_ref = f"SIM-PAYDUNYA-{method.upper()}-{payout_id or 'TX'}"
            logger.info(
                f"[PayDunya Sandbox] Disburse simulated successfully for testing. Ref: {simulated_ref}"
            )
            return {
                "success": True,
                "reference": simulated_ref,
                "simulated": True,
                "raw": {"status": "completed", "mode": "sandbox_simulated"},
            }

        raise PayDunyaAPIException("Impossible d'exécuter le transfert vers le bénéficiaire.")
