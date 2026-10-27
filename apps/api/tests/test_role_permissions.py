import pytest
from django.contrib.auth import get_user_model
from rest_framework.exceptions import PermissionDenied

from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.communities.models.settings import CommunitySettings
from apps.communities.services.community_service import CommunityService
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.memberships.permissions import has_community_permission

User = get_user_model()


@pytest.fixture
def owner_user(db):
    return User.objects.create_user(
        username="comm_owner",
        email="owner@kodinga.test",
        password="password123"
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="comm_admin",
        email="admin@kodinga.test",
        password="password123"
    )


@pytest.fixture
def mod_user(db):
    return User.objects.create_user(
        username="comm_mod",
        email="mod@kodinga.test",
        password="password123"
    )


@pytest.fixture
def member_user(db):
    return User.objects.create_user(
        username="comm_member",
        email="member@kodinga.test",
        password="password123"
    )


@pytest.fixture
def test_community(db, owner_user, admin_user, mod_user, member_user):
    community = Community.objects.create(
        name="Test Permissions Space",
        slug="test-permissions-space",
        owner=owner_user,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )
    CommunitySettings.objects.create(community=community)

    # Add memberships
    CommunityMember.objects.create(
        community=community,
        user=admin_user,
        role=CommunityRole.ADMIN,
        status=MembershipStatus.ACTIVE
    )
    CommunityMember.objects.create(
        community=community,
        user=mod_user,
        role=CommunityRole.MODERATOR,
        status=MembershipStatus.ACTIVE
    )
    CommunityMember.objects.create(
        community=community,
        user=member_user,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE
    )
    return community


@pytest.mark.django_db
class TestRolePermissions:
    def test_default_permissions_behavior(self, test_community, owner_user, admin_user, mod_user, member_user):
        # Owner has all permissions
        assert has_community_permission(owner_user, test_community, 'can_create_posts') is True
        assert has_community_permission(owner_user, test_community, 'can_manage_settings') is True
        assert has_community_permission(owner_user, test_community, 'can_create_courses') is True

        # Admin has default admin permissions
        assert has_community_permission(admin_user, test_community, 'can_create_posts') is True
        assert has_community_permission(admin_user, test_community, 'can_manage_settings') is True
        assert has_community_permission(admin_user, test_community, 'can_create_events') is True

        # Moderator has default mod permissions
        assert has_community_permission(mod_user, test_community, 'can_create_posts') is True
        assert has_community_permission(mod_user, test_community, 'can_pin_posts') is True
        assert has_community_permission(mod_user, test_community, 'can_manage_settings') is False
        assert has_community_permission(mod_user, test_community, 'can_create_courses') is False

        # Member has default member permissions
        assert has_community_permission(member_user, test_community, 'can_create_posts') is True
        assert has_community_permission(member_user, test_community, 'can_pin_posts') is False
        assert has_community_permission(member_user, test_community, 'can_create_events') is False
        assert has_community_permission(member_user, test_community, 'can_manage_settings') is False

    def test_owner_can_expand_member_permissions(self, test_community, owner_user, member_user):
        # By default, member cannot create events
        assert has_community_permission(member_user, test_community, 'can_create_events') is False

        # Owner grants can_create_events to member
        CommunityService.update_settings(
            community=test_community,
            user=owner_user,
            data={
                'role_permissions': {
                    'member': {
                        'can_create_events': True,
                    }
                }
            }
        )

        test_community.settings.refresh_from_db()
        assert has_community_permission(member_user, test_community, 'can_create_events') is True
        # Other member permissions remain as default
        assert has_community_permission(member_user, test_community, 'can_manage_settings') is False

    def test_owner_can_restrict_moderator_permissions(self, test_community, owner_user, mod_user):
        # By default, moderator can pin posts
        assert has_community_permission(mod_user, test_community, 'can_pin_posts') is True

        # Owner restricts can_pin_posts for moderator
        CommunityService.update_settings(
            community=test_community,
            user=owner_user,
            data={
                'role_permissions': {
                    'moderator': {
                        'can_pin_posts': False,
                    }
                }
            }
        )

        test_community.settings.refresh_from_db()
        assert has_community_permission(mod_user, test_community, 'can_pin_posts') is False

    def test_admin_cannot_update_role_permissions(self, test_community, admin_user):
        # An admin (non-owner) attempting to update role_permissions gets PermissionDenied
        with pytest.raises(PermissionDenied):
            CommunityService.update_settings(
                community=test_community,
                user=admin_user,
                data={
                    'role_permissions': {
                        'member': {
                            'can_create_events': True,
                        }
                    }
                }
            )

    def test_owner_permissions_cannot_be_restricted(self, test_community, owner_user):
        # Even if someone attempts to save role_permissions for owner, owner still has True for everything
        assert test_community.settings.has_permission('owner', 'can_create_posts') is True
        assert test_community.settings.has_permission('owner', 'can_manage_settings') is True

    def test_api_owner_patch_role_permissions(self, test_community, owner_user):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=owner_user)

        response = client.patch(
            f"/api/v1/communities/{test_community.slug}/settings/",
            data={
                "role_permissions": {
                    "member": {
                        "can_create_events": True
                    }
                }
            },
            format="json"
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert "all_role_permissions" in data
        assert data["all_role_permissions"]["member"]["can_create_events"] is True

    def test_api_admin_patch_role_permissions_forbidden(self, test_community, admin_user):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=admin_user)

        response = client.patch(
            f"/api/v1/communities/{test_community.slug}/settings/",
            data={
                "role_permissions": {
                    "member": {
                        "can_create_events": True
                    }
                }
            },
            format="json"
        )
        assert response.status_code == 403

    def test_can_start_live_permission_and_enforcement(self, test_community, owner_user, member_user):
        from apps.events.services.event_service import EventService
        from apps.events.models.event import EventFormat, EventStatus

        # 1. Owner always has can_start_live permission
        assert has_community_permission(owner_user, test_community, 'can_start_live') is True

        # 2. Regular member does not have can_start_live by default
        assert has_community_permission(member_user, test_community, 'can_start_live') is False

        # 3. Attempting to create a live stream without permission raises PermissionDenied
        with pytest.raises(PermissionDenied):
            EventService.create_event(
                actor_user=member_user,
                community=test_community,
                data={
                    "title": "Live Interdit",
                    "event_type": "live_stream",
                    "format": EventFormat.LIVEKIT,
                    "status": EventStatus.LIVE,
                    "start_time": "2026-10-27T10:00:00Z",
                    "end_time": "2026-10-27T12:00:00Z",
                }
            )

        # 4. Owner grants can_start_live to member role
        CommunityService.update_settings(
            community=test_community,
            user=owner_user,
            data={
                'role_permissions': {
                    'member': {
                        'can_start_live': True,
                    }
                }
            }
        )

        test_community.settings.refresh_from_db()
        assert has_community_permission(member_user, test_community, 'can_start_live') is True

        # 5. Now member can create live stream
        live_event = EventService.create_event(
            actor_user=member_user,
            community=test_community,
            data={
                "title": "Live Autorisé par Owner",
                "event_type": "live_stream",
                "format": EventFormat.LIVEKIT,
                "status": EventStatus.LIVE,
                "start_time": "2026-10-27T10:00:00Z",
                "end_time": "2026-10-27T12:00:00Z",
            }
        )
        assert live_event.status == EventStatus.LIVE
        assert live_event.host == member_user
