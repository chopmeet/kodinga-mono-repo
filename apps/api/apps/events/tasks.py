import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from apps.accounts.models.user import User
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import Event, EventStatus
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
def send_event_reminders_task(self) -> int:
    """
    Periodic Celery task querying upcoming events starting within 1 hour
    and dispatching reminder emails to all attendees with reminder_sent=False.
    """
    now = timezone.now()
    reminder_window_end = now + timedelta(hours=1)

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

        event_url = (
            f"{frontend_url}/c/{event.community.slug}/events/{event.slug or event.id}"
        )

        for attendee in attendees:
            user = attendee.user
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
                sent = EmailService.send_mail(
                    to_email=user.email,
                    subject=f"Rappel : {event.title} commence bientôt !",
                    template_name="event_reminder",
                    context=context,
                    fail_silently=True,
                )
                if sent:
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
