import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from apps.accounts.models.user import User
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import Event, EventStatus
from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService
from common.services.email_service import EmailService

logger = logging.getLogger("kodinga.events")


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_event_confirmation_email_task(self, user_id: str, event_id: str) -> bool:
    """
    Celery task to asynchronously send RSVP confirmation email to attendee.
    """
    try:
        user = User.objects.get(id=user_id)
        event = Event.objects.select_related("community").get(id=event_id)
    except (User.DoesNotExist, Event.DoesNotExist) as e:
        logger.warning(f"Unable to send RSVP confirmation: User/Event not found ({e})")
        return False

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    event_url = (
        f"{frontend_url}/c/{event.community.slug}/events/{event.slug or event.id}"
    )

    context = {
        "first_name": user.first_name,
        "username": user.username,
        "event_title": event.title,
        "community_name": event.community.name,
        "event_date": event.start_time.strftime("%d/%m/%Y"),
        "event_time": event.start_time.strftime("%H:%M"),
        "timezone": event.timezone,
        "event_format": event.get_format_display(),
        "event_url": event_url,
    }

    try:
        return EmailService.send_mail(
            to_email=user.email,
            subject=f"Confirmation : {event.title} - {event.community.name}",
            template_name="event_confirmation",
            context=context,
        )
    except Exception as exc:
        logger.error(f"Failed sending event confirmation email to {user.email}: {exc}")
        raise self.retry(exc=exc) from exc


@shared_task(bind=True, max_retries=2, default_retry_delay=120)
def send_event_reminders_task(self, minutes_before: int = 30) -> int:
    """
    Periodic Celery task querying upcoming scheduled events starting within
    `minutes_before` minutes (default: 30 minutes) and dispatching both
    in-app notifications and reminder emails to registered (ATTENDING) attendees
    with reminder_sent=False. Excludes cancelled/completed events.
    """
    now = timezone.now()
    reminder_window_end = now + timedelta(minutes=minutes_before)

    upcoming_events = Event.objects.filter(
        status=EventStatus.SCHEDULED,
        start_time__gte=now,
        start_time__lte=reminder_window_end,
    ).select_related("community")

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    total_sent = 0

    for event in upcoming_events:
        attendees = EventAttendee.objects.filter(
            event=event,
            status=AttendeeStatus.ATTENDING,
            reminder_sent=False,
        ).select_related("user")

        from zoneinfo import ZoneInfo

        try:
            tz = ZoneInfo(event.timezone) if event.timezone else ZoneInfo("UTC")
        except Exception:
            tz = ZoneInfo("UTC")
        local_start = event.start_time.astimezone(tz)
        event_time_str = local_start.strftime("%H:%M")
        event_date_str = local_start.strftime("%d/%m/%Y")

        event_target = event.slug or str(event.id)
        action_path = f"/c/{event.community.slug}/events/{event_target}"
        event_url = f"{frontend_url}/c/{event.community.slug}/events/{event_target}"

        for attendee in attendees:
            user = attendee.user
            context = {
                "first_name": user.first_name,
                "username": user.username,
                "event_title": event.title,
                "community_name": event.community.name,
                "event_date": event_date_str,
                "event_time": event_time_str,
                "timezone": event.timezone,
                "event_format": event.get_format_display(),
                "event_url": event_url,
            }

            try:
                # 1. Dispatch in-app notification (even if user is also the host)
                notif = NotificationService.create_notification(
                    recipient=user,
                    actor=None,
                    title=f"Rappel : {event.title} commence dans 30 minutes",
                    body=(
                        f"L'événement « {event.title} » de la communauté "
                        f"{event.community.name} débute à {event_time_str} ({event.timezone or 'UTC'})."
                    ),
                    notification_type=NotificationType.EVENT_REMINDER,
                    action_url=action_path,
                    target_type="event",
                    target_id=str(event.id),
                    metadata={
                        "event_id": str(event.id),
                        "event_slug": event.slug,
                        "community_id": str(event.community_id),
                        "community_slug": event.community.slug,
                        "start_time": event.start_time.isoformat(),
                        "timezone": event.timezone,
                    },
                )

                # 2. Dispatch reminder email
                email_sent = EmailService.send_mail(
                    to_email=user.email,
                    subject=f"Rappel : {event.title} commence bientôt !",
                    template_name="event_reminder",
                    context=context,
                    fail_silently=True,
                )

                if notif is not None or email_sent:
                    attendee.reminder_sent = True
                    attendee.save(update_fields=["reminder_sent", "updated_at"])
                    total_sent += 1
            except Exception as exc:
                logger.warning(
                    f"Failed reminder for event {event.id} to {user.email}: {exc}"
                )

    logger.info(
        f"[Event Reminders] Dispatched {total_sent} reminders for upcoming events."
    )
    return total_sent


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def transcribe_event_replay_task(
    self, event_id: str, language: str = "fr", force: bool = False
) -> dict:
    """
    Asynchronous Celery task to transcribe a live event replay,
    extract timestamps and speakers, and generate the executive summary.
    Updates event.metadata["transcription_status"] to 'ready' or 'failed'.
    """
    from apps.events.models.event import Event
    from apps.events.services.transcription_service import EventTranscriptionService

    try:
        event = Event.objects.select_related(
            "community", "host", "replay_video_asset"
        ).get(id=event_id)
    except Event.DoesNotExist:
        logger.warning(f"Event {event_id} not found for async transcription.")
        return {"status": "failed", "error": "Événement introuvable."}

    return EventTranscriptionService.process_transcription(
        event=event, language=language, force=force
    )
