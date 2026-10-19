import logging

from celery import shared_task
from django.utils import timezone

from common.services.email_service import EmailService

logger = logging.getLogger('kodinga.memberships')


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_invitation_email_async(
    self,
    to_email: str,
    subject: str,
    context: dict
):
    """
    Asynchronously dispatch workspace invitation email via EmailService.
    """
    try:
        sent = EmailService.send_mail(
            to_email=to_email,
            subject=subject,
            template_name='workspace_invitation',
            context=context,
            fail_silently=False
        )
        return bool(sent)
    except Exception as exc:
        logger.error(f"Failed to dispatch invitation email to {to_email}: {exc}. Retrying...")
        raise self.retry(exc=exc) from exc


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_invitation_accepted_notice_async(
    self,
    to_email: str,
    subject: str,
    context: dict
):
    """
    Asynchronously notify the workspace admin when an invitation is accepted.
    """
    try:
        sent = EmailService.send_mail(
            to_email=to_email,
            subject=subject,
            template_name='invitation_accepted_notice',
            context=context,
            fail_silently=False
        )
        return bool(sent)
    except Exception as exc:
        logger.error(f"Failed to dispatch acceptance notice to admin {to_email}: {exc}. Retrying...")
        raise self.retry(exc=exc) from exc


@shared_task(bind=True, ignore_result=False)
def expire_outdated_invitations_task(self=None):
    """
    Daily scheduled maintenance job marking past-due pending invitations as expired.
    """
    from apps.memberships.models.invitation import (
        CommunityInvitation,
        InvitationStatus,
    )

    now = timezone.now()
    updated_count = CommunityInvitation.objects.filter(
        status=InvitationStatus.PENDING,
        expires_at__lt=now
    ).update(status=InvitationStatus.EXPIRED)

    logger.info(f"[Celery Beat] expire_outdated_invitations_task updated {updated_count} invitations to 'expired'.")
    return {"expired_count": updated_count, "executed_at": now.isoformat()}
