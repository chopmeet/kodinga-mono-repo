from datetime import timedelta
from unittest.mock import patch

import jwt
import pytest
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.communities.models.community import Community, CommunityPrivacy
from apps.communities.models.settings import CommunitySettings
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import Event, EventFormat, EventStatus, EventType
from apps.media.models.video_asset import VideoAsset, VideoStatus
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_owner(db):
    return User.objects.create_user(
        email="owner_events@kodinga.com",
        username="owner_events",
        password="SecurePassword123!",
    )


@pytest.fixture
def user_member(db):
    return User.objects.create_user(
        email="member_events@kodinga.com",
        username="member_events",
        password="SecurePassword123!",
    )


@pytest.fixture
def user_stranger(db):
    return User.objects.create_user(
        email="stranger@kodinga.com",
        username="stranger_events",
        password="SecurePassword123!",
    )


@pytest.fixture
def community(user_owner):
    comm = Community.objects.create(
        owner=user_owner,
        name="Python Dakar Community",
        slug="python-dakar",
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunitySettings.objects.create(community=comm)
    CommunityMember.objects.create(
        community=comm,
        user=user_owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.fixture
def member_membership(community, user_member):
    return CommunityMember.objects.create(
        community=community,
        user=user_member,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )


@pytest.fixture
def video_asset(user_owner):
    return VideoAsset.objects.create(
        user=user_owner,
        title="Session Replay 01",
        playback_id="live_playback_12345",
        status=VideoStatus.READY,
    )


@pytest.fixture
def scheduled_event(community, user_owner):
    now = timezone.now()
    event = Event.objects.create(
        community=community,
        host=user_owner,
        title="Live Django & LiveKit Workshop",
        slug="live-django-livekit-workshop",
        description="Introduction au live streaming interactif avec LiveKit et Django",
        event_type=EventType.WORKSHOP,
        format=EventFormat.LIVEKIT,
        status=EventStatus.SCHEDULED,
        start_time=now + timedelta(days=2),
        end_time=now + timedelta(days=2, hours=2),
        live_room_name="kodinga_python_dakar_live1",
        max_attendees=50,
        attendees_count=1,
    )
    EventAttendee.objects.create(
        event=event,
        user=user_owner,
        status=AttendeeStatus.ATTENDING,
    )
    return event


@pytest.mark.django_db
def test_create_event_by_owner(api_client, user_owner, community):
    api_client.force_authenticate(user=user_owner)
    start = timezone.now() + timedelta(days=3)
    end = start + timedelta(hours=2)

    payload = {
        "title": "Masterclass WebRTC & LiveKit",
        "description": "Apprendre à connecter des flux WebRTC temps-réel",
        "event_type": EventType.WEBINAR,
        "format": EventFormat.LIVEKIT,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "timezone": "UTC",
        "max_attendees": 100,
    }

    url = f"/api/v1/communities/{community.slug}/events/"
    response = api_client.post(url, data=payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    data = response.data["data"]
    assert data["title"] == "Masterclass WebRTC & LiveKit"
    assert data["slug"] == "masterclass-webrtc-livekit"
    assert data["format"] == EventFormat.LIVEKIT
    assert data["live_room_name"].startswith("kodinga_python-dakar_")
    assert data["attendees_count"] == 1
    assert data["is_full"] is False


@pytest.mark.django_db
def test_create_event_forbidden_for_regular_member(
    api_client, user_member, member_membership, community
):
    api_client.force_authenticate(user=user_member)
    start = timezone.now() + timedelta(days=1)
    end = start + timedelta(hours=1)

    payload = {
        "title": "Unauthorized Event",
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
    }

    url = f"/api/v1/communities/{community.slug}/events/"
    response = api_client.post(url, data=payload, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_create_event_invalid_dates(api_client, user_owner, community):
    api_client.force_authenticate(user=user_owner)
    start = timezone.now() + timedelta(days=3)
    end = start - timedelta(hours=1)

    payload = {
        "title": "Invalid End Time Event",
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
    }

    url = f"/api/v1/communities/{community.slug}/events/"
    response = api_client.post(url, data=payload, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_list_events(api_client, user_member, member_membership, scheduled_event):
    api_client.force_authenticate(user=user_member)
    url = f"/api/v1/communities/{scheduled_event.community.slug}/events/?all=true"
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.data["data"]
    assert len(data) >= 1
    assert data[0]["id"] == str(scheduled_event.id)
    assert data[0]["title"] == scheduled_event.title


@pytest.mark.django_db
def test_get_event_detail_by_slug_and_id(
    api_client, user_member, member_membership, scheduled_event
):
    api_client.force_authenticate(user=user_member)
    comm_slug = scheduled_event.community.slug

    # By UUID
    url_id = f"/api/v1/communities/{comm_slug}/events/{scheduled_event.id}/"
    res_id = api_client.get(url_id)
    assert res_id.status_code == status.HTTP_200_OK
    assert res_id.data["data"]["slug"] == scheduled_event.slug

    # By Slug
    url_slug = f"/api/v1/communities/{comm_slug}/events/{scheduled_event.slug}/"
    res_slug = api_client.get(url_slug)
    assert res_slug.status_code == status.HTTP_200_OK
    assert res_slug.data["data"]["id"] == str(scheduled_event.id)


@pytest.mark.django_db
def test_update_and_delete_event(api_client, user_owner, scheduled_event):
    api_client.force_authenticate(user=user_owner)
    comm_slug = scheduled_event.community.slug
    url = f"/api/v1/communities/{comm_slug}/events/{scheduled_event.id}/"

    # Patch
    patch_res = api_client.patch(
        url, data={"title": "Updated Workshop Title"}, format="json"
    )
    assert patch_res.status_code == status.HTTP_200_OK
    assert patch_res.data["data"]["title"] == "Updated Workshop Title"

    # Delete
    del_res = api_client.delete(url)
    assert del_res.status_code == status.HTTP_200_OK
    assert not Event.objects.filter(id=scheduled_event.id).exists()


@pytest.mark.django_db
def test_rsvp_and_capacity_limit(
    api_client, user_member, member_membership, scheduled_event
):
    api_client.force_authenticate(user=user_member)
    comm_slug = scheduled_event.community.slug
    url = f"/api/v1/communities/{comm_slug}/events/{scheduled_event.id}/rsvp/"

    # RSVP attending
    res = api_client.post(url, data={"status": AttendeeStatus.ATTENDING}, format="json")
    assert res.status_code == status.HTTP_200_OK
    scheduled_event.refresh_from_db()
    assert scheduled_event.attendees_count == 2

    attendees_url = (
        f"/api/v1/communities/{comm_slug}/events/"
        f"{scheduled_event.id}/attendees/?all=true"
    )
    att_res = api_client.get(attendees_url)
    assert att_res.status_code == status.HTTP_200_OK
    assert len(att_res.data["data"]) == 2

    # Capacity limit test
    scheduled_event.max_attendees = 2
    scheduled_event.save(update_fields=["max_attendees"])

    other_user = User.objects.create_user(
        email="overflow@kodinga.com",
        username="overflow_dev",
        password="SecurePassword123!",
    )
    CommunityMember.objects.create(
        community=scheduled_event.community,
        user=other_user,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    api_client.force_authenticate(user=other_user)
    over_res = api_client.post(
        url, data={"status": AttendeeStatus.ATTENDING}, format="json"
    )
    assert over_res.status_code == status.HTTP_400_BAD_REQUEST

    # Cancel RSVP
    api_client.force_authenticate(user=user_member)
    del_res = api_client.delete(url)
    assert del_res.status_code == status.HTTP_200_OK
    scheduled_event.refresh_from_db()
    assert scheduled_event.attendees_count == 1


@pytest.mark.django_db
def test_join_live_room_livekit_token(
    api_client, user_owner, user_member, member_membership, scheduled_event
):
    comm_slug = scheduled_event.community.slug
    url = f"/api/v1/communities/{comm_slug}/events/{scheduled_event.id}/join-live/"

    # 1. Host joins
    api_client.force_authenticate(user=user_owner)
    res_host = api_client.post(url)
    assert res_host.status_code == status.HTTP_200_OK
    host_data = res_host.data["data"]
    assert host_data["is_host"] is True
    assert host_data["room_name"] == scheduled_event.live_room_name
    assert "token" in host_data

    # Decode and verify LiveKit token grants
    decoded_host = jwt.decode(
        host_data["token"],
        settings.LIVEKIT_API_SECRET,
        algorithms=["HS256"],
        options={"verify_exp": False},
    )
    assert decoded_host["video"]["room"] == scheduled_event.live_room_name
    assert decoded_host["video"]["canPublish"] is True
    assert decoded_host["video"]["roomAdmin"] is True

    # 2. Attendee joins
    api_client.force_authenticate(user=user_member)
    res_member = api_client.post(url)
    assert res_member.status_code == status.HTTP_200_OK
    member_data = res_member.data["data"]
    assert member_data["is_host"] is False

    decoded_member = jwt.decode(
        member_data["token"],
        settings.LIVEKIT_API_SECRET,
        algorithms=["HS256"],
        options={"verify_exp": False},
    )
    assert decoded_member["video"]["canPublish"] is False
    assert decoded_member["video"]["canSubscribe"] is True
    assert decoded_member["video"]["canPublishData"] is True

    # Check-in timestamp verified
    attendee = EventAttendee.objects.get(event=scheduled_event, user=user_member)
    assert attendee.checked_in_at is not None


@pytest.mark.django_db
def test_private_live_requires_active_membership(
    api_client, user_owner, user_member, member_membership, scheduled_event
):
    comm_slug = scheduled_event.community.slug
    scheduled_event.is_public = False
    scheduled_event.save(update_fields=["is_public"])

    non_member = User.objects.create_user(
        email="outsider@kodinga.com",
        username="outsider",
        password="SecurePassword123!",
    )
    url = f"/api/v1/communities/{comm_slug}/events/{scheduled_event.id}/join-live/"

    # 1. Non-member cannot join private live -> 403 Forbidden
    api_client.force_authenticate(user=non_member)
    res_non_member = api_client.post(url)
    assert res_non_member.status_code == status.HTTP_403_FORBIDDEN
    assert "membre actif" in res_non_member.data["message"]

    # 2. Member can join private live -> 200 OK
    api_client.force_authenticate(user=user_member)
    res_member = api_client.post(url)
    assert res_member.status_code == status.HTTP_200_OK

    # 3. Community detail shows active_live with is_public: false
    scheduled_event.status = EventStatus.LIVE
    scheduled_event.save(update_fields=["status"])

    detail_url = f"/api/v1/communities/{comm_slug}/"
    res_detail = api_client.get(detail_url)
    assert res_detail.status_code == status.HTTP_200_OK
    assert res_detail.data["data"]["active_live"] is not None
    assert res_detail.data["data"]["active_live"]["id"] == str(scheduled_event.id)
    assert res_detail.data["data"]["active_live"]["is_public"] is False


@pytest.mark.django_db
def test_event_status_and_replay_attach(
    api_client, user_owner, scheduled_event, video_asset
):
    api_client.force_authenticate(user=user_owner)
    comm_slug = scheduled_event.community.slug

    # Update status to LIVE
    status_url = f"/api/v1/communities/{comm_slug}/events/{scheduled_event.id}/status/"
    res_live = api_client.post(
        status_url, data={"status": EventStatus.LIVE}, format="json"
    )
    assert res_live.status_code == status.HTTP_200_OK
    assert res_live.data["data"]["status"] == EventStatus.LIVE

    # Attach replay VideoAsset
    replay_url = f"/api/v1/communities/{comm_slug}/events/{scheduled_event.id}/replay/"
    res_replay = api_client.post(
        replay_url, data={"video_asset_id": str(video_asset.id)}, format="json"
    )
    assert res_replay.status_code == status.HTTP_200_OK
    assert res_replay.data["data"]["status"] == EventStatus.COMPLETED
    assert res_replay.data["data"]["replay_video_asset"]["id"] == str(video_asset.id)


@pytest.mark.django_db
def test_event_replay_attach_uploadthing_url_and_file(
    api_client, user_owner, scheduled_event
):
    api_client.force_authenticate(user=user_owner)
    comm_slug = scheduled_event.community.slug
    replay_url = f"/api/v1/communities/{comm_slug}/events/{scheduled_event.id}/replay/"

    # 1. Attach via direct UploadThing URL
    ut_url = "https://utfs.io/f/test-recording-123.webm"
    res_url = api_client.post(replay_url, data={"video_url": ut_url}, format="json")
    assert res_url.status_code == status.HTTP_200_OK
    assert res_url.data["data"]["status"] == EventStatus.COMPLETED
    assert res_url.data["data"]["replay_video_asset"]["hls_url"] == ut_url
    assert res_url.data["data"]["replay_video_asset"]["provider"] == "uploadthing"

    # 2. Attach via multipart video file upload (mocking uploadthing service)
    mock_upload_res = {
        "asset_id": "test-asset-uuid",
        "file_url": "https://utfs.io/f/uploaded-live-recording.webm",
        "file_key": "uploaded-live-recording.webm",
        "file_size": 1024,
        "mime_type": "video/webm",
    }
    dummy_file = SimpleUploadedFile("recorded-live.webm", b"mock-video-binary", content_type="video/webm")
    with patch(
        "apps.media.services.uploadthing_service.UploadThingService.upload_file_direct",
        return_value=mock_upload_res,
    ):
        res_file = api_client.post(
            replay_url, data={"video": dummy_file}, format="multipart"
        )
    assert res_file.status_code == status.HTTP_200_OK
    assert res_file.data["data"]["replay_video_asset"]["hls_url"] == "https://utfs.io/f/uploaded-live-recording.webm"
    assert res_file.data["data"]["replay_video_asset"]["provider"] == "uploadthing"


@pytest.mark.django_db
def test_event_list_filtering_has_replay(
    api_client, user_owner, scheduled_event, video_asset
):
    api_client.force_authenticate(user=user_owner)
    comm_slug = scheduled_event.community.slug
    list_url = f"/api/v1/communities/{comm_slug}/events/"

    # Without replay yet
    res_no = api_client.get(f"{list_url}?all=true&has_replay=true")
    assert res_no.status_code == status.HTTP_200_OK
    assert len(res_no.data["data"]) == 0

    # Attach replay
    scheduled_event.replay_video_asset = video_asset
    scheduled_event.save(update_fields=["replay_video_asset"])

    # Query has_replay=true
    res_yes = api_client.get(f"{list_url}?all=true&has_replay=true")
    assert res_yes.status_code == status.HTTP_200_OK
    assert len(res_yes.data["data"]) == 1
    assert res_yes.data["data"][0]["id"] == str(scheduled_event.id)


@pytest.mark.django_db
def test_calendar_export_ics(api_client, scheduled_event):
    comm_slug = scheduled_event.community.slug
    url = f"/api/v1/communities/{comm_slug}/events/{scheduled_event.id}/calendar.ics"
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert "text/calendar" in response["Content-Type"]
    content = response.content.decode("utf-8")
    assert "BEGIN:VCALENDAR" in content
    assert "END:VCALENDAR" in content
    assert scheduled_event.title in content


@pytest.mark.django_db
def test_user_attending_events_my(
    api_client, user_member, member_membership, scheduled_event
):
    # Register member
    EventAttendee.objects.create(
        event=scheduled_event,
        user=user_member,
        status=AttendeeStatus.ATTENDING,
    )

    api_client.force_authenticate(user=user_member)
    url = "/api/v1/events/my/?all=true"
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.data["data"]
    assert len(data) == 1
    assert data[0]["id"] == str(scheduled_event.id)
    assert data[0]["user_rsvp_status"] == AttendeeStatus.ATTENDING


@pytest.mark.django_db
def test_livekit_webhook_room_lifecycle(api_client, scheduled_event):
    webhook_url = "/api/v1/events/webhooks/livekit/"

    # 1. room_started
    payload_start = {
        "event": "room_started",
        "room": {
            "name": scheduled_event.live_room_name,
            "sid": "RM_123456",
        },
    }
    res_start = api_client.post(webhook_url, data=payload_start, format="json")
    assert res_start.status_code == status.HTTP_200_OK
    scheduled_event.refresh_from_db()
    assert scheduled_event.status == EventStatus.LIVE

    # 2. room_finished
    payload_finish = {
        "event": "room_finished",
        "room": {
            "name": scheduled_event.live_room_name,
            "sid": "RM_123456",
        },
    }
    res_finish = api_client.post(webhook_url, data=payload_finish, format="json")
    assert res_finish.status_code == status.HTTP_200_OK
    scheduled_event.refresh_from_db()
    assert scheduled_event.status == EventStatus.COMPLETED


@pytest.mark.django_db
def test_livekit_webhook_participant_joined(
    api_client, user_member, member_membership, scheduled_event
):
    attendee = EventAttendee.objects.create(
        event=scheduled_event,
        user=user_member,
        status=AttendeeStatus.ATTENDING,
    )
    assert attendee.checked_in_at is None

    webhook_url = "/api/v1/events/webhooks/livekit/"
    payload = {
        "event": "participant_joined",
        "room": {
            "name": scheduled_event.live_room_name,
        },
        "participant": {
            "identity": f"user_{user_member.id}",
            "sid": "PA_987654",
        },
    }
    res = api_client.post(webhook_url, data=payload, format="json")
    assert res.status_code == status.HTTP_200_OK
    attendee.refresh_from_db()
    assert attendee.checked_in_at is not None


@pytest.mark.django_db
def test_event_tasks(user_owner, user_member, scheduled_event):
    from django.core import mail

    from apps.events.tasks import (
        send_event_confirmation_email_task,
        send_event_reminders_task,
    )

    mail.outbox.clear()

    # 1. Confirmation task
    sent = send_event_confirmation_email_task(
        user_id=str(user_owner.id), event_id=str(scheduled_event.id)
    )
    assert sent is True
    assert len(mail.outbox) == 1
    assert scheduled_event.title in mail.outbox[0].subject

    # 2. Reminder task with event in 30 minutes
    now = timezone.now()
    scheduled_event.start_time = now + timedelta(minutes=30)
    scheduled_event.end_time = now + timedelta(minutes=90)
    scheduled_event.status = EventStatus.SCHEDULED
    scheduled_event.save()

    attendee = EventAttendee.objects.create(
        event=scheduled_event,
        user=user_member,
        status=AttendeeStatus.ATTENDING,
        reminder_sent=False,
    )

    mail.outbox.clear()
    count = send_event_reminders_task()
    assert count >= 1
    attendee.refresh_from_db()
    assert attendee.reminder_sent is True
    assert len(mail.outbox) >= 1
    assert "Rappel" in mail.outbox[0].subject
