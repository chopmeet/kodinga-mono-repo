import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
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
from apps.profiles.models.profile import DeveloperProfile
from apps.profiles.models.skill import DeveloperSkill
from apps.profiles.models.technology import Technology


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def users(db):
    author = User.objects.create_user(
        email="author_help@kodinga.com",
        username="author_help",
        password="SecurePassword123!",
    )
    mentor = User.objects.create_user(
        email="mentor_help@kodinga.com",
        username="mentor_help",
        password="SecurePassword123!",
    )
    return author, mentor


@pytest.fixture
def community_and_post(db, users):
    author, mentor = users
    comm = Community.objects.create(
        name="Backend Guild",
        slug="backend-guild",
        owner=mentor,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=mentor,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
        reputation_score=500,
    )
    CommunityMember.objects.create(
        community=comm,
        user=author,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
        reputation_score=20,
    )
    post = Post.objects.create(
        community=comm,
        author=author,
        title="Comment configurer Celery avec Redis et Django ?",
        content="Je n'arrive pas à exécuter mes tâches asynchrones en arrière-plan avec Django et Redis broker.",
        post_type=PostType.QUESTION,
    )
    return comm, post, author, mentor


@pytest.mark.django_db
def test_post_help_assistance_api(api_client, community_and_post):
    _, post, author, mentor = community_and_post

    # Setup mentor profile with matching technology skill
    prof, _ = DeveloperProfile.objects.get_or_create(user=mentor)
    tech_celery, _ = Technology.objects.get_or_create(name="Celery", defaults={"slug": "celery"})
    DeveloperSkill.objects.get_or_create(profile=prof, technology=tech_celery)

    api_client.force_authenticate(user=author)
    url = f"/api/v1/posts/{post.id}/help-assistance/"

    res = api_client.get(url)
    assert res.status_code == status.HTTP_200_OK
    assert res.data["post_id"] == str(post.id)
    assert "ai_comment_draft" in res.data
    assert "matching_skills" in res.data
    assert len(res.data["suggested_mentors"]) >= 1

    # Verify that mentor's displayed skills reflect their profile skills
    mentor_entry = next(m for m in res.data["suggested_mentors"] if m["user_id"] == str(mentor.id))
    assert any("Celery" in s for s in mentor_entry["matching_skills"])


@pytest.mark.django_db
def test_ping_mentors_api(api_client, community_and_post):
    _, post, author, mentor = community_and_post

    api_client.force_authenticate(user=author)
    url = f"/api/v1/posts/{post.id}/help-assistance/ping-mentors/"

    payload = {
        "mentor_ids": [str(mentor.id)],
        "custom_message": "Un coup de main serait grandement apprécié !",
    }
    res = api_client.post(url, payload, format="json")
    assert res.status_code == status.HTTP_200_OK
    assert "notifiés" in res.data["message"]
    assert res.data["notified_count"] == 1


@pytest.mark.django_db
def test_ping_mentors_unauthorized_user_forbidden(api_client, community_and_post):
    _, post, _, mentor = community_and_post

    stranger = User.objects.create_user(
        email="stranger_ping@kodinga.com",
        username="stranger_ping",
        password="SecurePassword123!",
    )

    # Stranger (neither author nor moderator/admin of this community) attempts to ping
    api_client.force_authenticate(user=stranger)
    url = f"/api/v1/posts/{post.id}/help-assistance/ping-mentors/"

    payload = {
        "mentor_ids": [str(mentor.id)],
        "custom_message": "Spam message",
    }
    res = api_client.post(url, payload, format="json")
    assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_ping_mentors_ignores_users_outside_community(api_client, community_and_post):
    _, post, author, _ = community_and_post

    external_user = User.objects.create_user(
        email="external_dev@other.com",
        username="external_dev",
        password="SecurePassword123!",
    )

    api_client.force_authenticate(user=author)
    url = f"/api/v1/posts/{post.id}/help-assistance/ping-mentors/"

    payload = {
        "mentor_ids": [str(external_user.id)],
        "custom_message": "Are you there?",
    }
    res = api_client.post(url, payload, format="json")
    assert res.status_code == status.HTTP_200_OK
    # External user was NOT notified because they are not an active member of this community
    assert res.data["notified_count"] == 0
