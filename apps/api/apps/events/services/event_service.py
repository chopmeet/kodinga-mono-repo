import uuid
from typing import Any

from django.db import transaction
from django.utils.text import slugify
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.communities.models.community import Community, CommunityPrivacy
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import Event, EventFormat, EventStatus
from apps.media.models.video_asset import VideoAsset
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


class EventService:
    """
    Handles business logic for community events, LiveKit room creation,
    RSVP tracking and replays.
    """

    @classmethod
    def check_is_manager(cls, actor_user: User, community: Community) -> bool:
        if not actor_user or not actor_user.is_authenticated:
            raise PermissionDenied("Authentification requise.")
        from common.permissions.base import is_superadmin_user
        if is_superadmin_user(actor_user) or community.owner_id == actor_user.id:
            return True
        from apps.memberships.permissions import has_community_permission
        if has_community_permission(actor_user, community, 'can_manage_events'):
            return True
        raise PermissionDenied(
            "Votre rôle ne vous autorise pas à gérer les événements dans cette communauté."
        )

    @classmethod
    def check_active_member(cls, user: User, community: Community) -> bool:
        if not user or not user.is_authenticated:
            raise PermissionDenied("Connexion requise pour accéder aux événements.")
        from common.permissions.base import is_superadmin_user
        if is_superadmin_user(user) or community.owner_id == user.id:
            return True
        is_active = CommunityMember.objects.filter(
            community=community, user=user, status=MembershipStatus.ACTIVE
        ).exists()
        if not is_active:
            raise PermissionDenied("Vous devez être membre actif de cette communauté.")
        return True

    @classmethod
    def create_event(
        cls, actor_user: User, community: Community, data: dict[str, Any]
    ) -> Event:
        cls.check_is_manager(actor_user, community)

        title = data.get("title", "").strip()
        if not title:
            raise ValidationError({"title": "Le titre de l'événement est requis."})

        # Generate unique slug per community
        base_slug = slugify(title) or f"event-{uuid.uuid4().hex[:6]}"
        slug = base_slug
        count = 1
        while Event.objects.filter(community=community, slug=slug).exists():
            slug = f"{base_slug}-{count}"
            count += 1

        format_val = data.get("format", EventFormat.LIVEKIT)
        live_room_name = ""
        if format_val == EventFormat.LIVEKIT:
            live_room_name = f"kodinga_{community.slug[:16]}_{uuid.uuid4().hex[:8]}"

        event = Event.objects.create(
            community=community,
            host=actor_user,
            title=title,
            slug=slug,
            description=data.get("description", ""),
            cover_image_url=data.get("cover_image_url", ""),
            event_type=data.get("event_type", Event.event_type.field.default),
            format=format_val,
            status=data.get("status", EventStatus.SCHEDULED),
            start_time=data["start_time"],
            end_time=data["end_time"],
            timezone=data.get("timezone", "UTC"),
            venue_name=data.get("venue_name", ""),
            location_address=data.get("location_address", ""),
            location_city=data.get("location_city", ""),
            location_country=data.get("location_country", ""),
            location_url=data.get("location_url", ""),
            live_room_name=live_room_name,
            max_attendees=data.get("max_attendees"),
            is_recorded=data.get("is_recorded", True),
            is_public=data.get("is_public", True),
            metadata=data.get("metadata", {}),
        )

        # Host automatically enrolled as attending
        EventAttendee.objects.get_or_create(
            event=event, user=actor_user, defaults={"status": AttendeeStatus.ATTENDING}
        )
        event.attendees_count = 1
        event.save(update_fields=["attendees_count"])

        return event

    @classmethod
    def update_event(
        cls, actor_user: User, event: Event, data: dict[str, Any]
    ) -> Event:
        # Host or Manager can update
        if event.host_id != actor_user.id:
            cls.check_is_manager(actor_user, event.community)

        fields = [
            "title",
            "description",
            "cover_image_url",
            "event_type",
            "format",
            "start_time",
            "end_time",
            "timezone",
            "venue_name",
            "location_address",
            "location_city",
            "location_country",
            "location_url",
            "max_attendees",
            "is_recorded",
            "is_public",
            "metadata",
        ]
        for field in fields:
            if field in data:
                setattr(event, field, data[field])

        # If converted to LiveKit format and no room name
        if event.format == EventFormat.LIVEKIT and not event.live_room_name:
            event.live_room_name = (
                f"kodinga_{event.community.slug[:16]}_{uuid.uuid4().hex[:8]}"
            )

        event.save()
        return event

    @classmethod
    def delete_event(cls, actor_user: User, event: Event) -> None:
        if event.host_id != actor_user.id:
            cls.check_is_manager(actor_user, event.community)
        event.delete()

    @classmethod
    def rsvp_event(
        cls, user: User, event: Event, status: str = AttendeeStatus.ATTENDING
    ) -> EventAttendee:
        if not user or not user.is_authenticated:
            raise PermissionDenied("Connexion requise pour s'inscrire à l'événement.")

        # If the event is NOT public, user must be active member of community.
        # If community is secret, user must also be active member.
        # If the event IS public (even in a private community), any user can register!
        if not event.is_public or event.community.privacy_type == CommunityPrivacy.SECRET:
            cls.check_active_member(user, event.community)

        with transaction.atomic():
            attendee, created = EventAttendee.objects.get_or_create(
                event=event, user=user, defaults={"status": status}
            )

            if not created and attendee.status != status:
                if status == AttendeeStatus.ATTENDING and event.is_full:
                    raise ValidationError(
                        "Cet événement a atteint sa capacité maximale d'inscriptions."
                    )
                attendee.status = status
                attendee.save(update_fields=["status", "updated_at"])
            elif created and status == AttendeeStatus.ATTENDING and event.is_full:
                raise ValidationError(
                    "Cet événement a atteint sa capacité maximale d'inscriptions."
                )

            # Update count
            count = EventAttendee.objects.filter(
                event=event, status=AttendeeStatus.ATTENDING
            ).count()
            event.attendees_count = count
            event.save(update_fields=["attendees_count"])

            if status == AttendeeStatus.ATTENDING:

                def send_conf():
                    try:
                        from apps.events.tasks import send_event_confirmation_email_task

                        send_event_confirmation_email_task.delay(
                            str(user.id), str(event.id)
                        )
                    except Exception:
                        pass

                transaction.on_commit(send_conf)

            return attendee

    @classmethod
    def cancel_rsvp(cls, user: User, event: Event) -> None:
        if not user or not user.is_authenticated:
            raise PermissionDenied("Connexion requise.")

        if not event.is_public or event.community.privacy_type == CommunityPrivacy.SECRET:
            cls.check_active_member(user, event.community)

        with transaction.atomic():
            EventAttendee.objects.filter(event=event, user=user).delete()
            count = EventAttendee.objects.filter(
                event=event, status=AttendeeStatus.ATTENDING
            ).count()
            event.attendees_count = count
            event.save(update_fields=["attendees_count"])

    @classmethod
    def update_event_status(
        cls, actor_user: User, event: Event, new_status: str
    ) -> Event:
        if event.host_id != actor_user.id:
            cls.check_is_manager(actor_user, event.community)

        if new_status not in EventStatus.values:
            raise ValidationError(
                {"status": f"Statut invalide. Choix: {EventStatus.values}"}
            )

        event.status = new_status
        event.save(update_fields=["status", "updated_at"])
        return event

    @classmethod
    def attach_replay(
        cls, actor_user: User, event: Event, video_asset_id: str
    ) -> Event:
        if event.host_id != actor_user.id:
            cls.check_is_manager(actor_user, event.community)

        try:
            video_asset = VideoAsset.objects.get(id=video_asset_id)
        except (VideoAsset.DoesNotExist, ValueError):
            raise ValidationError(
                {"video_asset_id": "Asset vidéo introuvable."}
            ) from None

        event.replay_video_asset = video_asset
        if event.status != EventStatus.COMPLETED:
            event.status = EventStatus.COMPLETED
        event.save(update_fields=["replay_video_asset", "status", "updated_at"])
        return event
