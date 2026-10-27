from datetime import timedelta
import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.communities.models.community import Community, CommunityPrivacy
from apps.events.models.event import Event, EventFormat, EventStatus, EventType
from apps.media.models.video_asset import VideoAsset, VideoStatus
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        username="live_ai_owner",
        email="owner_ai@example.com",
        password="Password123!",
        first_name="Alice",
        last_name="Owner",
    )


@pytest.fixture
def member(db):
    return User.objects.create_user(
        username="live_ai_member",
        email="member_ai@example.com",
        password="Password123!",
        first_name="Bob",
        last_name="Member",
    )


@pytest.fixture
def outsider(db):
    return User.objects.create_user(
        username="live_ai_outsider",
        email="outsider_ai@example.com",
        password="Password123!",
        first_name="Eve",
        last_name="Outsider",
    )


@pytest.fixture
def community(db, owner):
    return Community.objects.create(
        name="IA & Live Dev Community",
        slug="ia-live-dev",
        owner=owner,
        privacy_type=CommunityPrivacy.PUBLIC,
    )


@pytest.fixture
def replay_asset(db, owner):
    return VideoAsset.objects.create(
        user=owner,
        title="Replay - Architecture & Live Streaming",
        playback_id="mock_playback_123",
        asset_id="mock_asset_123",
        provider="uploadthing",
        status=VideoStatus.READY,
        metadata={"file_url": "https://utfs.io/f/mock-replay.mp4"},
    )


@pytest.fixture
def completed_event(db, community, owner, replay_asset):
    now = timezone.now()
    return Event.objects.create(
        community=community,
        host=owner,
        title="Atelier Architecture & LiveKit Replay",
        slug="atelier-livekit-replay",
        description="Démonstration technique sur l'intégration du streaming interactif.",
        event_type=EventType.WORKSHOP,
        format=EventFormat.LIVEKIT,
        status=EventStatus.COMPLETED,
        start_time=now - timedelta(hours=2),
        end_time=now - timedelta(hours=1),
        is_public=True,
        is_recorded=True,
        replay_video_asset=replay_asset,
    )


@pytest.mark.django_db
def test_transcribe_and_retrieve_event(owner, member, community, completed_event):
    client = APIClient()
    client.force_authenticate(user=owner)

    # 1. Trigger transcription
    url_transcribe = f"/api/v1/communities/{community.slug}/events/{completed_event.id}/transcribe/"
    res = client.post(url_transcribe, {"force": True, "language": "fr"}, format="json")
    assert res.status_code in [status.HTTP_200_OK, status.HTTP_202_ACCEPTED]
    data = res.json()["data"]
    assert data["has_transcription"] is True
    assert len(data["transcription"]) > 50
    assert len(data["segments"]) >= 3
    assert "overview" in data["summary"]
    assert len(data["summary"]["key_points"]) >= 3

    # 2. Retrieve transcription as member
    client.force_authenticate(user=member)
    url_get = f"/api/v1/communities/{community.slug}/events/{completed_event.id}/transcription/"
    res_get = client.get(url_get)
    assert res_get.status_code == status.HTTP_200_OK
    get_data = res_get.json()["data"]
    assert get_data["has_transcription"] is True
    assert get_data["transcription"] == data["transcription"]


@pytest.mark.django_db
def test_generate_event_summary(owner, member, community, completed_event):
    client = APIClient()
    client.force_authenticate(user=member)

    url_summary = f"/api/v1/communities/{community.slug}/events/{completed_event.id}/summary/"
    res = client.post(url_summary, {}, format="json")
    assert res.status_code == status.HTTP_200_OK
    summary = res.json()["data"]["summary"]
    assert "overview" in summary
    assert isinstance(summary["key_points"], list)
    assert isinstance(summary["action_items"], list)
    assert isinstance(summary["decisions"], list)


@pytest.mark.django_db
def test_chat_with_transcript(member, community, completed_event):
    client = APIClient()
    client.force_authenticate(user=member)

    url_chat = f"/api/v1/communities/{community.slug}/events/{completed_event.id}/chat-transcript/"
    payload = {
        "message": "Quelles étaient les prochaines étapes recommandées ?",
        "history": [],
    }
    res = client.post(url_chat, payload, format="json")
    assert res.status_code == status.HTTP_200_OK
    chat_data = res.json()["data"]
    assert "reply" in chat_data
    assert len(chat_data["reply"]) > 20
    assert "suggested_follow_ups" in chat_data
    assert len(chat_data["suggested_follow_ups"]) >= 1


@pytest.mark.django_db
def test_private_event_transcription_permissions(owner, member, outsider, community, completed_event):
    # Make event private
    completed_event.is_public = False
    completed_event.save(update_fields=["is_public"])

    CommunityMember.objects.create(
        community=community,
        user=member,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )

    client = APIClient()

    # Outsider is denied
    client.force_authenticate(user=outsider)
    url_get = f"/api/v1/communities/{community.slug}/events/{completed_event.id}/transcription/"
    res_outsider = client.get(url_get)
    assert res_outsider.status_code == status.HTTP_403_FORBIDDEN

    # Active member is allowed
    client.force_authenticate(user=member)
    res_member = client.get(url_get)
    assert res_member.status_code == status.HTTP_200_OK
