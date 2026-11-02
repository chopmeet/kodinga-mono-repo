import logging

from celery import shared_task
from common.services.email_service import EmailService

logger = logging.getLogger('kodinga.tasks')


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_async_task(self, to_email: str, subject: str, template_name: str, context: dict):
    """
    Celery task to asynchronously send transactional emails with retries.
    """
    try:
        EmailService.send_mail(
            to_email=to_email,
            subject=subject,
            template_name=template_name,
            context=context
        )
    except Exception as exc:
        logger.error(f"Failed sending email '{subject}' to {to_email}: {exc}. Retrying...")
        raise self.retry(exc=exc) from exc
