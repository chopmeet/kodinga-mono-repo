import pytest
from rest_framework import status
from rest_framework.test import APIClient
from apps.accounts.models.user import User
from apps.communities.models.community import Community, CommunityPrivacy
from apps.communities.models.settings import CommunitySettings
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus
from apps.memberships.models.sanction import SanctionType


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_owner(db):
    return User.objects.create_user(
        email="owner2@kodinga.com",
        username="owner2",
        password="SecurePassword123!"
    )


@pytest.fixture
def user_alice(db):
    return User.objects.create_user(
        email="alice@kodinga.com",
        username="alice",
        password="SecurePassword123!"
    )


@pytest.fixture
def user_bob(db):
    return User.objects.create_user(
        email="bob@kodinga.com",
        username="bob",
        password="SecurePassword123!"
    )


@pytest.fixture
def test_community(db, user_owner):
    community = Community.objects.create(
        name="AI Engineers Hub",
        slug="ai-engineers",
        owner=user_owner,
        privacy_type=CommunityPrivacy.PUBLIC
    )
    CommunitySettings.objects.create(community=community, allow_member_invites=True)
    CommunityMember.objects.create(
        community=community,
        user=user_owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE
    )
    return community


@pytest.mark.django_db
class TestMembershipsAPI:

    def test_join_and_leave_community(self, api_client, user_alice, test_community):
        api_client.force_authenticate(user=user_alice)
        
        # Join
        res_join = api_client.post(f'/api/v1/communities/{test_community.slug}/join/')
        assert res_join.status_code == status.HTTP_200_OK
        assert res_join.json()['data']['status'] == MembershipStatus.ACTIVE
        assert res_join.json()['data']['role'] == CommunityRole.MEMBER

        test_community.refresh_from_db()
        assert test_community.members_count == 2

        # Check my membership
        res_me = api_client.get(f'/api/v1/communities/{test_community.slug}/members/me/')
        assert res_me.status_code == status.HTTP_200_OK
        assert res_me.json()['data']['user']['username'] == "alice"

        # Leave
        res_leave = api_client.post(f'/api/v1/communities/{test_community.slug}/leave/')
        assert res_leave.status_code == status.HTTP_200_OK

        test_community.refresh_from_db()
        assert test_community.members_count == 1

    def test_create_and_accept_invitation(self, api_client, user_owner, user_bob, test_community):
        # Owner creates invitation link
        api_client.force_authenticate(user=user_owner)
        res_invite = api_client.post(
            f'/api/v1/communities/{test_community.slug}/invitations/',
            {"role": CommunityRole.MODERATOR, "max_uses": 5, "expires_in_days": 3},
            format='json'
        )
        assert res_invite.status_code == status.HTTP_201_CREATED
        invite_code = res_invite.json()['data']['invite_code']

        # Bob accepts invitation
        api_client.force_authenticate(user=user_bob)
        res_accept = api_client.post(
            '/api/v1/invitations/accept/',
            {"invite_code": invite_code},
            format='json'
        )
        assert res_accept.status_code == status.HTTP_200_OK
        assert res_accept.json()['data']['role'] == CommunityRole.MODERATOR
        assert res_accept.json()['data']['status'] == MembershipStatus.ACTIVE

    def test_change_member_role_and_sanction(self, api_client, user_owner, user_alice, test_community):
        # Alice is a member
        alice_member = CommunityMember.objects.create(
            community=test_community,
            user=user_alice,
            role=CommunityRole.MEMBER,
            status=MembershipStatus.ACTIVE
        )

        # Owner promotes Alice to Admin
        api_client.force_authenticate(user=user_owner)
        patch_res = api_client.patch(
            f'/api/v1/communities/{test_community.slug}/members/{alice_member.id}/',
            {"role": CommunityRole.ADMIN, "custom_title": "Head of Operations"},
            format='json'
        )
        assert patch_res.status_code == status.HTTP_200_OK
        assert patch_res.json()['data']['role'] == CommunityRole.ADMIN
        assert patch_res.json()['data']['custom_title'] == "Head of Operations"

        # Sanction Alice (e.g., warning)
        sanction_payload = {
            "sanction_type": SanctionType.WARNING,
            "reason": "Spamming link in discussion"
        }
        sanction_res = api_client.post(
            f'/api/v1/communities/{test_community.slug}/members/{alice_member.id}/sanctions/',
            sanction_payload,
            format='json'
        )
        assert sanction_res.status_code == status.HTTP_201_CREATED
        assert sanction_res.json()['data']['sanction_type'] == SanctionType.WARNING
