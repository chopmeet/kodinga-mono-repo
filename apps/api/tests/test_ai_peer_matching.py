from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.ai.models.peer_match import MatchStatus, PeerMatchRecommendation
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.hackathons.models.application import HackathonApplication
from apps.hackathons.models.hackathon import Hackathon
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def users(db):
    u1 = User.objects.create_user(
        email="alice_match@kodinga.com",
        username="alice_match",
        password="SecurePassword123!",
    )
    u2 = User.objects.create_user(
        email="bob_match@kodinga.com",
        username="bob_match",
        password="SecurePassword123!",
    )
    return u1, u2


@pytest.fixture
def community_with_members(db, users):
    u1, u2 = users
    comm = Community.objects.create(
        name="Dev Community",
        slug="dev-comm",
        owner=u1,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )
    m1 = CommunityMember.objects.create(
        community=comm,
        user=u1,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
        reputation_score=150,
    )
    m2 = CommunityMember.objects.create(
        community=comm,
        user=u2,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
        reputation_score=120,
    )
    return comm, m1, m2


@pytest.mark.django_db
def test_peer_matches_generation_and_api(api_client, users, community_with_members):
    u1, _ = users
    comm, _, m2 = community_with_members

    api_client.force_authenticate(user=u1)
    url = f"/api/v1/communities/{comm.slug}/ai/peer-matches/"

    # First call generates matches
    res = api_client.get(url)
    assert res.status_code == status.HTTP_200_OK
    assert len(res.data) >= 1

    match_data = res.data[0]
    assert match_data["user_id"] == str(m2.user.id)
    assert match_data["compatibility_score"] > 0


@pytest.mark.django_db
def test_peer_match_respond_api(api_client, users, community_with_members):
    u1, u2 = users
    comm, _, _ = community_with_members

    recommendation = PeerMatchRecommendation.objects.create(
        community=comm,
        source_user=u1,
        target_user=u2,
        compatibility_score=85.0,
        match_reasons=["Compétences complémentaires en backend et frontend"],
        status=MatchStatus.SUGGESTED,
    )

    api_client.force_authenticate(user=u1)
    url = f"/api/v1/ai/peer-matches/{recommendation.id}/respond/"

    res = api_client.post(url, {"action": "accept", "note": "Enchanté de collaborer !"}, format="json")
    assert res.status_code == status.HTTP_200_OK
    recommendation.refresh_from_db()
    assert recommendation.status == MatchStatus.ACCEPTED


@pytest.mark.django_db
def test_hackathon_teammate_suggestions_api(api_client, users, community_with_members):
    u1, _ = users
    comm, _, _ = community_with_members

    api_client.force_authenticate(user=u1)
    url = f"/api/v1/communities/{comm.slug}/ai/hackathon-suggestions/"

    res = api_client.post(url, {"desired_skills": ["react", "typescript"], "limit": 2}, format="json")
    assert res.status_code == status.HTTP_200_OK
    assert isinstance(res.data, list)


@pytest.mark.django_db
def test_hackathon_teammate_suggestions_api_with_hackathon_id(api_client, users, community_with_members):
    u1, _ = users
    comm, _, _ = community_with_members

    now = timezone.now()
    hackathon = Hackathon.objects.create(
        community=comm,
        organizer=u1,
        title="Web3 Innovation Hackathon",
        slug="web3-hackathon",
        description="Grand hackathon.",
        registration_start=now - timedelta(days=5),
        registration_end=now + timedelta(days=2),
        start_time=now + timedelta(days=3),
        submission_deadline=now + timedelta(days=5),
        judging_end=now + timedelta(days=7),
    )

    participant = User.objects.create_user(
        email="participant_hack@kodinga.com",
        username="participant_hack",
        password="SecurePassword123!",
    )
    CommunityMember.objects.create(
        community=comm,
        user=participant,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    HackathonApplication.objects.create(
        hackathon=hackathon,
        applicant=participant,
        status="accepted",
    )

    api_client.force_authenticate(user=u1)
    url = f"/api/v1/communities/{comm.slug}/ai/hackathon-suggestions/"

    payload = {
        "hackathon_id": str(hackathon.id),
        "desired_skills": ["solidity"],
        "limit": 5,
    }
    res = api_client.post(url, payload, format="json")
    assert res.status_code == status.HTTP_200_OK
    assert len(res.data) >= 1
    # Verify participant is in returned suggestions
    assert any(item["user_id"] == str(participant.id) for item in res.data)


@pytest.mark.django_db
def test_peer_matches_excludes_ignored_and_declined_peers(api_client, community_with_members):
    comm, m1, m2 = community_with_members
    u1 = m1.user
    u2 = m2.user

    # Create third member
    u3 = User.objects.create_user(
        email="charlie_match@kodinga.com",
        username="charlie_match",
        password="SecurePassword123!",
    )
    CommunityMember.objects.create(
        community=comm,
        user=u3,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
        reputation_score=100,
    )

    # u1 ignores u2
    PeerMatchRecommendation.objects.create(
        community=comm,
        source_user=u1,
        target_user=u2,
        compatibility_score=95.0,
        match_reasons=["Compétences en Python"],
        status=MatchStatus.DECLINED,
    )

    api_client.force_authenticate(user=u1)
    url = f"/api/v1/communities/{comm.slug}/ai/peer-matches/"

    res = api_client.get(url)
    assert res.status_code == status.HTTP_200_OK

    returned_user_ids = [item["user_id"] for item in res.data]
    # Ignored member u2 must be excluded!
    assert str(u2.id) not in returned_user_ids
    # Active member u3 should be suggested
    assert str(u3.id) in returned_user_ids
