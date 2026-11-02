from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.communities.models.community import Community, CommunityPrivacy
from apps.communities.models.settings import CommunitySettings
from apps.memberships.models.invitation import CommunityInvitation, InvitationStatus
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.memberships.services.membership_service import MembershipService
from apps.notifications.models.notification import Notification, NotificationType
from apps.notifications.services.notification_service import NotificationService
from apps.posts.models.bookmark import PostBookmark
from apps.posts.models.category import PostCategory
from apps.posts.models.post import Post, PostType
from apps.projects.models.project import Project, ProjectStatus


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def owner_user(db):
    return User.objects.create_user(
        email="owner_feat@kodinga.com",
        username="owner_feat",
        password="SecurePassword123!",
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin_feat@kodinga.com",
        username="admin_feat",
        password="SecurePassword123!",
    )


@pytest.fixture
def member_user(db):
    return User.objects.create_user(
        email="member_feat@kodinga.com",
        username="member_feat",
        password="SecurePassword123!",
    )


@pytest.fixture
def outsider_user(db):
    return User.objects.create_user(
        email="outsider_feat@kodinga.com",
        username="outsider_feat",
        password="SecurePassword123!",
    )


@pytest.fixture
def community(db, owner_user, admin_user, member_user):
    comm = Community.objects.create(
        name="Python Dakar Community",
        slug="python-dakar",
        owner=owner_user,
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunitySettings.objects.create(community=comm)
    CommunityMember.objects.create(
        community=comm,
        user=owner_user,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
        notifications_enabled=True,
    )
    CommunityMember.objects.create(
        community=comm,
        user=admin_user,
        role=CommunityRole.ADMIN,
        status=MembershipStatus.ACTIVE,
        notifications_enabled=True,
    )
    CommunityMember.objects.create(
        community=comm,
        user=member_user,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
        notifications_enabled=True,
    )
    return comm


@pytest.mark.django_db
class TestNewBackendFeatures:
    """
    Tests for all 8 backend backlog additions:
    1. Join request notifications with dedicated types (join_request, join_request_approved, join_request_rejected)
    2. Post Bookmark (save/unsave) & filtering
    3. Feed 'Populaires' ordering & filtering (category, type, tag, author)
    4. Community notifications bell (toggle, status, content broadcast filter)
    5. Shareable invite link (reusable, no email required)
    6. Event video link (video_url / location_url)
    7. Feature project showcase (is_featured toggle)
    8. Public profile contributions & communities
    """

    # -------------------------------------------------------------------------
    # 1. Join request notifications
    # -------------------------------------------------------------------------
    def test_join_request_notification_types_and_flow(self, api_client, community, owner_user, outsider_user):
        community.privacy_type = CommunityPrivacy.PRIVATE
        community.save()

        # Outsider requests to join private community
        api_client.force_authenticate(user=outsider_user)
        res = api_client.post(f"/api/v1/communities/{community.slug}/join/")
        assert res.status_code == status.HTTP_200_OK

        notif = Notification.objects.filter(
            recipient=owner_user,
            notification_type=NotificationType.JOIN_REQUEST
        ).first()
        assert notif is not None
        assert "demande d'adhésion" in notif.title.lower()

        # Approve join request
        member_record = CommunityMember.objects.get(community=community, user=outsider_user)
        MembershipService.approve_or_reject_member(
            actor_user=owner_user,
            member=member_record,
            approve=True
        )

        approval_notif = Notification.objects.filter(
            recipient=outsider_user,
            notification_type=NotificationType.JOIN_REQUEST_APPROVED
        ).first()
        assert approval_notif is not None
        assert "acceptée" in approval_notif.title.lower()

    # -------------------------------------------------------------------------
    # 2. Post Bookmark
    # -------------------------------------------------------------------------
    def test_post_bookmark_toggle_and_list(self, api_client, community, member_user):
        post = Post.objects.create(
            community=community,
            author=member_user,
            title="FastAPI vs Django Ninja",
            content="Quel framework choisir en 2026 ?",
            post_type=PostType.DISCUSSION,
        )

        api_client.force_authenticate(user=member_user)

        # Toggle bookmark ON
        res = api_client.post(f"/api/v1/posts/{post.id}/bookmark/")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"]["is_bookmarked"] is True
        assert PostBookmark.objects.filter(user=member_user, post=post).exists()

        # List bookmarked posts
        res_list = api_client.get("/api/v1/posts/bookmarks/")
        assert res_list.status_code == status.HTTP_200_OK
        results = res_list.data.get("results") or res_list.data.get("data")
        assert len(results) >= 1
        assert str(results[0]["id"]) == str(post.id)
        assert results[0]["is_bookmarked"] is True

        # Check feed with ?bookmarked=true
        res_feed = api_client.get(f"/api/v1/communities/{community.slug}/feed/?bookmarked=true")
        assert res_feed.status_code == status.HTTP_200_OK
        feed_items = res_feed.data.get("results") or res_feed.data.get("data")
        assert len(feed_items) == 1

        # Toggle bookmark OFF
        res_off = api_client.post(f"/api/v1/posts/{post.id}/bookmark/")
        assert res_off.status_code == status.HTTP_200_OK
        assert res_off.data["data"]["is_bookmarked"] is False
        assert not PostBookmark.objects.filter(user=member_user, post=post).exists()

    # -------------------------------------------------------------------------
    # 3. Feed "Populaires" ordering & filtering
    # -------------------------------------------------------------------------
    def test_community_feed_popular_sorting_and_filters(self, api_client, community, member_user):
        category = PostCategory.objects.create(
            community=community,
            name="Architecture",
            slug="architecture",
        )

        p1 = Post.objects.create(
            community=community,
            author=member_user,
            category=category,
            title="Post normal #python",
            content="Contenu simple",
            post_type=PostType.DISCUSSION,
            reactions_count=1,
            comments_count=1,
        )

        p2 = Post.objects.create(
            community=community,
            author=member_user,
            title="Post ultra populaire #django",
            content="Contenu viral avec beaucoup d'engagement",
            post_type=PostType.DISCUSSION,
            reactions_count=25,
            comments_count=10,
        )

        api_client.force_authenticate(user=member_user)

        # Popular sort: p2 should be first
        res_popular = api_client.get(f"/api/v1/communities/{community.slug}/feed/?sort=popular")
        assert res_popular.status_code == status.HTTP_200_OK
        items = res_popular.data.get("results") or res_popular.data.get("data")
        assert len(items) >= 2
        assert items[0]["id"] == str(p2.id)

        # Filter by category
        res_cat = api_client.get(f"/api/v1/communities/{community.slug}/feed/?category=architecture")
        assert res_cat.status_code == status.HTTP_200_OK
        cat_items = res_cat.data.get("results") or res_cat.data.get("data")
        assert len(cat_items) == 1
        assert cat_items[0]["id"] == str(p1.id)

        # Filter by tag
        res_tag = api_client.get(f"/api/v1/communities/{community.slug}/feed/?tag=django")
        assert res_tag.status_code == status.HTTP_200_OK
        tag_items = res_tag.data.get("results") or res_tag.data.get("data")
        assert len(tag_items) == 1
        assert tag_items[0]["id"] == str(p2.id)

    # -------------------------------------------------------------------------
    # 4. Community Notifications Bell
    # -------------------------------------------------------------------------
    def test_community_notifications_bell_toggle(self, api_client, community, member_user):
        api_client.force_authenticate(user=member_user)

        # Initial status
        res_status = api_client.get(f"/api/v1/communities/{community.slug}/notifications/")
        assert res_status.status_code == status.HTTP_200_OK
        assert res_status.data["data"]["notifications_enabled"] is True

        # Toggle OFF
        res_toggle = api_client.post(f"/api/v1/communities/{community.slug}/notifications/toggle/")
        assert res_toggle.status_code == status.HTTP_200_OK
        assert res_toggle.data["data"]["notifications_enabled"] is False

        # Community detail check
        res_detail = api_client.get(f"/api/v1/communities/{community.slug}/")
        assert res_detail.status_code == status.HTTP_200_OK
        assert res_detail.data["data"]["user_membership"]["notifications_enabled"] is False

        # Member with disabled notifications does not receive content broadcast
        count_before = Notification.objects.filter(recipient=member_user).count()
        NotificationService.notify_community_content_published(
            community=community,
            actor=community.owner,
            content_type="course",
            content_id="course-12345",
            title="Nouveau Cours Python Avancé",
            action_url="/courses/course-12345",
        )
        count_after = Notification.objects.filter(recipient=member_user).count()
        assert count_after == count_before  # member was excluded because notifications_enabled=False

    # -------------------------------------------------------------------------
    # 5. Shareable Invite Link
    # -------------------------------------------------------------------------
    def test_shareable_invite_link_creation_and_reusable_acceptance(
        self, api_client, community, owner_user, outsider_user
    ):
        api_client.force_authenticate(user=owner_user)

        # Generate shareable link
        res = api_client.post(f"/api/v1/communities/{community.slug}/invitations/share-link/")
        assert res.status_code == status.HTTP_200_OK
        raw_token = res.data["data"]["token"]
        assert raw_token != ""
        assert "/invite/" in res.data["data"]["share_url"]

        # Outside user joins via shareable token
        api_client.force_authenticate(user=outsider_user)
        accept_res = api_client.post(
            f"/api/v1/communities/invitations/{raw_token}/accept/",
            format="json"
        )
        assert accept_res.status_code == status.HTTP_200_OK
        assert CommunityMember.objects.filter(
            community=community, user=outsider_user, status=MembershipStatus.ACTIVE
        ).exists()

        # Link should still be pending and reusable (not consumed after 1 use)
        invitation = CommunityInvitation.objects.filter(invite_code=raw_token).first()
        assert invitation.status == InvitationStatus.PENDING
        assert invitation.uses_count >= 1

    # -------------------------------------------------------------------------
    # 6. Event Video URL
    # -------------------------------------------------------------------------
    def test_event_video_url_support(self, api_client, community, owner_user):
        api_client.force_authenticate(user=owner_user)

        start = timezone.now() + timedelta(days=2)
        end = start + timedelta(hours=2)

        # Create event with video_url
        payload = {
            "title": "Workshop Django & LiveKit",
            "format": "external",
            "event_type": "workshop",
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "video_url": "https://meet.google.com/abc-defg-hij",
        }
        res_create = api_client.post(f"/api/v1/communities/{community.slug}/events/", payload, format="json")
        assert res_create.status_code == status.HTTP_201_CREATED
        event_slug = res_create.data["data"]["slug"]
        assert res_create.data["data"]["video_url"] == "https://meet.google.com/abc-defg-hij"

        # Detail endpoint returns video_url
        res_detail = api_client.get(f"/api/v1/communities/{community.slug}/events/{event_slug}/")
        assert res_detail.status_code == status.HTTP_200_OK
        assert res_detail.data["data"]["video_url"] == "https://meet.google.com/abc-defg-hij"

    # -------------------------------------------------------------------------
    # 7. Project Feature Toggle
    # -------------------------------------------------------------------------
    def test_project_feature_toggle(self, api_client, community, owner_user, member_user):
        project = Project.objects.create(
            owner=member_user,
            community=community,
            title="Kodinga CLI Tool",
            slug="kodinga-cli-tool",
            status=ProjectStatus.PUBLISHED,
            is_featured=False,
        )

        # Member cannot feature
        api_client.force_authenticate(user=member_user)
        res_unauth = api_client.post(f"/api/v1/projects/{project.slug}/feature/")
        assert res_unauth.status_code == status.HTTP_403_FORBIDDEN

        # Owner features the project
        api_client.force_authenticate(user=owner_user)
        res_feat = api_client.post(f"/api/v1/projects/{project.slug}/feature/")
        assert res_feat.status_code == status.HTTP_200_OK
        project.refresh_from_db()
        assert project.is_featured is True
        assert res_feat.data["data"]["is_featured"] is True

    # -------------------------------------------------------------------------
    # 8. Public Profile Contributions and Communities
    # -------------------------------------------------------------------------
    def test_public_profile_contributions_and_communities(self, api_client, community, member_user):
        Post.objects.create(
            community=community,
            author=member_user,
            title="First Post",
            content="Hello world",
        )
        Project.objects.create(
            owner=member_user,
            community=community,
            title="My Great App",
            status=ProjectStatus.PUBLISHED,
        )

        res_profile = api_client.get(f"/api/v1/profiles/{member_user.username}/")
        assert res_profile.status_code == status.HTTP_200_OK
        data = res_profile.data.get("data") or res_profile.data

        # Verify communities list
        assert "communities" in data
        assert len(data["communities"]) >= 1
        assert data["communities"][0]["slug"] == community.slug

        # Verify contributions
        assert "contributions" in data
        contribs = data["contributions"]
        assert contribs["posts_count"] >= 1
        assert contribs["projects_count"] >= 1
        assert len(contribs["recent_posts"]) >= 1
        assert len(contribs["recent_projects"]) >= 1

    # -------------------------------------------------------------------------
    # 9. Community Member Directory Filtering and Ordering
    # -------------------------------------------------------------------------
    def test_community_members_filtering_and_ordering(self, api_client, community, member_user):
        api_client.force_authenticate(user=member_user)
        res = api_client.get(f"/api/v1/communities/{community.slug}/members/")
        assert res.status_code == status.HTTP_200_OK
        members = res.data.get("results") or res.data.get("data")
        assert len(members) >= 3

        # Filter by role
        res_admin = api_client.get(f"/api/v1/communities/{community.slug}/members/?role=admin")
        assert res_admin.status_code == status.HTTP_200_OK
        admin_members = res_admin.data.get("results") or res_admin.data.get("data")
        assert len(admin_members) == 1
        assert admin_members[0]["role"] == "admin"

        # Search member
        res_search = api_client.get(f"/api/v1/communities/{community.slug}/members/?search=member_feat")
        assert res_search.status_code == status.HTTP_200_OK
        found = res_search.data.get("results") or res_search.data.get("data")
        assert len(found) == 1
        assert found[0]["user"]["username"] == "member_feat"
