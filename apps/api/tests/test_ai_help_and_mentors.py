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
    _, post, author, _ = community_and_post

    api_client.force_authenticate(user=author)
    url = f"/api/v1/posts/{post.id}/help-assistance/"

    res = api_client.get(url)
    assert res.status_code == status.HTTP_200_OK
    assert res.data["post_id"] == str(post.id)
    assert "ai_comment_draft" in res.data
    assert "matching_skills" in res.data
    assert len(res.data["suggested_mentors"]) >= 1


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
