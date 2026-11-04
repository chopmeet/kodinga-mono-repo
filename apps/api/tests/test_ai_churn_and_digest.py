import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.ai.models.churn import MemberChurnRisk
from apps.ai.tasks import (
    evaluate_community_churn_task,
    generate_community_weekly_digest_task,
    send_smart_nudge_task,
)
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.posts.models.post import Post, PostType


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def setup_community(db):
    owner = User.objects.create_user(
        email="owner_pulse@kodinga.com",
        username="owner_pulse",
        password="SecurePassword123!",
    )
    inactive_member = User.objects.create_user(
        email="inactive@kodinga.com",
        username="inactive_dev",
        password="SecurePassword123!",
    )
    comm = Community.objects.create(
        name="Pulse Community",
        slug="pulse-comm",
        owner=owner,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )
    m_owner = CommunityMember.objects.create(
        community=comm,
        user=owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    m_inactive = CommunityMember.objects.create(
        community=comm,
        user=inactive_member,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )

    Post.objects.create(
        community=comm,
        author=owner,
        title="Bienvenue dans la communauté Pulse",
        content="Voici le post inaugural de la communauté.",
        post_type=PostType.DISCUSSION,
    )

    return comm, owner, inactive_member, m_owner, m_inactive


@pytest.mark.django_db
def test_churn_dashboard_and_nudge_api(api_client, setup_community):
    comm, owner, _, _, m_inactive = setup_community

    api_client.force_authenticate(user=owner)
    url_dashboard = f"/api/v1/communities/{comm.slug}/ai/churn-dashboard/?refresh=true"

    res = api_client.get(url_dashboard)
    assert res.status_code == status.HTTP_200_OK
    assert res.data["total_at_risk"] >= 1

    churn_risk = MemberChurnRisk.objects.filter(member=m_inactive).first()
    assert churn_risk is not None

    url_nudge = f"/api/v1/ai/churn-risks/{churn_risk.id}/send-nudge/"
    res_nudge = api_client.post(
        url_nudge,
        {"custom_message": "Salut ! On a hâte de voir tes prochains progrès."},
        format="json",
    )
    assert res_nudge.status_code == status.HTTP_200_OK
    assert res_nudge.data["churn_risk"]["status"] == "nudge_sent"
    churn_risk.refresh_from_db()
    assert churn_risk.status == "nudge_sent"


@pytest.mark.django_db
def test_weekly_digest_api(api_client, setup_community):
    comm, owner, _, _, _ = setup_community

    api_client.force_authenticate(user=owner)
    url_current = f"/api/v1/communities/{comm.slug}/ai/weekly-digest/"

    res = api_client.get(url_current)
    assert res.status_code == status.HTTP_200_OK
    assert "week_identifier" in res.data
    assert "summary_markdown" in res.data

    url_trigger = f"/api/v1/communities/{comm.slug}/ai/weekly-digest/trigger/"
    res_sync = api_client.post(url_trigger, {"async": False}, format="json")
    assert res_sync.status_code == status.HTTP_200_OK

    res_async = api_client.post(url_trigger, {"async": True}, format="json")
    assert res_async.status_code == status.HTTP_202_ACCEPTED


@pytest.mark.django_db
def test_churn_and_digest_celery_tasks(setup_community):
    comm, _, _, _, m_inactive = setup_community

    # Run tasks directly
    evaluate_community_churn_task(str(comm.id))
    risk = MemberChurnRisk.objects.filter(member=m_inactive).first()
    assert risk is not None

    send_smart_nudge_task(str(risk.id), custom_message="Check-in amical.")
    risk.refresh_from_db()
    assert risk.status == "nudge_sent"

    generate_community_weekly_digest_task(str(comm.id), force_refresh=True)


@pytest.mark.django_db
def test_weekly_digest_private_community_access_control(api_client, setup_community):
    _, owner, _, _, _ = setup_community

    stranger = User.objects.create_user(
        email="stranger_digest@kodinga.com",
        username="stranger_digest",
        password="SecurePassword123!",
    )
    private_comm = Community.objects.create(
        name="Confidential Elite",
        slug="confidential-elite",
        owner=owner,
        privacy_type=CommunityPrivacy.PRIVATE,
        pricing_type=CommunityPricing.FREE,
    )
    CommunityMember.objects.create(
        community=private_comm,
        user=owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )

    # 1. Stranger user cannot read weekly digest of a private community
    api_client.force_authenticate(user=stranger)
    url_current = f"/api/v1/communities/{private_comm.slug}/ai/weekly-digest/"
    res = api_client.get(url_current)
    assert res.status_code == status.HTTP_403_FORBIDDEN

    # 2. Stranger cannot trigger weekly digest of a private community
    url_trigger = f"/api/v1/communities/{private_comm.slug}/ai/weekly-digest/trigger/"
    res_trig = api_client.post(url_trigger, {"async": False}, format="json")
    assert res_trig.status_code == status.HTTP_403_FORBIDDEN

    # 3. Community owner can access and generate the digest
    api_client.force_authenticate(user=owner)
    res_owner = api_client.get(url_current)
    assert res_owner.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_weekly_digest_non_member_cannot_trigger_ai_on_public_community(api_client, setup_community):
    _, owner, _, _, _ = setup_community

    stranger = User.objects.create_user(
        email="stranger_pub@kodinga.com",
        username="stranger_pub",
        password="SecurePassword123!",
    )
    new_public_comm = Community.objects.create(
        name="Brand New Public Space",
        slug="brand-new-public-space",
        owner=owner,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )
    CommunityMember.objects.create(
        community=new_public_comm,
        user=owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )

    # Stranger calls GET before any digest has been created
    # Must NOT trigger AI generation on-the-fly; should return 404
    api_client.force_authenticate(user=stranger)
    url_current = f"/api/v1/communities/{new_public_comm.slug}/ai/weekly-digest/"
    res_stranger = api_client.get(url_current)
    assert res_stranger.status_code == status.HTTP_404_NOT_FOUND

    # Owner calls GET -> triggers generation -> returns 200
    api_client.force_authenticate(user=owner)
    res_owner = api_client.get(url_current)
    assert res_owner.status_code == status.HTTP_200_OK
