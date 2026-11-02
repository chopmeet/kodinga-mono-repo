from datetime import timedelta

import pytest
from apps.accounts.models.user import User
from apps.billing.models.plan import Plan
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.communities.models.settings import CommunitySettings
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.messaging.models.conversation import Conversation, ConversationType
from apps.messaging.models.message import Message
from apps.messaging.models.participant import ConversationParticipant
from apps.notifications.models.notification import Notification, NotificationType
from apps.notifications.services.notification_service import NotificationService
from apps.opportunities.models.opportunity import (
    Opportunity,
    OpportunityType,
    WorkplaceType,
)
from apps.posts.models.comment import Comment
from apps.posts.models.post import Post, PostType
from apps.projects.models.project import Project
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def superadmin_user(db):
    """
    A user with is_superadmin=True. Note that is_superuser and is_staff
    are automatically synchronized to True by the model's clean/save logic.
    """
    user = User.objects.create_user(
        username="superhero",
        email="superadmin@kodinga.com",
        password="SuperPassword123!",
        is_superadmin=True,
    )
    return user


@pytest.fixture
def regular_user(db):
    return User.objects.create_user(
        username="alice",
        email="alice@kodinga.com",
        password="AlicePassword123!",
    )


@pytest.fixture
def member_user(db):
    return User.objects.create_user(
        username="bob",
        email="bob@kodinga.com",
        password="BobPassword123!",
    )


@pytest.fixture
def secret_community(db, regular_user):
    community = Community.objects.create(
        name="Alice Secret Club",
        slug="alice-secret-club",
        owner=regular_user,
        privacy_type=CommunityPrivacy.SECRET,
        pricing_type=CommunityPricing.FREE,
    )
    CommunitySettings.objects.create(community=community)
    CommunityMember.objects.create(
        community=community,
        user=regular_user,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    return community


@pytest.mark.django_db
class TestSuperadminFullAccess:
    def test_superadmin_user_model_flags(self, superadmin_user):
        """Verify model-level flags and permissions for superadmin."""
        assert superadmin_user.is_superadmin is True
        assert superadmin_user.is_superuser is True
        assert superadmin_user.is_staff is True
        assert superadmin_user.has_perm("any_module.any_perm") is True
        assert superadmin_user.has_perms(["perm1", "perm2"]) is True
        assert superadmin_user.has_module_perms("any_module") is True

    # -------------------------------------------------------------------------
    # 1. COMMUNITIES: GET, POST, PATCH, DELETE
    # -------------------------------------------------------------------------
    def test_superadmin_can_access_and_manage_secret_community(
        self, api_client, superadmin_user, secret_community
    ):
        api_client.force_authenticate(user=superadmin_user)

        # 1. GET secret community details
        response = api_client.get(f"/api/v1/communities/{secret_community.slug}/")
        assert response.status_code == status.HTTP_200_OK

        # 2. PATCH secret community owned by alice
        patch_response = api_client.patch(
            f"/api/v1/communities/{secret_community.slug}/",
            {
                "name": "Alice Secret Club Overridden by Admin",
                "tagline": "Updated by Superadmin",
            },
            format="json",
        )
        assert patch_response.status_code == status.HTTP_200_OK
        secret_community.refresh_from_db()
        assert secret_community.name == "Alice Secret Club Overridden by Admin"

        # 3. POST community rule
        rule_response = api_client.post(
            f"/api/v1/communities/{secret_community.slug}/rules/",
            {
                "title": "Admin Rule",
                "description": "Respect platform rules",
                "order": 1,
            },
            format="json",
        )
        assert rule_response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_201_CREATED,
        ]
        rule_id = rule_response.data["data"]["id"]

        # 4. DELETE community rule
        del_rule_response = api_client.delete(
            f"/api/v1/communities/{secret_community.slug}/rules/{rule_id}/"
        )
        assert del_rule_response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_204_NO_CONTENT,
        ]

        # 5. PATCH community settings
        settings_response = api_client.patch(
            f"/api/v1/communities/{secret_community.slug}/settings/",
            {"allow_member_invites": True},
            format="json",
        )
        assert settings_response.status_code == status.HTTP_200_OK

        # 6. DELETE community
        del_community_response = api_client.delete(
            f"/api/v1/communities/{secret_community.slug}/"
        )
        assert del_community_response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_204_NO_CONTENT,
        ]

    # -------------------------------------------------------------------------
    # 2. POSTS & COMMENTS: GET, POST, PATCH, DELETE, PIN, LOCK
    # -------------------------------------------------------------------------
    def test_superadmin_can_manage_posts_and_comments(
        self, api_client, superadmin_user, secret_community, regular_user
    ):
        api_client.force_authenticate(user=superadmin_user)

        # Alice creates a post
        alice_post = Post.objects.create(
            community=secret_community,
            author=regular_user,
            title="Alice's Question",
            content="How do I deploy Django?",
            post_type=PostType.QUESTION,
        )
        alice_comment = Comment.objects.create(
            post=alice_post,
            author=regular_user,
            content="Initial thought by Alice",
        )

        # 1. GET post
        get_res = api_client.get(f"/api/v1/posts/{alice_post.id}/")
        assert get_res.status_code == status.HTTP_200_OK

        # 2. PATCH post (superadmin updates alice's post)
        patch_res = api_client.patch(
            f"/api/v1/posts/{alice_post.id}/",
            {"title": "Updated Title by Superadmin"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_200_OK
        alice_post.refresh_from_db()
        assert alice_post.title == "Updated Title by Superadmin"

        # 3. POST toggle pin
        pin_res = api_client.post(f"/api/v1/posts/{alice_post.id}/pin/")
        assert pin_res.status_code == status.HTTP_200_OK
        alice_post.refresh_from_db()
        assert alice_post.is_pinned is True

        # 4. POST toggle lock
        lock_res = api_client.post(f"/api/v1/posts/{alice_post.id}/lock/")
        assert lock_res.status_code == status.HTTP_200_OK
        alice_post.refresh_from_db()
        assert alice_post.is_locked is True

        # 5. POST comment by superadmin on locked post
        comment_res = api_client.post(
            f"/api/v1/posts/{alice_post.id}/comments/",
            {"content": "Superadmin answering on locked post"},
            format="json",
        )
        assert comment_res.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]

        # 6. DELETE alice's comment
        del_comment_res = api_client.delete(f"/api/v1/comments/{alice_comment.id}/")
        assert del_comment_res.status_code in [
            status.HTTP_200_OK,
            status.HTTP_204_NO_CONTENT,
        ]

        # 7. DELETE alice's post
        del_post_res = api_client.delete(f"/api/v1/posts/{alice_post.id}/")
        assert del_post_res.status_code in [
            status.HTTP_200_OK,
            status.HTTP_204_NO_CONTENT,
        ]

    # -------------------------------------------------------------------------
    # 3. CLASSROOM: GET, POST, PATCH, DELETE
    # -------------------------------------------------------------------------
    def test_superadmin_can_manage_classroom(
        self, api_client, superadmin_user, secret_community
    ):
        api_client.force_authenticate(user=superadmin_user)

        # 1. POST create course
        course_res = api_client.post(
            f"/api/v1/communities/{secret_community.slug}/courses/",
            {
                "title": "Mastering Python",
                "description": "From zero to hero in Python",
                "level": "intermediate",
                "is_published": True,
            },
            format="json",
        )
        assert course_res.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]
        course_slug = course_res.data["data"]["slug"]

        # 2. GET list courses
        list_res = api_client.get(
            f"/api/v1/communities/{secret_community.slug}/courses/"
        )
        assert list_res.status_code == status.HTTP_200_OK

        # 3. PATCH update course
        patch_res = api_client.patch(
            f"/api/v1/communities/{secret_community.slug}/courses/{course_slug}/",
            {"description": "Updated course description"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_200_OK

        # 4. DELETE course
        del_res = api_client.delete(
            f"/api/v1/communities/{secret_community.slug}/courses/{course_slug}/"
        )
        assert del_res.status_code in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]

    # -------------------------------------------------------------------------
    # 4. EVENTS: GET, POST, PATCH, DELETE
    # -------------------------------------------------------------------------
    def test_superadmin_can_manage_events(
        self, api_client, superadmin_user, secret_community
    ):
        api_client.force_authenticate(user=superadmin_user)

        start_time = (timezone.now() + timedelta(days=2)).isoformat()
        end_time = (timezone.now() + timedelta(days=2, hours=2)).isoformat()

        # 1. POST create event with valid workshop and livekit format
        event_res = api_client.post(
            f"/api/v1/communities/{secret_community.slug}/events/",
            {
                "title": "Django Workshop",
                "description": "Live webinar",
                "event_type": "workshop",
                "format": "livekit",
                "start_time": start_time,
                "end_time": end_time,
                "is_public": True,
            },
            format="json",
        )
        assert event_res.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]
        event_id = event_res.data["data"]["id"]

        # 2. GET list community events
        list_res = api_client.get(
            f"/api/v1/communities/{secret_community.slug}/events/"
        )
        assert list_res.status_code == status.HTTP_200_OK

        # 3. PATCH event
        patch_res = api_client.patch(
            f"/api/v1/communities/{secret_community.slug}/events/{event_id}/",
            {"title": "Updated Django Workshop"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_200_OK

        # 4. DELETE event
        del_res = api_client.delete(
            f"/api/v1/communities/{secret_community.slug}/events/{event_id}/"
        )
        assert del_res.status_code in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]

    # -------------------------------------------------------------------------
    # 5. MEMBERSHIPS & RBAC: PUT (approve), PATCH (role), DELETE
    # -------------------------------------------------------------------------
    def test_superadmin_can_manage_memberships(
        self, api_client, superadmin_user, secret_community, member_user
    ):
        api_client.force_authenticate(user=superadmin_user)

        # Bob joins secret community as pending
        bob_membership = CommunityMember.objects.create(
            community=secret_community,
            user=member_user,
            role=CommunityRole.MEMBER,
            status=MembershipStatus.PENDING,
        )

        # 1. PUT approve member
        approve_res = api_client.put(
            f"/api/v1/communities/{secret_community.slug}/members/{bob_membership.id}/",
            {"approve": True},
            format="json",
        )
        assert approve_res.status_code == status.HTTP_200_OK
        bob_membership.refresh_from_db()
        assert bob_membership.status == MembershipStatus.ACTIVE

        # 2. PATCH change role to moderator
        role_res = api_client.patch(
            f"/api/v1/communities/{secret_community.slug}/members/{bob_membership.id}/",
            {"role": "moderator"},
            format="json",
        )
        assert role_res.status_code == status.HTTP_200_OK
        bob_membership.refresh_from_db()
        assert bob_membership.role == CommunityRole.MODERATOR

        # 3. POST sanction member (ban)
        sanction_res = api_client.post(
            f"/api/v1/communities/{secret_community.slug}/members/{bob_membership.id}/sanctions/",
            {"sanction_type": "ban", "reason": "Violation des règles"},
            format="json",
        )
        assert sanction_res.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]

    # -------------------------------------------------------------------------
    # 6. MESSAGING: POST, PATCH, DELETE, PIN
    # -------------------------------------------------------------------------
    def test_superadmin_can_manage_messages(
        self, api_client, superadmin_user, secret_community, regular_user
    ):
        api_client.force_authenticate(user=superadmin_user)

        conv = Conversation.objects.create(
            title="announcements",
            conversation_type=ConversationType.GROUP,
            community=secret_community,
            created_by=regular_user,
        )
        ConversationParticipant.objects.create(
            conversation=conv,
            user=regular_user,
        )

        # Set community read-only
        secret_community.settings.is_read_only = True
        secret_community.settings.save()

        alice_msg = Message.objects.create(
            conversation=conv,
            sender=regular_user,
            content="Welcome to announcements!",
        )

        # 1. POST send message even when room is read-only
        send_res = api_client.post(
            f"/api/v1/conversations/{conv.id}/messages/",
            {"content": "Admin override announcement"},
            format="json",
        )
        assert send_res.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]

        # 2. PATCH edit alice's message
        patch_res = api_client.patch(
            f"/api/v1/messages/{alice_msg.id}/",
            {"content": "Edited by admin"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_200_OK
        alice_msg.refresh_from_db()
        assert alice_msg.content == "Edited by admin"

        # 3. POST pin alice's message
        pin_res = api_client.post(f"/api/v1/messages/{alice_msg.id}/pin/")
        assert pin_res.status_code == status.HTTP_200_OK
        alice_msg.refresh_from_db()
        assert alice_msg.is_pinned is True

        # 4. DELETE alice's message
        del_res = api_client.delete(f"/api/v1/messages/{alice_msg.id}/")
        assert del_res.status_code in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]

    # -------------------------------------------------------------------------
    # 7. BILLING PLANS: POST, PATCH, DELETE
    # -------------------------------------------------------------------------
    def test_superadmin_can_manage_billing_plans(
        self, api_client, superadmin_user, secret_community
    ):
        api_client.force_authenticate(user=superadmin_user)

        # 1. POST create plan for secret_community without having to be a Pro user
        plan_res = api_client.post(
            "/api/v1/billing/plans/",
            {
                "community_id": str(secret_community.id),
                "name": "VIP Monthly Access",
                "price": "10000.00",
                "billing_interval": "month",
            },
            format="json",
        )
        assert plan_res.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]
        plan_id = plan_res.data["data"]["id"]

        # 2. PATCH plan
        patch_res = api_client.patch(
            f"/api/v1/billing/plans/{plan_id}/",
            {"price": "12000.00"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_200_OK

        # 3. DELETE (deactivate) plan
        del_res = api_client.delete(f"/api/v1/billing/plans/{plan_id}/")
        assert del_res.status_code == status.HTTP_200_OK
        plan = Plan.objects.get(id=plan_id)
        assert plan.is_active is False

    # -------------------------------------------------------------------------
    # 8. PROJECTS & OPPORTUNITIES: PATCH, DELETE
    # -------------------------------------------------------------------------
    def test_superadmin_can_manage_projects_and_opportunities(
        self, api_client, superadmin_user, regular_user
    ):
        api_client.force_authenticate(user=superadmin_user)

        # Alice creates a project
        alice_project = Project.objects.create(
            owner=regular_user,
            title="Alice Showcase",
            slug="alice-showcase",
            tagline="An awesome app",
            description="Built with Django",
        )

        # 1. PATCH alice's project
        proj_patch = api_client.patch(
            f"/api/v1/projects/{alice_project.slug}/",
            {"tagline": "Showcase updated by Admin"},
            format="json",
        )
        assert proj_patch.status_code == status.HTTP_200_OK
        alice_project.refresh_from_db()
        assert alice_project.tagline == "Showcase updated by Admin"

        # 2. DELETE alice's project
        proj_del = api_client.delete(f"/api/v1/projects/{alice_project.slug}/")
        assert proj_del.status_code in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]
        assert not Project.objects.filter(id=alice_project.id).exists()

        # Alice creates an opportunity
        alice_opp = Opportunity.objects.create(
            poster=regular_user,
            title="Senior Backend Dev",
            slug="senior-backend-dev",
            company_name="Tech Corp",
            opportunity_type=OpportunityType.FULL_TIME,
            workplace_type=WorkplaceType.REMOTE,
            description="Great opportunity",
        )

        # 3. PATCH alice's opportunity
        opp_patch = api_client.patch(
            f"/api/v1/opportunities/{alice_opp.slug}/",
            {"company_name": "Tech Corp Worldwide"},
            format="json",
        )
        assert opp_patch.status_code == status.HTTP_200_OK
        alice_opp.refresh_from_db()
        assert alice_opp.company_name == "Tech Corp Worldwide"

        # 4. DELETE (close) alice's opportunity
        opp_close = api_client.delete(f"/api/v1/opportunities/{alice_opp.slug}/")
        assert opp_close.status_code == status.HTTP_200_OK
        alice_opp.refresh_from_db()
        assert alice_opp.status == "closed"

    # -------------------------------------------------------------------------
    # 9. AI & HEALTH APIS: GET, PATCH
    # -------------------------------------------------------------------------
    def test_superadmin_can_access_ai_and_health_apis(
        self, api_client, superadmin_user, secret_community
    ):
        api_client.force_authenticate(user=superadmin_user)

        # 1. GET AI settings for secret community
        ai_get = api_client.get(
            f"/api/v1/communities/{secret_community.slug}/ai-settings/"
        )
        assert ai_get.status_code == status.HTTP_200_OK

        # 2. PATCH AI settings for secret community
        ai_patch = api_client.patch(
            f"/api/v1/communities/{secret_community.slug}/ai-settings/",
            {"sentiment_analytics_enabled": False},
            format="json",
        )
        assert ai_patch.status_code == status.HTTP_200_OK

        # 3. GET AI health check
        health_res = api_client.get("/api/v1/admin/ai/health/")
        assert health_res.status_code == status.HTTP_200_OK

        # 4. GET AI moderation audit logs
        mod_res = api_client.get("/api/v1/ai/moderation/logs/")
        assert mod_res.status_code == status.HTTP_200_OK

    # -------------------------------------------------------------------------
    # 10. NOTIFICATIONS: READ & DELETE ANY NOTIFICATION
    # -------------------------------------------------------------------------
    def test_superadmin_can_manage_any_notification(
        self, superadmin_user, regular_user
    ):
        # Create a notification belonging to regular_user
        notif = Notification.objects.create(
            recipient=regular_user,
            title="Private notice for Alice",
            body="Important details",
            notification_type=NotificationType.SYSTEM,
        )

        # Superadmin can mark as read
        assert NotificationService.mark_as_read(str(notif.id), superadmin_user) is True
        notif.refresh_from_db()
        assert notif.is_read is True

        # Superadmin can delete notification
        assert (
            NotificationService.delete_notification(str(notif.id), superadmin_user)
            is True
        )
        assert not Notification.objects.filter(id=notif.id).exists()
