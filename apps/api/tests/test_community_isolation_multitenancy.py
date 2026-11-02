from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.classroom.models.course import Course, CourseLevel
from apps.classroom.models.lesson import Lesson, LessonType
from apps.classroom.models.module import CourseModule
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.hackathons.models.hackathon import Hackathon, HackathonStatus
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.opportunities.models.opportunity import (
    Opportunity,
    OpportunityType,
    WorkplaceType,
)
from apps.posts.models.poll import Poll, PollOption
from apps.posts.models.post import Post, PostType
from apps.projects.models.project import Project


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def owner_user(db):
    return User.objects.create_user(
        username="owner_user",
        email="owner@kodinga.com",
        password="Password123!",
    )


@pytest.fixture
def user_a(db):
    """Member of Community A only"""
    return User.objects.create_user(
        username="user_a",
        email="user_a@kodinga.com",
        password="Password123!",
    )


@pytest.fixture
def user_b(db):
    """Member of Community B only"""
    return User.objects.create_user(
        username="user_b",
        email="user_b@kodinga.com",
        password="Password123!",
    )


@pytest.fixture
def community_a(db, owner_user, user_a):
    comm = Community.objects.create(
        name="Community Alpha",
        slug="community-alpha",
        owner=owner_user,
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunityMember.objects.create(
        community=comm,
        user=user_a,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.fixture
def community_b(db, owner_user, user_b):
    comm = Community.objects.create(
        name="Community Beta",
        slug="community-beta",
        owner=owner_user,
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunityMember.objects.create(
        community=comm,
        user=user_b,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.mark.django_db
class TestCommunityIsolationOpportunities:
    def test_cannot_post_opportunity_in_foreign_community(
        self, api_client, user_a, community_a, community_b
    ):
        api_client.force_authenticate(user=user_a)

        # Attempt to publish into Community B (where user_a is NOT a member)
        payload = {
            "title": "Senior Python Engineer",
            "opportunity_type": "full_time",
            "workplace_type": "remote",
            "description": "Looking for a seasoned backend engineer.",
            "company_name": "Alpha Corp",
            "community_id": str(community_b.id),
        }
        res = api_client.post("/api/v1/opportunities/", payload, format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert "membre actif de cette communauté" in str(res.data)

        # Publish into Community A (where user_a IS a member)
        payload["community_id"] = str(community_a.id)
        res_ok = api_client.post("/api/v1/opportunities/", payload, format="json")
        assert res_ok.status_code == status.HTTP_201_CREATED
        assert res_ok.data["success"] is True
        assert res_ok.data["data"]["title"] == "Senior Python Engineer"

    def test_cannot_apply_to_foreign_community_opportunity(
        self, api_client, user_a, owner_user, community_b
    ):
        # Opportunity created in Community B by owner
        opp = Opportunity.objects.create(
            poster=owner_user,
            community=community_b,
            title="DevOps Lead",
            slug="devops-lead",
            opportunity_type=OpportunityType.FULL_TIME,
            workplace_type=WorkplaceType.REMOTE,
            company_name="Beta Inc",
            description="Leading cloud infra",
        )

        # user_a (member of A, not B) attempts to apply
        api_client.force_authenticate(user=user_a)
        res = api_client.post(
            f"/api/v1/opportunities/{opp.slug}/apply/",
            {
                "resume_url": "https://example.com/cv.pdf",
                "cover_letter": "I want to apply",
            },
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert "membre actif de cette communauté" in str(res.data)

    def test_cannot_read_opportunities_in_private_community(
        self, api_client, user_a, user_b, owner_user, private_community
    ):
        opp = Opportunity.objects.create(
            poster=owner_user,
            community=private_community,
            title="Confidential CTO Search",
            slug="confidential-cto-search",
            opportunity_type=OpportunityType.FULL_TIME,
            workplace_type=WorkplaceType.REMOTE,
            company_name="Private Stealth Corp",
            description="Leading stealth venture.",
        )

        # 1. Anonymous cannot list via community slug
        res_anon_list = api_client.get(f"/api/v1/opportunities/?community={private_community.slug}")
        assert res_anon_list.status_code == status.HTTP_401_UNAUTHORIZED

        # 2. Anonymous cannot get opportunity detail
        res_anon_detail = api_client.get(f"/api/v1/opportunities/{opp.slug}/")
        assert res_anon_detail.status_code == status.HTTP_401_UNAUTHORIZED

        # 3. Anonymous does NOT see private opportunity in global feed
        res_anon_feed = api_client.get("/api/v1/opportunities/")
        assert res_anon_feed.status_code == status.HTTP_200_OK
        assert not any(o["slug"] == opp.slug for o in res_anon_feed.data["data"])

        # 4. Non-member (user_b) cannot list via community slug
        api_client.force_authenticate(user=user_b)
        res_non_member_list = api_client.get(f"/api/v1/opportunities/?community={private_community.slug}")
        assert res_non_member_list.status_code == status.HTTP_403_FORBIDDEN

        # 5. Non-member cannot get opportunity detail
        res_non_member_detail = api_client.get(f"/api/v1/opportunities/{opp.slug}/")
        assert res_non_member_detail.status_code == status.HTTP_403_FORBIDDEN

        # 6. Non-member does NOT see private opportunity in global feed
        res_non_member_feed = api_client.get("/api/v1/opportunities/")
        assert res_non_member_feed.status_code == status.HTTP_200_OK
        assert not any(o["slug"] == opp.slug for o in res_non_member_feed.data["data"])

        # 7. Active member (user_a) CAN read list and detail
        api_client.force_authenticate(user=user_a)
        res_member_list = api_client.get(f"/api/v1/opportunities/?community={private_community.slug}")
        assert res_member_list.status_code == status.HTTP_200_OK
        assert any(o["slug"] == opp.slug for o in res_member_list.data["data"])

        res_member_detail = api_client.get(f"/api/v1/opportunities/{opp.slug}/")
        assert res_member_detail.status_code == status.HTTP_200_OK
        assert res_member_detail.data["data"]["title"] == "Confidential CTO Search"


@pytest.mark.django_db
class TestCommunityIsolationProjects:
    def test_cannot_post_project_in_foreign_community(
        self, api_client, user_a, community_a, community_b
    ):
        api_client.force_authenticate(user=user_a)

        # Attempt to publish showcase into Community B
        payload = {
            "title": "AI Assistant SaaS",
            "description": "Next-gen AI assistant tool.",
            "community_id": str(community_b.id),
        }
        res = api_client.post("/api/v1/projects/", payload, format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert "membre actif de cette communauté" in str(res.data)

        # Publish into Community A (member)
        payload["community_id"] = str(community_a.id)
        res_ok = api_client.post("/api/v1/projects/", payload, format="json")
        assert res_ok.status_code == status.HTTP_201_CREATED
        assert res_ok.data["success"] is True
        assert res_ok.data["data"]["title"] == "AI Assistant SaaS"

    def test_cannot_interact_with_foreign_community_project(
        self, api_client, user_a, owner_user, community_b
    ):
        proj = Project.objects.create(
            owner=owner_user,
            community=community_b,
            title="Beta Showcase",
            slug="beta-showcase",
            description="Beta project",
        )

        api_client.force_authenticate(user=user_a)

        # Upvote attempt
        res_vote = api_client.post(f"/api/v1/projects/{proj.slug}/upvote/")
        assert res_vote.status_code == status.HTTP_403_FORBIDDEN

        # Comment attempt
        res_comment = api_client.post(
            f"/api/v1/projects/{proj.slug}/comments/",
            {"content": "Awesome project!"},
            format="json",
        )
        assert res_comment.status_code == status.HTTP_403_FORBIDDEN

    def test_cannot_read_projects_in_private_community(
        self, api_client, user_a, user_b, owner_user, private_community
    ):
        proj = Project.objects.create(
            owner=owner_user,
            community=private_community,
            title="Secret Fintech Tool",
            slug="secret-fintech-tool",
            description="High frequency trading engine.",
        )

        # 1. Anonymous cannot list via community slug
        res_anon_list = api_client.get(f"/api/v1/projects/?community={private_community.slug}")
        assert res_anon_list.status_code == status.HTTP_401_UNAUTHORIZED

        # 2. Anonymous cannot get project detail
        res_anon_detail = api_client.get(f"/api/v1/projects/{proj.slug}/")
        assert res_anon_detail.status_code == status.HTTP_401_UNAUTHORIZED

        # 3. Anonymous cannot get project comments
        res_anon_comments = api_client.get(f"/api/v1/projects/{proj.slug}/comments/")
        assert res_anon_comments.status_code == status.HTTP_401_UNAUTHORIZED

        # 4. Anonymous does NOT see private project in global feed
        res_anon_feed = api_client.get("/api/v1/projects/")
        assert res_anon_feed.status_code == status.HTTP_200_OK
        assert not any(p["slug"] == proj.slug for p in res_anon_feed.data["data"])

        # 5. Non-member (user_b) cannot list via community slug
        api_client.force_authenticate(user=user_b)
        res_non_member_list = api_client.get(f"/api/v1/projects/?community={private_community.slug}")
        assert res_non_member_list.status_code == status.HTTP_403_FORBIDDEN

        # 6. Non-member cannot get project detail
        res_non_member_detail = api_client.get(f"/api/v1/projects/{proj.slug}/")
        assert res_non_member_detail.status_code == status.HTTP_403_FORBIDDEN

        # 7. Non-member does NOT see private project in global feed
        res_non_member_feed = api_client.get("/api/v1/projects/")
        assert res_non_member_feed.status_code == status.HTTP_200_OK
        assert not any(p["slug"] == proj.slug for p in res_non_member_feed.data["data"])

        # 8. Active member (user_a) CAN read list and detail
        api_client.force_authenticate(user=user_a)
        res_member_list = api_client.get(f"/api/v1/projects/?community={private_community.slug}")
        assert res_member_list.status_code == status.HTTP_200_OK
        assert any(p["slug"] == proj.slug for p in res_member_list.data["data"])

        res_member_detail = api_client.get(f"/api/v1/projects/{proj.slug}/")
        assert res_member_detail.status_code == status.HTTP_200_OK
        assert res_member_detail.data["data"]["title"] == "Secret Fintech Tool"


@pytest.mark.django_db
class TestCommunityIsolationFeedAndPosts:
    def test_cannot_post_in_foreign_community_feed(
        self, api_client, user_a, community_b
    ):
        api_client.force_authenticate(user=user_a)
        res = api_client.post(
            f"/api/v1/communities/{community_b.slug}/feed/",
            {"title": "Unwelcome post", "content": "Hello community B"},
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_cannot_react_or_vote_in_foreign_community_post(
        self, api_client, user_a, owner_user, community_b
    ):
        post = Post.objects.create(
            author=owner_user,
            community=community_b,
            title="Community B Announcement",
            content="Important updates",
            post_type=PostType.POLL,
        )
        poll = Poll.objects.create(
            post=post,
            question="Which framework do you prefer?",
        )
        opt1 = PollOption.objects.create(poll=poll, text="Django", order=0)
        PollOption.objects.create(poll=poll, text="FastAPI", order=1)

        api_client.force_authenticate(user=user_a)

        # Attempt to react
        res_react = api_client.post(
            f"/api/v1/posts/{post.id}/react/",
            {"reaction_type": "like"},
            format="json",
        )
        assert res_react.status_code == status.HTTP_403_FORBIDDEN

        # Attempt to comment
        res_comment = api_client.post(
            f"/api/v1/posts/{post.id}/comments/",
            {"content": "My unwanted opinion"},
            format="json",
        )
        assert res_comment.status_code == status.HTTP_403_FORBIDDEN

        # Attempt to vote
        res_vote = api_client.post(
            f"/api/v1/posts/{post.id}/vote/",
            {"option_ids": [str(opt1.id)]},
            format="json",
        )
        assert res_vote.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestCommunityIsolationHackathons:
    def test_cannot_apply_to_foreign_community_hackathon(
        self, api_client, user_a, owner_user, community_b
    ):
        now = timezone.now()
        hackathon = Hackathon.objects.create(
            community=community_b,
            organizer=owner_user,
            title="Beta AI Hackathon",
            slug="beta-ai-hackathon",
            description="AI hackathon in Beta",
            status=HackathonStatus.PUBLISHED,
            registration_start=now - timedelta(days=2),
            registration_end=now + timedelta(days=5),
            start_time=now + timedelta(days=6),
            submission_deadline=now + timedelta(days=10),
            judging_end=now + timedelta(days=12),
        )

        api_client.force_authenticate(user=user_a)
        res = api_client.post(
            f"/api/v1/communities/{community_b.slug}/hackathons/{hackathon.slug}/apply/",
            {"participation_mode": "individual", "accept_terms": True},
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN

        assert "membre actif de cette communauté" in str(res.data)


@pytest.mark.django_db
class TestCommunityIsolationClassroom:
    def test_cannot_enroll_or_progress_in_foreign_classroom(
        self, api_client, user_a, owner_user, community_b
    ):
        course = Course.objects.create(
            community=community_b,
            author=owner_user,
            title="Django Advanced",
            slug="django-advanced",
            description="Deep dive",
            level=CourseLevel.ADVANCED,
            is_published=True,
        )
        module = CourseModule.objects.create(course=course, title="Module 1", order=0)
        lesson = Lesson.objects.create(
            module=module,
            title="Lesson 1",
            slug="lesson-1",
            lesson_type=LessonType.TEXT,
            content="Hello world",
            order=0,
        )

        api_client.force_authenticate(user=user_a)

        # Attempt to enroll
        res_enroll = api_client.post(
            f"/api/v1/communities/{community_b.slug}/courses/{course.slug}/enroll/"
        )
        assert res_enroll.status_code == status.HTTP_403_FORBIDDEN

        # Attempt to record progress
        res_progress = api_client.post(
            f"/api/v1/communities/{community_b.slug}/courses/{course.slug}/lessons/{lesson.id}/progress/",
            {"is_completed": True},
            format="json",
        )
        assert res_progress.status_code == status.HTTP_403_FORBIDDEN


@pytest.fixture
def private_community(db, owner_user, user_a):
    comm = Community.objects.create(
        name="Private Club",
        slug="private-club",
        owner=owner_user,
        privacy_type=CommunityPrivacy.PRIVATE,
        pricing_type=CommunityPricing.FREE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=user_a,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.fixture
def paid_community(db, owner_user, user_a):
    comm = Community.objects.create(
        name="Paid Club",
        slug="paid-club",
        owner=owner_user,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.PAID,
    )
    CommunityMember.objects.create(
        community=comm,
        user=user_a,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.fixture
def public_free_community(db, owner_user):
    return Community.objects.create(
        name="Open Hub",
        slug="open-hub",
        owner=owner_user,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )


@pytest.mark.django_db
class TestCommunityFeedReadProtection:
    def test_anonymous_cannot_read_private_community_feed(
        self, api_client, private_community
    ):
        res = api_client.get(f"/api/v1/communities/{private_community.slug}/feed/")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_member_cannot_read_private_community_feed(
        self, api_client, user_b, private_community
    ):
        api_client.force_authenticate(user=user_b)
        res = api_client.get(f"/api/v1/communities/{private_community.slug}/feed/")
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert "membre actif ou abonné" in str(res.data)

    def test_member_can_read_private_community_feed(
        self, api_client, user_a, private_community
    ):
        api_client.force_authenticate(user=user_a)
        res = api_client.get(f"/api/v1/communities/{private_community.slug}/feed/")
        assert res.status_code == status.HTTP_200_OK

    def test_anonymous_cannot_read_paid_community_feed(
        self, api_client, paid_community
    ):
        res = api_client.get(f"/api/v1/communities/{paid_community.slug}/feed/")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_member_cannot_read_paid_community_feed(
        self, api_client, user_b, paid_community
    ):
        api_client.force_authenticate(user=user_b)
        res = api_client.get(f"/api/v1/communities/{paid_community.slug}/feed/")
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert "membre actif ou abonné" in str(res.data)

    def test_member_can_read_paid_community_feed(
        self, api_client, user_a, paid_community
    ):
        api_client.force_authenticate(user=user_a)
        res = api_client.get(f"/api/v1/communities/{paid_community.slug}/feed/")
        assert res.status_code == status.HTTP_200_OK

    def test_anonymous_can_read_public_free_community_feed(
        self, api_client, public_free_community
    ):
        res = api_client.get(f"/api/v1/communities/{public_free_community.slug}/feed/")
        assert res.status_code == status.HTTP_200_OK

    def test_cannot_read_post_or_comments_in_private_community(
        self, api_client, user_a, user_b, owner_user, private_community
    ):
        post = Post.objects.create(
            community=private_community,
            author=owner_user,
            title="Confidential Post",
            content="Top secret content",
            post_type=PostType.DISCUSSION,
        )

        # Anonymous cannot read
        res_anon_detail = api_client.get(f"/api/v1/posts/{post.id}/")
        assert res_anon_detail.status_code == status.HTTP_401_UNAUTHORIZED

        res_anon_comments = api_client.get(f"/api/v1/posts/{post.id}/comments/")
        assert res_anon_comments.status_code == status.HTTP_401_UNAUTHORIZED

        # Non-member cannot read
        api_client.force_authenticate(user=user_b)
        res_non_member_detail = api_client.get(f"/api/v1/posts/{post.id}/")
        assert res_non_member_detail.status_code == status.HTTP_403_FORBIDDEN

        res_non_member_comments = api_client.get(f"/api/v1/posts/{post.id}/comments/")
        assert res_non_member_comments.status_code == status.HTTP_403_FORBIDDEN

        # Active member can read
        api_client.force_authenticate(user=user_a)
        res_member_detail = api_client.get(f"/api/v1/posts/{post.id}/")
        assert res_member_detail.status_code == status.HTTP_200_OK

        res_member_comments = api_client.get(f"/api/v1/posts/{post.id}/comments/")
        assert res_member_comments.status_code == status.HTTP_200_OK

    def test_cannot_read_categories_in_private_community(
        self, api_client, user_a, user_b, private_community
    ):
        # Anonymous cannot list categories
        res_anon = api_client.get(
            f"/api/v1/communities/{private_community.slug}/categories/"
        )
        assert res_anon.status_code == status.HTTP_401_UNAUTHORIZED

        # Non-member cannot list categories
        api_client.force_authenticate(user=user_b)
        res_non_member = api_client.get(
            f"/api/v1/communities/{private_community.slug}/categories/"
        )
        assert res_non_member.status_code == status.HTTP_403_FORBIDDEN

        # Member can list categories
        api_client.force_authenticate(user=user_a)
        res_member = api_client.get(
            f"/api/v1/communities/{private_community.slug}/categories/"
        )
        assert res_member.status_code == status.HTTP_200_OK
