from decimal import Decimal

import pytest
from apps.accounts.models.user import User
from apps.affiliates.models.link import AffiliateLink
from apps.affiliates.models.payout import PayoutStatus
from apps.affiliates.services.affiliate_service import AffiliateService
from apps.communities.models.community import Community
from apps.gamification.models.reputation import UserReputation
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.messaging.models.message import Message
from apps.notifications.models.notification import Notification
from apps.opportunities.models.application import (
    ApplicationStatus,
)
from apps.opportunities.models.opportunity import (
    ExperienceLevel,
    OpportunityType,
    WorkplaceType,
)
from apps.profiles.models.technology import Technology, TechnologyCategory
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_alice(db):
    return User.objects.create_user(
        email="alice@kodinga.com",
        username="alice_dev",
        password="SecurePassword123!",
        first_name="Alice",
        last_name="Johnson",
    )


@pytest.fixture
def user_bob(db):
    return User.objects.create_user(
        email="bob@kodinga.com",
        username="bob_coder",
        password="SecurePassword123!",
        first_name="Bob",
        last_name="Smith",
    )


@pytest.fixture
def user_charlie(db):
    return User.objects.create_user(
        email="charlie@kodinga.com",
        username="charlie_hacker",
        password="SecurePassword123!",
        first_name="Charlie",
        last_name="Brown",
    )


@pytest.fixture
def community(user_alice):
    return Community.objects.create(
        owner=user_alice,
        name="Fullstack Africa",
        slug="fullstack-africa",
        description="African Fullstack Developers",
    )


@pytest.fixture
def tech_django(db):
    return Technology.objects.create(
        name="Django",
        slug="django",
        category=TechnologyCategory.BACKEND,
    )


@pytest.fixture
def tech_react(db):
    return Technology.objects.create(
        name="React",
        slug="react",
        category=TechnologyCategory.FRONTEND,
    )


# ==============================================================================
# 1. MESSAGING TESTS
# ==============================================================================


@pytest.mark.django_db
def test_messaging_direct_and_group_conversations(
    api_client, user_alice, user_bob, user_charlie, community
):
    # Authenticate as Alice
    api_client.force_authenticate(user=user_alice)

    # 1. Start direct conversation with Bob
    start_resp = api_client.post(
        "/api/v1/conversations/",
        {"recipient_id": str(user_bob.id), "conversation_type": "direct"},
        format="json",
    )
    assert start_resp.status_code == status.HTTP_201_CREATED
    conv_id = start_resp.data["id"]

    # Starting again should return existing conversation (200 OK)
    start_again_resp = api_client.post(
        "/api/v1/conversations/",
        {"recipient_id": str(user_bob.id), "conversation_type": "direct"},
        format="json",
    )
    assert start_again_resp.status_code == status.HTTP_200_OK
    assert start_again_resp.data["id"] == conv_id

    # 2. Alice sends a message to Bob
    send_resp = api_client.post(
        f"/api/v1/conversations/{conv_id}/messages/",
        {"content": "Salut Bob, bienvenue sur Kodinga !"},
        format="json",
    )
    assert send_resp.status_code == status.HTTP_201_CREATED
    msg_id = send_resp.data["id"]
    assert send_resp.data["content"] == "Salut Bob, bienvenue sur Kodinga !"

    # Verify notification dispatched to Bob
    assert Notification.objects.filter(recipient=user_bob, actor=user_alice).exists()

    # 3. Bob checks messages and marks as read
    api_client.force_authenticate(user=user_bob)
    list_msgs_resp = api_client.get(f"/api/v1/conversations/{conv_id}/messages/")
    assert list_msgs_resp.status_code == status.HTTP_200_OK
    assert len(list_msgs_resp.data) == 1

    read_resp = api_client.post(f"/api/v1/conversations/{conv_id}/read/")
    assert read_resp.status_code == status.HTTP_200_OK

    # 4. Bob replies
    bob_reply_resp = api_client.post(
        f"/api/v1/conversations/{conv_id}/messages/",
        {"content": "Merci Alice, ravi d'être ici !"},
        format="json",
    )
    assert bob_reply_resp.status_code == status.HTTP_201_CREATED
    bob_msg_id = bob_reply_resp.data["id"]

    # 5. Bob edits his message
    edit_resp = api_client.patch(
        f"/api/v1/messages/{bob_msg_id}/",
        {"content": "Merci Alice, super plateforme !"},
        format="json",
    )
    assert edit_resp.status_code == status.HTTP_200_OK
    assert edit_resp.data["is_edited"] is True
    assert edit_resp.data["content"] == "Merci Alice, super plateforme !"

    # 6. Alice deletes her message
    api_client.force_authenticate(user=user_alice)
    del_resp = api_client.delete(f"/api/v1/messages/{msg_id}/")
    assert del_resp.status_code == status.HTTP_204_NO_CONTENT
    assert Message.objects.get(id=msg_id).is_deleted is True

    # 7. Create Group Conversation
    group_resp = api_client.post(
        "/api/v1/conversations/",
        {
            "conversation_type": "group",
            "title": "Core Maintainers",
            "participant_ids": [str(user_bob.id), str(user_charlie.id)],
            "community_id": str(community.id),
        },
        format="json",
    )
    assert group_resp.status_code == status.HTTP_201_CREATED
    assert group_resp.data["conversation_type"] == "group"
    assert group_resp.data["title"] == "Core Maintainers"

    # 8. Stranger (Charlie) forbidden on direct conversation between Alice & Bob
    api_client.force_authenticate(user=user_charlie)
    forbidden_resp = api_client.get(f"/api/v1/conversations/{conv_id}/messages/")
    assert forbidden_resp.status_code == status.HTTP_403_FORBIDDEN


# ==============================================================================
# 2. AFFILIATES & CREATOR PROGRAM TESTS
# ==============================================================================


@pytest.mark.django_db
def test_affiliates_link_clicks_and_payouts(api_client, user_alice):
    api_client.force_authenticate(user=user_alice)

    # 1. Create custom affiliate link
    create_link_resp = api_client.post(
        "/api/v1/affiliates/links/",
        {
            "custom_slug": "alice-python",
            "target_url": "https://kodinga.com/courses/python",
        },
        format="json",
    )
    assert create_link_resp.status_code == status.HTTP_201_CREATED
    link_data = create_link_resp.data
    assert link_data["custom_slug"] == "alice-python"
    link_code = link_data["code"]

    # 2. Public click tracking
    api_client.logout()
    track_resp = api_client.post(
        "/api/v1/affiliates/track-click/",
        {"code": "alice-python", "referrer": "https://twitter.com"},
        format="json",
    )
    assert track_resp.status_code == status.HTTP_200_OK
    assert track_resp.data["status"] == "tracked"

    link = AffiliateLink.objects.get(code=link_code)
    assert link.clicks_count == 1

    # 3. Simulate conversion & earnings
    AffiliateService.record_conversion(link, commission_amount=Decimal("15000.00"))

    # 4. Check affiliate stats
    api_client.force_authenticate(user=user_alice)
    stats_resp = api_client.get("/api/v1/affiliates/stats/")
    assert stats_resp.status_code == status.HTTP_200_OK
    assert stats_resp.data["total_clicks"] == 1
    assert stats_resp.data["total_conversions"] == 1
    assert Decimal(stats_resp.data["total_earnings"]) == Decimal("15000.00")
    assert Decimal(stats_resp.data["available_balance"]) == Decimal("15000.00")

    # 5. Payout request - excessive amount fails
    bad_payout = api_client.post(
        "/api/v1/affiliates/payouts/",
        {
            "amount": "25000.00",
            "payout_method": "wave",
            "payout_details": {"phone": "+221770000000"},
        },
        format="json",
    )
    assert bad_payout.status_code == status.HTTP_400_BAD_REQUEST

    # 6. Valid payout request
    good_payout = api_client.post(
        "/api/v1/affiliates/payouts/",
        {
            "amount": "10000.00",
            "payout_method": "wave",
            "payout_details": {"phone": "+221770000000"},
        },
        format="json",
    )
    assert good_payout.status_code == status.HTTP_201_CREATED
    assert good_payout.data["status"] == PayoutStatus.PENDING
    assert Decimal(good_payout.data["amount"]) == Decimal("10000.00")


# ==============================================================================
# 3. PROJECTS SHOWCASE TESTS
# ==============================================================================


@pytest.mark.django_db
def test_projects_showcase_and_upvotes(
    api_client, user_alice, user_bob, community, tech_django, tech_react
):
    CommunityMember.objects.create(
        community=community,
        user=user_bob,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    api_client.force_authenticate(user=user_alice)

    # 1. Create Project
    create_proj_resp = api_client.post(
        "/api/v1/projects/",
        {
            "title": "Kodinga LMS Platform",
            "tagline": "Next-gen developer learning and communities for Africa",
            "description": "Fullstack platform built with Django REST and React.",
            "demo_url": "https://kodinga.com",
            "repository_url": "https://github.com/chopmeet/kodinga-mono-repo",
            "community_id": str(community.id),
            "technology_ids": [str(tech_django.id), str(tech_react.id)],
        },
        format="json",
    )
    assert create_proj_resp.status_code == status.HTTP_201_CREATED
    assert create_proj_resp.data["success"] is True
    proj_slug = create_proj_resp.data["data"]["slug"]
    assert create_proj_resp.data["data"]["title"] == "Kodinga LMS Platform"

    # Verify Gamification points awarded to Alice
    reputation = UserReputation.objects.filter(user=user_alice).first()
    assert reputation is not None and reputation.total_points >= 25

    # 2. Explore projects list with technology filter
    api_client.logout()
    list_resp = api_client.get(f"/api/v1/projects/?tech={tech_django.slug}")
    assert list_resp.status_code == status.HTTP_200_OK
    assert list_resp.data["success"] is True
    assert len(list_resp.data["data"]) >= 1

    # 3. Bob upvotes Alice's project
    api_client.force_authenticate(user=user_bob)
    upvote_resp = api_client.post(f"/api/v1/projects/{proj_slug}/upvote/")
    assert upvote_resp.status_code == status.HTTP_200_OK
    assert upvote_resp.data["success"] is True
    assert upvote_resp.data["data"]["is_upvoted"] is True
    assert upvote_resp.data["data"]["upvotes_count"] == 1

    # Verify notification dispatched to Alice
    assert Notification.objects.filter(recipient=user_alice, actor=user_bob).exists()

    # 4. Bob comments on the project
    comment_resp = api_client.post(
        f"/api/v1/projects/{proj_slug}/comments/",
        {"content": "Super projet, félicitations pour la démo !"},
        format="json",
    )
    assert comment_resp.status_code == status.HTTP_201_CREATED
    assert comment_resp.data["success"] is True
    assert comment_resp.data["data"]["content"] == "Super projet, félicitations pour la démo !"

    # 5. Alice can update her project
    api_client.force_authenticate(user=user_alice)
    patch_resp = api_client.patch(
        f"/api/v1/projects/{proj_slug}/",
        {"tagline": "Updated tagline for Kodinga LMS"},
        format="json",
    )
    assert patch_resp.status_code == status.HTTP_200_OK
    assert patch_resp.data["success"] is True
    assert patch_resp.data["data"]["tagline"] == "Updated tagline for Kodinga LMS"


# ==============================================================================
# 4. OPPORTUNITIES & JOB BOARD TESTS
# ==============================================================================


@pytest.mark.django_db
def test_opportunities_jobboard_and_applications(
    api_client, user_alice, user_bob, community, tech_django
):
    # Alice (poster) creates a job opportunity
    api_client.force_authenticate(user=user_alice)

    create_opp_resp = api_client.post(
        "/api/v1/opportunities/",
        {
            "title": "Senior Backend Engineer",
            "company_name": "Kodinga Tech",
            "opportunity_type": OpportunityType.FULL_TIME,
            "workplace_type": WorkplaceType.REMOTE,
            "location": "Dakar, Sénégal / Remote",
            "salary_min": "1500000.00",
            "salary_max": "2500000.00",
            "currency": "XOF",
            "experience_level": ExperienceLevel.SENIOR,
            "description": "Nous recrutons un ingénieur backend Django/Python senior.",
            "requirements": "5+ ans d'expérience, DRF, Celery, PostgreSQL.",
            "community_id": str(community.id),
            "technology_ids": [str(tech_django.id)],
        },
        format="json",
    )
    assert create_opp_resp.status_code == status.HTTP_201_CREATED
    assert create_opp_resp.data["success"] is True
    opp_slug = create_opp_resp.data["data"]["slug"]

    # Explore opportunities with workplace filter
    api_client.logout()
    list_resp = api_client.get("/api/v1/opportunities/?workplace=remote")
    assert list_resp.status_code == status.HTTP_200_OK
    assert list_resp.data["success"] is True
    assert len(list_resp.data["data"]) >= 1

    # Bob joins the community and applies to the opportunity
    CommunityMember.objects.create(
        community=community,
        user=user_bob,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    api_client.force_authenticate(user=user_bob)
    apply_resp = api_client.post(
        f"/api/v1/opportunities/{opp_slug}/apply/",
        {
            "resume_url": "https://kodinga.com/resumes/bob.pdf",
            "cover_letter": "Bonjour, je suis très intéressé par ce poste senior.",
            "portfolio_url": "https://github.com/bob",
        },
        format="json",
    )
    assert apply_resp.status_code == status.HTTP_201_CREATED
    assert apply_resp.data["success"] is True
    application_id = apply_resp.data["data"]["id"]
    assert apply_resp.data["data"]["status"] == ApplicationStatus.PENDING

    # Applying again should be rejected with 400
    dup_apply = api_client.post(
        f"/api/v1/opportunities/{opp_slug}/apply/",
        {"resume_url": "https://kodinga.com/resumes/bob.pdf"},
        format="json",
    )
    assert dup_apply.status_code == status.HTTP_400_BAD_REQUEST

    # Check notification sent to Alice
    assert Notification.objects.filter(recipient=user_alice, actor=user_bob).exists()

    # Alice reviews applications and updates status
    api_client.force_authenticate(user=user_alice)
    apps_list = api_client.get(f"/api/v1/opportunities/{opp_slug}/applications/")
    assert apps_list.status_code == status.HTTP_200_OK
    assert apps_list.data["success"] is True
    assert len(apps_list.data["data"]) == 1

    status_update_resp = api_client.patch(
        f"/api/v1/opportunities/applications/{application_id}/status/",
        {"status": ApplicationStatus.SHORTLISTED},
        format="json",
    )
    assert status_update_resp.status_code == status.HTTP_200_OK
    assert status_update_resp.data["success"] is True
    assert status_update_resp.data["data"]["status"] == ApplicationStatus.SHORTLISTED

    # Check status update notification sent to Bob
    assert Notification.objects.filter(recipient=user_bob, actor=user_alice).exists()
