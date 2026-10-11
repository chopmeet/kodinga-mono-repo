import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.mail.backends.base import BaseEmailBackend
from django.template.loader import render_to_string
from django.utils.html import strip_tags

import resend
from resend.exceptions import (
    InvalidApiKeyError,
    RateLimitError,
    ResendError,
    ValidationError,
)

logger = logging.getLogger('kodinga.email')


def get_formatted_sender(raw_sender: str = None) -> str:
    """
    Formats the sender into 'App Name <email@domain.com>' if not already formatted.
    """
    sender = (
        raw_sender
        or getattr(settings, 'MAIL_FROM', None)
        or getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@resend.dev')
    )
    app_name = getattr(settings, 'APP_NAME', 'Kodinga')

    if sender and '<' not in sender and '@' in sender:
        return f"{app_name} <{sender}>"
    return sender


class ResendEmailBackend(BaseEmailBackend):
    """
    Custom Django Email Backend dispatching emails via the official Resend Python SDK.
    Compatible with Django's send_mail(), EmailMessage, and EmailMultiAlternatives.
    """

    def __init__(self, fail_silently: bool = False, api_key: str = None, **kwargs):
        super().__init__(**kwargs)
        self.fail_silently = fail_silently
        self.api_key = api_key or getattr(settings, 'RESEND_API_KEY', '')

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        api_key = self.api_key or getattr(settings, 'RESEND_API_KEY', '')
        if not api_key:
            if not self.fail_silently:
                raise ValueError("RESEND_API_KEY is not configured in settings.")
            logger.error("RESEND_API_KEY is not configured. Email dispatch skipped.")
            return 0

        resend.api_key = api_key
        sent_count = 0

        for message in email_messages:
            if self._send_one(message):
                sent_count += 1

        return sent_count

    def _send_one(self, message) -> bool:
        recipients = list(message.to) if message.to else []
        if not recipients:
            return False

        from_email = get_formatted_sender(message.from_email)

        # Extract text body and HTML alternative
        text_content = message.body or ""
        html_content = None

        if hasattr(message, 'alternatives'):
            for content, mimetype in message.alternatives:
                if mimetype == 'text/html':
                    html_content = content
                    break

        if not html_content and getattr(message, 'content_subtype', None) == 'html':
            html_content = message.body

        params: dict = {
            "from": from_email,
            "to": recipients,
            "subject": message.subject or "",
            "html": html_content or f"<pre>{text_content}</pre>",
            "text": text_content,
        }

        if hasattr(message, 'reply_to') and message.reply_to:
            params["reply_to"] = list(message.reply_to)
        if hasattr(message, 'cc') and message.cc:
            params["cc"] = list(message.cc)
        if hasattr(message, 'bcc') and message.bcc:
            params["bcc"] = list(message.bcc)

        try:
            print(f"\n==================================================")
            print(f"[RESEND BACKEND] Sending to: {recipients} | Subject: '{message.subject}' | From: '{from_email}'")
            resp = resend.Emails.send(params)
            email_id = resp.get("id") if isinstance(resp, dict) else getattr(resp, "id", None)
            print(f"[RESEND BACKEND SUCCESS] Response: {resp}")
            print(f"==================================================\n")
            logger.info(f"Email '{message.subject}' dispatched via Resend to {recipients} (id: {email_id})")
            return True
        except RateLimitError as exc:
            print(f"[RESEND RATE LIMIT ERROR]: {exc}\n==================================================\n")
            logger.error(f"Resend rate limit exceeded for '{message.subject}' to {recipients}: {exc}")
            if not self.fail_silently:
                raise
            return False
        except InvalidApiKeyError as exc:
            print(f"[RESEND INVALID API KEY ERROR]: {exc}\n==================================================\n")
            logger.error(f"Invalid Resend API key for '{message.subject}': {exc}")
            if not self.fail_silently:
                raise
            return False
        except ValidationError as exc:
            print(f"[RESEND VALIDATION ERROR]: {exc}\n==================================================\n")
            logger.error(f"Resend validation error for '{message.subject}' to {recipients}: {exc}")
            if not self.fail_silently:
                raise
            return False
        except ResendError as exc:
            print(f"[RESEND API ERROR]: {exc}\n==================================================\n")
            logger.error(f"Resend error sending '{message.subject}' to {recipients}: {exc}")
            if not self.fail_silently:
                raise
            return False
        except Exception as exc:
            print(f"[RESEND UNEXPECTED ERROR]: {exc}\n==================================================\n")
            logger.error(f"Unexpected error dispatching '{message.subject}' via Resend to {recipients}: {exc}")
            if not self.fail_silently:
                raise
            return False


class EmailService:
    """
    Centralized email delivery service rendering dynamic HTML/TXT templates with support
    for Resend official Python SDK, Celery background queueing, and Django testing outbox.
    """

    @classmethod
    def send_mail(
        cls,
        to_email: str | list,
        subject: str,
        template_name: str,
        context: dict,
        from_email: str = None,
        fail_silently: bool = False,
        reply_to: str | list = None,
    ) -> bool:
        """
        Renders template_name.html and template_name.txt and dispatches via Resend SDK
        (or test locmem backend if under pytest/testing).
        """
        sender = get_formatted_sender(from_email)
        app_name = getattr(settings, 'APP_NAME', 'Kodinga')

        base_context = {
            'app_name': app_name,
            'frontend_url': getattr(settings, 'FRONTEND_URL', 'http://localhost:3000'),
            'support_email': getattr(settings, 'SUPPORT_EMAIL', 'support@kodinga.com'),
        }
        full_context = {**base_context, **context}

        html_template = f"emails/{template_name}.html"
        txt_template = f"emails/{template_name}.txt"

        try:
            html_content = render_to_string(html_template, full_context)
        except Exception as e:
            logger.error(f"Failed to render HTML email template {html_template}: {e}")
            raise

        try:
            text_content = render_to_string(txt_template, full_context)
        except Exception:
            text_content = strip_tags(html_content)

        recipients = [to_email] if isinstance(to_email, str) else list(to_email)

        # 1. In automated testing environments, route through Django outbox for assertions
        if getattr(settings, 'IS_TESTING', False):
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=sender,
                to=recipients,
            )
            msg.attach_alternative(html_content, "text/html")
            if reply_to:
                msg.reply_to = [reply_to] if isinstance(reply_to, str) else list(reply_to)

            try:
                msg.send(fail_silently=fail_silently)
                logger.info(f"Test Email '{subject}' saved to test outbox for {recipients}")
                return True
            except Exception as exc:
                logger.error(f"Error dispatching test email '{subject}' to {recipients}: {exc}")
                if not fail_silently:
                    raise
                return False

        # 2. Production / Dev dispatch via official Resend Python SDK
        resend_api_key = getattr(settings, 'RESEND_API_KEY', '')
        if resend_api_key:
            resend.api_key = resend_api_key

            params: dict = {
                "from": sender,
                "to": recipients,
                "subject": subject,
                "html": html_content,
                "text": text_content,
            }
            if reply_to:
                params["reply_to"] = [reply_to] if isinstance(reply_to, str) else list(reply_to)

            try:
                print(f"\n==================================================", flush=True)
                print(f"[RESEND SENDING] To: {recipients} | Subject: '{subject}' | From: '{sender}'", flush=True)
                response = resend.Emails.send(params)
                email_id = response.get("id") if isinstance(response, dict) else getattr(response, "id", None)
                print(f"[RESEND SUCCESS] API Response: {response}", flush=True)
                print(f"==================================================\n", flush=True)
                logger.info(f"Email '{subject}' successfully dispatched via Resend to {recipients} (id: {email_id})")
                return response or True
            except RateLimitError as exc:
                print(f"[RESEND RATE LIMIT ERROR]: {exc}\n==================================================\n")
                logger.error(f"Resend rate limit exceeded for '{subject}' to {recipients}: {exc}")
                if not fail_silently:
                    raise
                return False
            except InvalidApiKeyError as exc:
                print(f"[RESEND INVALID API KEY ERROR]: {exc}\n==================================================\n")
                logger.error(f"Invalid Resend API Key for '{subject}': {exc}")
                if not fail_silently:
                    raise
                return False
            except ValidationError as exc:
                print(f"[RESEND VALIDATION ERROR]: {exc}\n==================================================\n")
                logger.error(f"Resend validation error for '{subject}' to {recipients}: {exc}")
                if not fail_silently:
                    raise
                return False
            except ResendError as exc:
                print(f"[RESEND API ERROR]: {exc}\n==================================================\n")
                logger.error(f"Resend API error for '{subject}' to {recipients}: {exc}")
                if not fail_silently:
                    raise
                return False
            except Exception as exc:
                print(f"[RESEND UNEXPECTED ERROR]: {exc}\n==================================================\n")
                logger.error(f"Unexpected error dispatching email via Resend to {recipients}: {exc}")
                if not fail_silently:
                    raise
                return False

        # 3. Fallback to standard Django mail backend (e.g. console in dev if RESEND_API_KEY is not set)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=sender,
            to=recipients,
        )
        msg.attach_alternative(html_content, "text/html")
        if reply_to:
            msg.reply_to = [reply_to] if isinstance(reply_to, str) else list(reply_to)

        try:
            msg.send(fail_silently=fail_silently)
            logger.info(f"Email '{subject}' successfully dispatched to {recipients}")
            return True
        except Exception as exc:
            logger.error(f"Error dispatching email '{subject}' to {recipients}: {exc}")
            if not fail_silently:
                raise
            return False
