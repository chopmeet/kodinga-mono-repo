from typing import Optional

from django.db.models import QuerySet
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import Event, EventStatus
from apps.events.services.event_service import EventService


class EventSelector:
    """
    Optimized queries for reading community events and member attendance.
    """

    @classmethod
    def list_community_events(
        cls,
        community: Community,
        user: Optional[User] = None,
        status: Optional[str] = None,
        event_type: Optional[str] = None,
        upcoming: Optional[bool] = None,
    ) -> QuerySet[Event]:
        if user and user.is_authenticated:
            EventService.check_active_member(user, community)

        qs = Event.objects.filter(community=community).select_related(
            "community", "host", "replay_video_asset"
        )

        if status:
            qs = qs.filter(status=status)

        if event_type:
            qs = qs.filter(event_type=event_type)

        now = timezone.now()
        if upcoming is True:
            qs = (
                qs.filter(end_time__gte=now)
                .exclude(status=EventStatus.CANCELLED)
                .order_by("start_time")
            )
        elif upcoming is False:
            qs = qs.filter(end_time__lt=now).order_by("-start_time")
        else:
            qs = qs.order_by("start_time")

        # Annotate user RSVP status if authenticated
        if user and user.is_authenticated:
            rsvp_map = dict(
                EventAttendee.objects.filter(event__in=qs, user=user).values_list(
                    "event_id", "status"
                )
            )
            events_list = list(qs)
            for ev in events_list:
                ev.user_rsvp_status = rsvp_map.get(ev.id)
            return events_list

        return qs

    @classmethod
    def get_event_by_id_or_slug(
        cls, community: Community, identifier: str, user: Optional[User] = None
    ) -> Event:
        if user and user.is_authenticated:
            EventService.check_active_member(user, community)

        qs = Event.objects.filter(community=community).select_related(
            "community", "host", "replay_video_asset"
        )

        import uuid

        def is_valid_uuid(val: str) -> bool:
            try:
                uuid.UUID(str(val))
                return True
            except (ValueError, AttributeError, TypeError):
                return False

        if is_valid_uuid(identifier):
            event = qs.filter(id=identifier).first()
            if not event:
                event = qs.filter(slug=identifier).first()
        else:
            event = qs.filter(slug=identifier).first()

        if not event:
            raise NotFound("Événement introuvable.")

        if user and user.is_authenticated:
            attendee = EventAttendee.objects.filter(event=event, user=user).first()
            event.user_rsvp_status = attendee.status if attendee else None
        else:
            event.user_rsvp_status = None

        return event

    @classmethod
    def list_user_attending_events(cls, user: User) -> list:
        """
        List all upcoming events that the user has RSVP'd to.
        """
        now = timezone.now()
        attendees = (
            EventAttendee.objects.filter(
                user=user,
                status=AttendeeStatus.ATTENDING,
                event__end_time__gte=now,
                event__status__in=[EventStatus.SCHEDULED, EventStatus.LIVE],
            )
            .select_related(
                "event__community", "event__host", "event__replay_video_asset"
            )
            .order_by("event__start_time")
        )

        events = []
        for a in attendees:
            ev = a.event
            ev.user_rsvp_status = AttendeeStatus.ATTENDING
            events.append(ev)
        return events
