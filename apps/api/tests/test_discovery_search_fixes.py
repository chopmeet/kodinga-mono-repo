import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.classroom.models.course import Course, CourseLevel
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


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def dev_awa(db):
    user = User.objects.create_user(
        email="awa.diop@kodinga.com",
        username="adiop",
        password="Password123!",
        first_name="Awa",
        last_name="Diop",
    )
    profile, _ = DeveloperProfile.objects.get_or_create(user=user)
    profile.headline = "Senior Backend Engineer"
    profile.bio = "Passionnée de Python et d'architecture cloud."
    profile.is_public = True
    profile.save()
    return user


@pytest.fixture
def public_free_community(db, dev_awa):
    comm = Community.objects.create(
        name="Public Free Community",
        slug="public-free-comm",
        owner=dev_awa,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=dev_awa,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.fixture
def private_paid_community(db, dev_awa):
    comm = Community.objects.create(
        name="VIP Paid Club",
        slug="vip-paid-club",
        owner=dev_awa,
        privacy_type=CommunityPrivacy.PRIVATE,
        pricing_type=CommunityPricing.PAID,
    )
    CommunityMember.objects.create(
        community=comm,
        user=dev_awa,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.fixture
def stranger_user(db):
    return User.objects.create_user(
        email="stranger@kodinga.com",
        username="stranger",
        password="Password123!",
        first_name="John",
        last_name="Doe",
    )


@pytest.mark.django_db
class TestDiscoverySearchSecurityAndNameLookups:
    """
    Tests validating the 3 frontend feedback corrections:
    1. Paid & private community posts are strictly protected from non-members.
    2. Private community courses are hidden from non-members.
    3. Developer search matches first_name, last_name, and full name.
    4. Paid communities are automatically enforced as private.
    """

    def test_developer_search_by_first_name_last_name_and_full_name(
        self, api_client, dev_awa
    ):
        # 1. Search by first name "Awa" (username is adiop)
        res_first = api_client.get("/api/v1/discovery/search/?q=Awa&type=developer")
        assert res_first.status_code == status.HTTP_200_OK
        devs_first = res_first.json()["data"]["developers"]
        assert len(devs_first) == 1
        assert devs_first[0]["username"] == "adiop"
        assert devs_first[0]["full_name"] == "Awa Diop"

        # 2. Search by last name "Diop"
        res_last = api_client.get("/api/v1/discovery/search/?q=Diop&type=developer")
        assert res_last.status_code == status.HTTP_200_OK
        devs_last = res_last.json()["data"]["developers"]
        assert len(devs_last) == 1
        assert devs_last[0]["username"] == "adiop"

        # 3. Search by composed full name "Awa Diop"
        res_full = api_client.get("/api/v1/discovery/search/?q=Awa Diop&type=developer")
        assert res_full.status_code == status.HTTP_200_OK
        devs_full = res_full.json()["data"]["developers"]
        assert len(devs_full) == 1
        assert devs_full[0]["username"] == "adiop"

    def test_private_community_courses_hidden_from_non_members(
        self, api_client, stranger_user, public_free_community, private_paid_community
    ):
        # Course in public free community
        Course.objects.create(
            community=public_free_community,
            title="Introduction to Public APIs",
            slug="intro-public-apis",
            description="Open course for all",
            level=CourseLevel.BEGINNER,
            is_published=True,
        )

        # Course in private paid community
        Course.objects.create(
            community=private_paid_community,
            title="Secret Architecture Mastery",
            slug="secret-architecture-mastery",
            description="Confidential VIP course",
            level=CourseLevel.ADVANCED,
            is_published=True,
        )

        # 1. Anonymous visitor searches for "Architecture"
        res_anon = api_client.get(
            "/api/v1/discovery/search/?q=Architecture&type=course"
        )
        assert res_anon.status_code == status.HTTP_200_OK
        assert len(res_anon.json()["data"]["courses"]) == 0

        # 2. Stranger authenticated user searches for "Architecture"
        api_client.force_authenticate(user=stranger_user)
        res_stranger = api_client.get(
            "/api/v1/discovery/search/?q=Architecture&type=course"
        )
        assert res_stranger.status_code == status.HTTP_200_OK
        assert len(res_stranger.json()["data"]["courses"]) == 0

        # 3. Public course IS findable by anyone
        res_public = api_client.get(
            "/api/v1/discovery/search/?q=Public APIs&type=course"
        )
        assert res_public.status_code == status.HTTP_200_OK
        assert len(res_public.json()["data"]["courses"]) == 1
        assert res_public.json()["data"]["courses"][0]["slug"] == "intro-public-apis"

        # 4. Member of the private community CAN find their own community's courses
        api_client.force_authenticate(user=private_paid_community.owner)
        res_member = api_client.get(
            "/api/v1/discovery/search/?q=Architecture&type=course"
        )
        assert res_member.status_code == status.HTTP_200_OK
        assert len(res_member.json()["data"]["courses"]) == 1
        assert (
            res_member.json()["data"]["courses"][0]["slug"]
            == "secret-architecture-mastery"
        )

    def test_paid_and_private_community_posts_hidden_from_non_members(
        self, api_client, stranger_user, public_free_community, private_paid_community
    ):
        # Post in public free community
        Post.objects.create(
            community=public_free_community,
            author=public_free_community.owner,
            title="Public Community Welcome Post",
            content="Free content for everybody",
            post_type=PostType.DISCUSSION,
        )

        # Post in paid private community
        Post.objects.create(
            community=private_paid_community,
            author=private_paid_community.owner,
            title="Exclusive VIP Investment Strategy",
            content="Confidential alpha financial content",
            post_type=PostType.DISCUSSION,
        )

        # 1. Anonymous visitor searches for "Investment Strategy"
        res_anon = api_client.get(
            "/api/v1/discovery/search/?q=Investment Strategy&type=post"
        )
        assert res_anon.status_code == status.HTTP_200_OK
        assert len(res_anon.json()["data"]["posts"]) == 0

        # 2. Non-member authenticated stranger searches for "Investment Strategy"
        api_client.force_authenticate(user=stranger_user)
        res_stranger = api_client.get(
            "/api/v1/discovery/search/?q=Investment Strategy&type=post"
        )
        assert res_stranger.status_code == status.HTTP_200_OK
        assert len(res_stranger.json()["data"]["posts"]) == 0

        # 3. Public post is findable
        res_pub_post = api_client.get(
            "/api/v1/discovery/search/?q=Welcome Post&type=post"
        )
        assert res_pub_post.status_code == status.HTTP_200_OK
        assert len(res_pub_post.json()["data"]["posts"]) == 1
        assert (
            res_pub_post.json()["data"]["posts"][0]["title"]
            == "Public Community Welcome Post"
        )

        # 4. Active member/owner can find the VIP post
        api_client.force_authenticate(user=private_paid_community.owner)
        res_member_post = api_client.get(
            "/api/v1/discovery/search/?q=Investment Strategy&type=post"
        )
        assert res_member_post.status_code == status.HTTP_200_OK
        assert len(res_member_post.json()["data"]["posts"]) == 1
        assert (
            res_member_post.json()["data"]["posts"][0]["title"]
            == "Exclusive VIP Investment Strategy"
        )

    def test_paid_community_is_automatically_private(self, dev_awa):
        # If created with paid pricing, privacy_type is enforced to PRIVATE
        comm = Community.objects.create(
            name="Test Auto Private",
            slug="test-auto-private",
            owner=dev_awa,
            pricing_type=CommunityPricing.PAID,
            privacy_type=CommunityPrivacy.PUBLIC,  # Intentionally passed as PUBLIC
        )
        assert comm.pricing_type == CommunityPricing.PAID
        assert comm.privacy_type == CommunityPrivacy.PRIVATE
