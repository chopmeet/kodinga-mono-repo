import uuid
from typing import Optional

from django.db.models import Q, QuerySet
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.accounts.models.user import User
from apps.communities.models.community import Community, CommunityPrivacy
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import Event, EventStatus
from apps.events.services.event_service import EventService
from apps.memberships.models.member import CommunityMember, MembershipStatus


class EventSelector:
    """
    Optimized queries for reading community events and member attendance.
    Supports public access to events marked is_public=True even in private communities.
    """

    @classmethod
    def list_community_events(
        cls,
        community: Community,
        user: Optional[User] = None,
        status: Optional[str] = None,
        event_type: Optional[str] = None,
        upcoming: Optional[bool] = None,
        has_replay: Optional[bool] = None,
    ) -> QuerySet[Event]:
        is_member_or_manager = False
        if user and user.is_authenticated:
            from common.permissions.base import is_superadmin_user
            if is_superadmin_user(user) or community.owner_id == user.id:
                is_member_or_manager = True
            else:
                is_member_or_manager = CommunityMember.objects.filter(
                    community=community, user=user, status=MembershipStatus.ACTIVE
                ).exists()

        # If community is secret, non-members cannot see any events
        if community.privacy_type == CommunityPrivacy.SECRET and not is_member_or_manager:
            raise PermissionDenied("Cette communauté est secrète.")

        qs = Event.objects.filter(community=community).select_related(
            "community", "host", "replay_video_asset"
        )

        # Non-members only see events that are explicitly public
        if not is_member_or_manager:
            qs = qs.filter(is_public=True)

        if status:
            qs = qs.filter(status=status)

        if event_type:
            qs = qs.filter(event_type=event_type)

        if has_replay is True:
            qs = qs.filter(replay_video_asset__isnull=False)
        elif has_replay is False:
            qs = qs.filter(replay_video_asset__isnull=True)

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
        qs = Event.objects.filter(community=community).select_related(
            "community", "host", "replay_video_asset"
        )

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

        # Check visibility permission
        if not event.is_public or community.privacy_type == CommunityPrivacy.SECRET:
            EventService.check_active_member(user, community)

        if user and user.is_authenticated:
            attendee = EventAttendee.objects.filter(event=event, user=user).first()
            event.user_rsvp_status = attendee.status if attendee else None
        else:
            event.user_rsvp_status = None

        return event

    @classmethod
    def list_public_events(
        cls,
        user: Optional[User] = None,
        format_val: Optional[str] = None,
        event_type: Optional[str] = None,
        upcoming: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> QuerySet[Event]:
        """
        List all public events across communities, including public events from private communities.
        """
        qs = (
            Event.objects.filter(is_public=True)
            .exclude(community__privacy_type=CommunityPrivacy.SECRET)
            .select_related("community", "host", "replay_video_asset")
        )

        if format_val:
            qs = qs.filter(format=format_val)

        if event_type:
            qs = qs.filter(event_type=event_type)

        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(venue_name__icontains=search)
                | Q(location_city__icontains=search)
                | Q(community__name__icontains=search)
            )

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
