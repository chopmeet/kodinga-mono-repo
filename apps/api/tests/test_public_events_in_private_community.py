from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.communities.models.community import Community, CommunityPrivacy
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import Event, EventFormat, EventType
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        email="owner_private@kodinga.com",
        username="owner_private",
        password="Password123!",
    )


@pytest.fixture
def member(db):
    return User.objects.create_user(
        email="member_private@kodinga.com",
        username="member_private",
        password="Password123!",
    )


@pytest.fixture
def stranger(db):
    return User.objects.create_user(
        email="stranger_external@kodinga.com",
        username="stranger_external",
        password="Password123!",
    )


@pytest.fixture
def private_community(owner, member):
    comm = Community.objects.create(
        owner=owner,
        name="Private AI Dakar Club",
        slug="private-ai-dakar",
        privacy_type=CommunityPrivacy.PRIVATE,
    )
    # Owner membership
    CommunityMember.objects.create(
        community=comm,
        user=owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    # Member membership
    CommunityMember.objects.create(
        community=comm,
        user=member,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.fixture
def secret_community(owner):
    comm = Community.objects.create(
        owner=owner,
        name="Top Secret Club",
        slug="top-secret-club",
        privacy_type=CommunityPrivacy.SECRET,
    )
    CommunityMember.objects.create(
        community=comm,
        user=owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.mark.django_db
class TestPublicEventsInPrivateCommunity:
    def test_create_in_person_event_with_physical_location(
        self, api_client, owner, private_community
    ):
        api_client.force_authenticate(user=owner)
        start = timezone.now() + timedelta(days=2)
        end = start + timedelta(hours=3)

        payload = {
            "title": "Atelier Présentiel IA & Python",
            "description": "Rencontre physique à Dakar",
            "event_type": EventType.WORKSHOP,
            "format": EventFormat.IN_PERSON,
            "venue_name": "Hub Sénégal Numérique",
            "location_address": "Point E, Immeuble Alpha, 3ème étage",
            "location_city": "Dakar",
            "location_country": "Sénégal",
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "is_public": True,
        }

        url = f"/api/v1/communities/{private_community.slug}/events/"
        response = api_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        data = response.data["data"]
        assert data["format"] == EventFormat.IN_PERSON
        assert data["is_public"] is True
        assert data["venue_name"] == "Hub Sénégal Numérique"
        assert data["location_city"] == "Dakar"
        assert data["location_country"] == "Sénégal"

    def test_create_online_webinar_event(self, api_client, owner, private_community):
        api_client.force_authenticate(user=owner)
        start = timezone.now() + timedelta(days=3)
        end = start + timedelta(hours=2)

        payload = {
            "title": "Webinaire International LiveKit",
            "description": "Webinaire en ligne ouvert à tous",
            "event_type": EventType.WEBINAR,
            "format": EventFormat.LIVEKIT,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "is_public": True,
        }

        url = f"/api/v1/communities/{private_community.slug}/events/"
        response = api_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        data = response.data["data"]
        assert data["format"] == EventFormat.LIVEKIT
        assert data["is_public"] is True
        assert data["live_room_name"] is not None

    def test_non_member_can_view_public_event_in_private_community(
        self, api_client, owner, stranger, private_community
    ):
        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(hours=2)

        # 1 public event in private community
        pub_event = Event.objects.create(
            community=private_community,
            host=owner,
            title="Public Demo in Private Community",
            event_type=EventType.WEBINAR,
            format=EventFormat.LIVEKIT,
            start_time=start,
            end_time=end,
            is_public=True,
        )

        # 1 private event in private community
        priv_event = Event.objects.create(
            community=private_community,
            host=owner,
            title="Internal Secret Strategy Meeting",
            event_type=EventType.MEETUP,
            format=EventFormat.LIVEKIT,
            start_time=start,
            end_time=end,
            is_public=False,
        )

        # Stranger requests community event list
        api_client.force_authenticate(user=stranger)
        url = f"/api/v1/communities/{private_community.slug}/events/"
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK

        results = response.data.get("results", response.data.get("data", []))
        ids = [ev["id"] for ev in results]
        assert str(pub_event.id) in ids
        assert str(priv_event.id) not in ids

        # Stranger requests single event detail
        detail_url = (
            f"/api/v1/communities/{private_community.slug}/events/{pub_event.slug}/"
        )
        detail_resp = api_client.get(detail_url)
        assert detail_resp.status_code == status.HTTP_200_OK
        assert detail_resp.data["data"]["id"] == str(pub_event.id)

        # Stranger cannot request private event detail
        priv_detail_url = (
            f"/api/v1/communities/{private_community.slug}/events/{priv_event.slug}/"
        )
        priv_resp = api_client.get(priv_detail_url)
        assert priv_resp.status_code == status.HTTP_403_FORBIDDEN

    def test_non_member_can_rsvp_to_public_event_in_private_community(
        self, api_client, owner, stranger, private_community
    ):
        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(hours=2)

        pub_event = Event.objects.create(
            community=private_community,
            host=owner,
            title="In-Person Tech Summit Dakar",
            event_type=EventType.WORKSHOP,
            format=EventFormat.IN_PERSON,
            venue_name="Grand Théâtre",
            location_city="Dakar",
            start_time=start,
            end_time=end,
            is_public=True,
        )

        # Stranger RSVPs
        api_client.force_authenticate(user=stranger)
        rsvp_url = (
            f"/api/v1/communities/{private_community.slug}/events/{pub_event.id}/rsvp/"
        )
        response = api_client.post(rsvp_url, {"status": "attending"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["status"] == AttendeeStatus.ATTENDING

        # Check in DB
        attendee = EventAttendee.objects.filter(event=pub_event, user=stranger).first()
        assert attendee is not None
        assert attendee.status == AttendeeStatus.ATTENDING

        # Stranger cancels RSVP
        cancel_resp = api_client.delete(rsvp_url)
        assert cancel_resp.status_code == status.HTTP_200_OK
        assert not EventAttendee.objects.filter(event=pub_event, user=stranger).exists()

    def test_non_member_can_join_livekit_for_public_event(
        self, api_client, owner, stranger, private_community
    ):
        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(hours=2)

        pub_livekit_event = Event.objects.create(
            community=private_community,
            host=owner,
            title="Public Open Webinar",
            event_type=EventType.WEBINAR,
            format=EventFormat.LIVEKIT,
            live_room_name="test_public_room_123",
            start_time=start,
            end_time=end,
            is_public=True,
        )

        api_client.force_authenticate(user=stranger)
        join_url = f"/api/v1/communities/{private_community.slug}/events/{pub_livekit_event.id}/join-live/"
        response = api_client.post(join_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["room_name"] == "test_public_room_123"
        assert "token" in response.data["data"]

    def test_global_public_events_endpoint(
        self, api_client, owner, private_community, secret_community
    ):
        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(hours=2)

        # Public in private community
        ev1 = Event.objects.create(
            community=private_community,
            host=owner,
            title="Public Meetup in Private Community",
            event_type=EventType.MEETUP,
            format=EventFormat.IN_PERSON,
            venue_name="Place du Souvenir",
            location_city="Dakar",
            start_time=start,
            end_time=end,
            is_public=True,
        )

        # Private in private community
        Event.objects.create(
            community=private_community,
            host=owner,
            title="Private Internal Meeting",
            event_type=EventType.MEETUP,
            format=EventFormat.IN_PERSON,
            start_time=start,
            end_time=end,
            is_public=False,
        )

        # Public flag in SECRET community -> MUST NOT leak
        Event.objects.create(
            community=secret_community,
            host=owner,
            title="Secret Leaked Candidate",
            event_type=EventType.MEETUP,
            format=EventFormat.IN_PERSON,
            start_time=start,
            end_time=end,
            is_public=True,
        )

        # Query global endpoint anonymously
        response = api_client.get("/api/v1/events/?all=true")
        assert response.status_code == status.HTTP_200_OK
        items = response.data["data"]
        ids = [it["id"] for it in items]
        assert str(ev1.id) in ids
        assert len(ids) == 1

        # Search filter
        search_resp = api_client.get("/api/v1/events/?search=Souvenir&all=true")
        assert search_resp.status_code == status.HTTP_200_OK
        assert len(search_resp.data["data"]) == 1

    def test_calendar_ics_includes_physical_address(
        self, api_client, owner, private_community
    ):
        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(hours=2)

        ev = Event.objects.create(
            community=private_community,
            host=owner,
            title="Grand Rassemblement Tech",
            event_type=EventType.WORKSHOP,
            format=EventFormat.IN_PERSON,
            venue_name="Sénégal Cyber Village",
            location_address="Voie 10",
            location_city="Dakar",
            location_country="Sénégal",
            start_time=start,
            end_time=end,
            is_public=True,
        )

        url = (
            f"/api/v1/communities/{private_community.slug}/events/{ev.id}/calendar.ics"
        )
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        ics_text = response.content.decode("utf-8")
        assert "LOCATION:Sénégal Cyber Village, Voie 10, Dakar, Sénégal" in ics_text
