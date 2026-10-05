import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger('kodinga.email')


class EmailService:
    """
    Centralized email delivery service rendering dynamic HTML/TXT templates with support
    for synchronous dispatch and Celery background queueing.
    """

    @classmethod
    def send_mail(
        cls,
        to_email: str,
        subject: str,
        template_name: str,
        context: dict,
        from_email: str = None,
        fail_silently: bool = False
    ) -> bool:
        """
        Renders template_name.html and template_name.txt (or auto-stripped) and dispatches via SMTP.
        """
        sender = from_email or getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@kodinga.com')
        base_context = {
            'app_name': getattr(settings, 'APP_NAME', 'Kodinga'),
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

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=sender,
            to=[to_email] if isinstance(to_email, str) else to_email,
        )
        msg.attach_alternative(html_content, "text/html")

        try:
            msg.send(fail_silently=fail_silently)
            logger.info(f"Email '{subject}' successfully dispatched to {to_email}")
            return True
        except Exception as exc:
            logger.error(f"Error dispatching email '{subject}' to {to_email}: {exc}")
            if not fail_silently:
                raise
            return False
