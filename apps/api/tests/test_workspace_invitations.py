import hashlib
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
from apps.memberships.tasks import expire_outdated_invitations_task


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def workspace_owner(db):
    return User.objects.create_user(
        email="owner@workspace.com",
        username="ws_owner",
        password="SecurePassword123!",
        first_name="Owner",
        last_name="Workspace",
    )


@pytest.fixture
def workspace_admin(db):
    return User.objects.create_user(
        email="admin@workspace.com",
        username="ws_admin",
        password="SecurePassword123!",
        first_name="Admin",
        last_name="Workspace",
    )


@pytest.fixture
def workspace_member(db):
    return User.objects.create_user(
        email="member@workspace.com",
        username="ws_member",
        password="SecurePassword123!",
        first_name="Regular",
        last_name="Member",
    )


@pytest.fixture
def invited_user(db):
    return User.objects.create_user(
        email="invitee@collab.com",
        username="invitee_collab",
        password="SecurePassword123!",
        first_name="Invited",
        last_name="Collab",
    )


@pytest.fixture
def stranger_user(db):
    return User.objects.create_user(
        email="stranger@other.com",
        username="stranger",
        password="SecurePassword123!",
        first_name="Stranger",
        last_name="Person",
    )


@pytest.fixture
def workspace(db, workspace_owner, workspace_admin, workspace_member):
    comm = Community.objects.create(
        name="Tech Innovators Workspace",
        slug="tech-innovators",
        owner=workspace_owner,
        privacy_type=CommunityPrivacy.PRIVATE,
    )
    CommunitySettings.objects.create(community=comm, allow_member_invites=True)

    # Owner is admin/owner
    CommunityMember.objects.create(
        community=comm,
        user=workspace_owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    # Admin
    CommunityMember.objects.create(
        community=comm,
        user=workspace_admin,
        role=CommunityRole.ADMIN,
        status=MembershipStatus.ACTIVE,
    )
    # Regular member
    CommunityMember.objects.create(
        community=comm,
        user=workspace_member,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.mark.django_db
class TestWorkspaceInvitations:
    def test_admin_creates_invitation_success(
        self, api_client, workspace, workspace_admin
    ):
        api_client.force_authenticate(user=workspace_admin)
        payload = {
            "email": "developer@partner.com",
            "role": "editor",
            "expires_in_days": 5,
        }

        res = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/",
            payload,
            format="json",
        )

        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()["data"]
        assert data["email"] == "developer@partner.com"
        assert data["role"] in ["editor", "moderator"]
        assert data["status"] == "pending"
        raw_token = data.get("raw_token")
        assert raw_token is not None
        assert len(raw_token) > 20

        # Verify DB hashing: raw_token must NOT be in DB
        invitation = CommunityInvitation.objects.get(id=data["id"])
        expected_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        assert invitation.token_hash == expected_hash
        assert raw_token not in (invitation.token_hash or "")

    def test_non_admin_cannot_create_invitation(
        self, api_client, workspace, workspace_member
    ):
        api_client.force_authenticate(user=workspace_member)
        payload = {
            "email": "hacker@test.com",
            "role": "editor",
        }

        res = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/",
            payload,
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_duplicate_pending_invitation_conflict(
        self, api_client, workspace, workspace_admin
    ):
        api_client.force_authenticate(user=workspace_admin)
        payload = {
            "email": "repeat@collab.com",
            "role": "viewer",
        }

        res1 = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/",
            payload,
            format="json",
        )
        assert res1.status_code == status.HTTP_201_CREATED

        # Duplicate pending invitation
        res2 = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/",
            payload,
            format="json",
        )
        assert res2.status_code == status.HTTP_409_CONFLICT

    def test_cannot_invite_existing_active_member(
        self, api_client, workspace, workspace_admin, workspace_member
    ):
        api_client.force_authenticate(user=workspace_admin)
        payload = {
            "email": workspace_member.email,
            "role": "editor",
        }

        res = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/",
            payload,
            format="json",
        )
        assert res.status_code == status.HTTP_409_CONFLICT

    def test_public_invitation_detail_lookup(
        self, api_client, workspace, workspace_admin
    ):
        # Create invitation
        api_client.force_authenticate(user=workspace_admin)
        res_create = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/",
            {"email": "secretcollab@example.com", "role": "editor"},
            format="json",
        )
        assert res_create.status_code == status.HTTP_201_CREATED
        raw_token = res_create.json()["data"]["raw_token"]

        # Public lookup unauthenticated
        api_client.force_authenticate(user=None)
        res_public = api_client.get(f"/api/v1/invitations/{raw_token}/")
        assert res_public.status_code == status.HTTP_200_OK

        pub_data = res_public.json()["data"]
        assert pub_data["workspace_name"] == workspace.name
        assert pub_data["workspace_slug"] == workspace.slug
        assert pub_data["role"] in ["editor", "moderator"]
        assert pub_data["is_valid"] is True
        assert "@" in pub_data["masked_email"]

        # Unknown token returns 404
        res_404 = api_client.get("/api/v1/invitations/invalid-nonexistent-token/")
        assert res_404.status_code == status.HTTP_404_NOT_FOUND

    def test_accept_invitation_success(
        self, api_client, workspace, workspace_admin, invited_user
    ):
        # Create invitation for invited_user.email
        api_client.force_authenticate(user=workspace_admin)
        res_create = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/",
            {"email": invited_user.email, "role": "editor"},
            format="json",
        )
        raw_token = res_create.json()["data"]["raw_token"]
        invitation_id = res_create.json()["data"]["id"]

        # Invited user accepts
        api_client.force_authenticate(user=invited_user)
        res_accept = api_client.post(
            f"/api/v1/invitations/{raw_token}/accept/",
            format="json",
        )
        assert res_accept.status_code == status.HTTP_200_OK

        # Verify member created
        member = CommunityMember.objects.get(community=workspace, user=invited_user)
        assert member.status == MembershipStatus.ACTIVE
        assert member.role == CommunityRole.MODERATOR  # 'editor' maps to moderator

        # Verify invitation status is accepted
        invitation = CommunityInvitation.objects.get(id=invitation_id)
        assert invitation.status == InvitationStatus.ACCEPTED
        assert invitation.accepted_at is not None

        # Replay attempt returns 409 Conflict
        res_replay = api_client.post(
            f"/api/v1/invitations/{raw_token}/accept/",
            format="json",
        )
        assert res_replay.status_code == status.HTTP_409_CONFLICT

    def test_legacy_accept_invitation_with_email_success(
        self, api_client, workspace, workspace_admin, invited_user
    ):
        # Create invitation for invited_user.email
        api_client.force_authenticate(user=workspace_admin)
        res_create = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/",
            {"email": invited_user.email, "role": "viewer"},
            format="json",
        )
        raw_token = res_create.json()["data"]["raw_token"]

        # Invited user accepts via legacy /api/v1/invitations/accept/
        api_client.force_authenticate(user=invited_user)
        res_accept = api_client.post(
            "/api/v1/invitations/accept/",
            {"invite_code": raw_token},
            format="json",
        )
        assert res_accept.status_code == status.HTTP_200_OK
        assert res_accept.json()["data"]["role"] == CommunityRole.MEMBER
        assert res_accept.json()["data"]["status"] == MembershipStatus.ACTIVE

    def test_accept_invitation_wrong_email_forbidden(
        self, api_client, workspace, workspace_admin, stranger_user
    ):
        # Create invitation for specific email
        api_client.force_authenticate(user=workspace_admin)
        res_create = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/",
            {"email": "target@domain.com", "role": "editor"},
            format="json",
        )
        raw_token = res_create.json()["data"]["raw_token"]

        # Stranger user with different email tries to accept
        api_client.force_authenticate(user=stranger_user)
        res_accept = api_client.post(
            f"/api/v1/invitations/{raw_token}/accept/",
            format="json",
        )
        assert res_accept.status_code == status.HTTP_403_FORBIDDEN

    def test_accept_expired_invitation_rejected(
        self, api_client, workspace, workspace_admin, invited_user
    ):
        api_client.force_authenticate(user=workspace_admin)
        res_create = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/",
            {"email": invited_user.email, "role": "viewer"},
            format="json",
        )
        raw_token = res_create.json()["data"]["raw_token"]
        invitation_id = res_create.json()["data"]["id"]

        # Manually expire the invitation
        CommunityInvitation.objects.filter(id=invitation_id).update(
            expires_at=timezone.now() - timedelta(days=1)
        )

        api_client.force_authenticate(user=invited_user)
        res_accept = api_client.post(
            f"/api/v1/invitations/{raw_token}/accept/",
            format="json",
        )
        assert res_accept.status_code == status.HTTP_400_BAD_REQUEST

    def test_accept_revoked_invitation_rejected(
        self, api_client, workspace, workspace_admin, invited_user
    ):
        api_client.force_authenticate(user=workspace_admin)
        res_create = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/",
            {"email": invited_user.email, "role": "viewer"},
            format="json",
        )
        raw_token = res_create.json()["data"]["raw_token"]
        invitation_id = res_create.json()["data"]["id"]

        # Admin revokes the invitation
        res_del = api_client.delete(
            f"/api/v1/workspaces/{workspace.slug}/invitations/{invitation_id}/"
        )
        assert res_del.status_code == status.HTTP_200_OK

        # Invitee tries to accept revoked invitation
        api_client.force_authenticate(user=invited_user)
        res_accept = api_client.post(
            f"/api/v1/invitations/{raw_token}/accept/",
            format="json",
        )
        assert res_accept.status_code == status.HTTP_400_BAD_REQUEST

    def test_admin_resend_invitation(self, api_client, workspace, workspace_admin):
        api_client.force_authenticate(user=workspace_admin)
        res_create = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/",
            {"email": "renew@collab.com", "role": "editor"},
            format="json",
        )
        invitation_id = res_create.json()["data"]["id"]
        old_hash = CommunityInvitation.objects.get(id=invitation_id).token_hash

        # Resend
        res_resend = api_client.post(
            f"/api/v1/workspaces/{workspace.slug}/invitations/{invitation_id}/resend/",
            format="json",
        )
        assert res_resend.status_code == status.HTTP_200_OK

        invitation_after = CommunityInvitation.objects.get(id=invitation_id)
        assert invitation_after.token_hash != old_hash
        assert invitation_after.status == InvitationStatus.PENDING

    def test_last_admin_protection(
        self, api_client, workspace, workspace_owner, workspace_admin
    ):
        api_client.force_authenticate(user=workspace_owner)

        # First, demote workspace_admin so only owner remains as admin
        res_demote_admin = api_client.patch(
            f"/api/v1/workspaces/{workspace.slug}/members/{workspace_admin.id}/",
            {"role": "viewer"},
            format="json",
        )
        assert res_demote_admin.status_code == status.HTTP_200_OK

        # Now only workspace_owner is admin. Try to demote workspace_owner
        res_demote_last = api_client.patch(
            f"/api/v1/workspaces/{workspace.slug}/members/{workspace_owner.id}/",
            {"role": "viewer"},
            format="json",
        )
        assert res_demote_last.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Try to delete/remove the last admin
        res_delete_last = api_client.delete(
            f"/api/v1/workspaces/{workspace.slug}/members/{workspace_owner.id}/"
        )
        assert res_delete_last.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_celery_expire_outdated_invitations_task(self, workspace, workspace_admin):
        # Create one outdated and one active invitation
        now = timezone.now()
        outdated_invite = CommunityInvitation.objects.create(
            community=workspace,
            invited_by=workspace_admin,
            email="expired@collab.com",
            role=CommunityRole.MEMBER,
            status=InvitationStatus.PENDING,
            token_hash="hash_outdated_123",
            expires_at=now - timedelta(hours=2),
        )
        fresh_invite = CommunityInvitation.objects.create(
            community=workspace,
            invited_by=workspace_admin,
            email="active@collab.com",
            role=CommunityRole.MEMBER,
            status=InvitationStatus.PENDING,
            token_hash="hash_fresh_456",
            expires_at=now + timedelta(days=3),
        )

        expired_result = expire_outdated_invitations_task()
        assert expired_result["expired_count"] >= 1

        outdated_invite.refresh_from_db()
        fresh_invite.refresh_from_db()
        assert outdated_invite.status == InvitationStatus.EXPIRED
        assert fresh_invite.status == InvitationStatus.PENDING

    def test_banned_member_cannot_accept_invitation_or_shareable_link(
        self, api_client, workspace, workspace_admin, stranger_user
    ):
        # 1. Ban the stranger_user in this workspace
        member = CommunityMember.objects.create(
            community=workspace,
            user=stranger_user,
            role=CommunityRole.MEMBER,
            status=MembershipStatus.BANNED,
        )

        # 2. Admin generates a shareable invitation link
        api_client.force_authenticate(user=workspace_admin)
        res_link = api_client.post(
            f"/api/v1/communities/{workspace.slug}/invitations/share-link/"
        )
        assert res_link.status_code == status.HTTP_200_OK
        token = res_link.json()["data"]["token"]

        # 3. Banned user attempts to accept the shareable invitation
        api_client.force_authenticate(user=stranger_user)
        res_accept = api_client.post(
            f"/api/v1/invitations/{token}/accept/",
            format="json",
        )
        assert res_accept.status_code == status.HTTP_403_FORBIDDEN
        assert "banni" in res_accept.json().get("message", "").lower()

        # 4. Verify user status remains BANNED (never reactivated to ACTIVE)
        member.refresh_from_db()
        assert member.status == MembershipStatus.BANNED

    def test_shareable_link_cannot_be_declined_by_any_user(
        self, api_client, workspace, workspace_admin, stranger_user, invited_user
    ):
        # 1. Admin generates a shareable link
        api_client.force_authenticate(user=workspace_admin)
        res_link = api_client.post(
            f"/api/v1/communities/{workspace.slug}/invitations/share-link/"
        )
        assert res_link.status_code == status.HTTP_200_OK
        token = res_link.json()["data"]["token"]

        invitation = CommunityInvitation.objects.get(invite_code=token)
        assert invitation.status == InvitationStatus.PENDING

        # 2. Stranger user attempts to decline this shareable link
        api_client.force_authenticate(user=stranger_user)
        res_decline = api_client.post(
            f"/api/v1/invitations/{token}/decline/",
            format="json",
        )
        assert res_decline.status_code == status.HTTP_400_BAD_REQUEST
        error_code = res_decline.json().get("code") or res_decline.json().get("error", {}).get("code")
        assert error_code == "shareable_link_cannot_be_declined"

        # 3. Verify link is STILL PENDING and valid for everyone
        invitation.refresh_from_db()
        assert invitation.status == InvitationStatus.PENDING
        assert invitation.is_valid is True

        # 4. Another user can still join using the link without any issue
        api_client.force_authenticate(user=invited_user)
        res_accept = api_client.post(
            f"/api/v1/invitations/{token}/accept/",
            format="json",
        )
        assert res_accept.status_code == status.HTTP_200_OK
        new_member = CommunityMember.objects.get(community=workspace, user=invited_user)
        assert new_member.status == MembershipStatus.ACTIVE

    def test_already_active_member_accepting_shareable_link_does_not_close_it(
        self, api_client, workspace, workspace_admin, workspace_member, stranger_user
    ):
        # 1. Admin generates a shareable link (unlimited uses, max_uses=0)
        api_client.force_authenticate(user=workspace_admin)
        res_link = api_client.post(
            f"/api/v1/communities/{workspace.slug}/invitations/share-link/"
        )
        assert res_link.status_code == status.HTTP_200_OK
        token = res_link.json()["data"]["token"]

        invitation = CommunityInvitation.objects.get(invite_code=token)
        assert invitation.status == InvitationStatus.PENDING
        assert invitation.uses_count == 0

        # 2. Already active member accepts the shareable link
        api_client.force_authenticate(user=workspace_member)
        res_accept_member = api_client.post(
            f"/api/v1/invitations/{token}/accept/",
            format="json",
        )
        assert res_accept_member.status_code == status.HTTP_200_OK

        # 3. Verify link was NOT closed and uses_count was NOT incremented
        invitation.refresh_from_db()
        assert invitation.status == InvitationStatus.PENDING
        assert invitation.uses_count == 0
        assert invitation.is_valid is True

        # 4. A new member uses the shareable link to join
        api_client.force_authenticate(user=stranger_user)
        res_accept_stranger = api_client.post(
            f"/api/v1/invitations/{token}/accept/",
            format="json",
        )
        assert res_accept_stranger.status_code == status.HTTP_200_OK

        invitation.refresh_from_db()
        # For unlimited link, status remains PENDING and uses_count is incremented by 1
        assert invitation.status == InvitationStatus.PENDING
        assert invitation.uses_count == 1
        assert invitation.is_valid is True
