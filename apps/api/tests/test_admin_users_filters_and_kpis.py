from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import Community


@pytest.fixture
def superadmin_user(db):
    user = User.objects.create_user(
        username="superadmin_test",
        email="superadmin@kodinga.com",
        password="Password123!",
    )
    user.is_superuser = True
    user.is_staff = True
    user.is_superadmin = True
    user.mark_email_verified()
    user.save()
    return user


@pytest.fixture
def regular_member(db):
    user = User.objects.create_user(
        username="regular_member",
        email="member@kodinga.com",
        password="Password123!",
    )
    # Registered 15 days ago
    User.objects.filter(id=user.id).update(
        date_joined=timezone.now() - timedelta(days=15),
        created_at=timezone.now() - timedelta(days=15),
    )
    user.refresh_from_db()
    return user


@pytest.fixture
def community_creator(db):
    user = User.objects.create_user(
        username="community_creator",
        email="creator@kodinga.com",
        password="Password123!",
    )
    # Registered 5 days ago (in 7d window)
    User.objects.filter(id=user.id).update(
        date_joined=timezone.now() - timedelta(days=5),
        created_at=timezone.now() - timedelta(days=5),
    )
    user.refresh_from_db()

    # Create community owned by this user
    cat = CommunityCategory.objects.create(name="AI Tech", slug="ai-tech-cat")
    Community.objects.create(
        name="AI Builders Space",
        slug="ai-builders",
        owner=user,
        category=cat,
    )
    return user


@pytest.fixture
def unverified_user(db):
    user = User.objects.create_user(
        username="unverified_john",
        email="unverified@kodinga.com",
        password="Password123!",
    )
    # Registered 45 days ago (in 90d window, not in 30d window)
    User.objects.filter(id=user.id).update(
        date_joined=timezone.now() - timedelta(days=45),
        created_at=timezone.now() - timedelta(days=45),
        email_verified_at=None,
    )
    user.refresh_from_db()
    return user


@pytest.mark.django_db
class TestAdminUsersFiltersAndKPIs:
    def test_kpis_endpoint_returns_creators_count(
        self, superadmin_user, community_creator, regular_member, unverified_user
    ):
        """KPI endpoint must calculate exact count of community creators, members, and date buckets."""
        client = APIClient()
        client.force_authenticate(user=superadmin_user)

        response = client.get("/api/v1/admin/users/kpis/")
        assert response.status_code == status.HTTP_200_OK

        data = response.json()["data"]
        # Exactly 1 creator who owns a community
        assert data["creators_count"] == 1
        # Members (regular_member + unverified_user)
        assert data["members_count"] == 2
        # Admins (superadmin_user)
        assert data["admins_count"] == 1
        # Total users
        assert data["total_users"] == 4
        # New users in 7d (creator registered 5 days ago + superadmin today)
        assert data["new_users_7d"] >= 2
        # New users in 30d (includes regular_member 15 days ago)
        assert data["new_users_30d"] >= 3
        # New users in 90d (includes unverified_user 45 days ago)
        assert data["new_users_90d"] >= 4

    def test_filter_users_by_role_creator(
        self, superadmin_user, community_creator, regular_member
    ):
        """Filtering by role=creator only returns users who created at least 1 community."""
        client = APIClient()
        client.force_authenticate(user=superadmin_user)

        resp = client.get("/api/v1/users/?role=creator")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json()["results"]
        assert len(results) == 1
        assert results[0]["username"] == "community_creator"
        assert results[0]["is_creator"] is True
        assert results[0]["communities_created_count"] == 1
        assert results[0]["account_role"] == "creator"

    def test_filter_users_by_role_member(
        self, superadmin_user, community_creator, regular_member, unverified_user
    ):
        """Filtering by role=member only returns users without any community."""
        client = APIClient()
        client.force_authenticate(user=superadmin_user)

        resp = client.get("/api/v1/users/?role=member")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json()["results"]
        usernames = [u["username"] for u in results]
        assert "regular_member" in usernames
        assert "unverified_john" in usernames
        assert "community_creator" not in usernames
        assert "superadmin_test" not in usernames

    def test_filter_users_by_role_admin(
        self, superadmin_user, community_creator, regular_member
    ):
        """Filtering by role=admin returns superadmins."""
        client = APIClient()
        client.force_authenticate(user=superadmin_user)

        resp = client.get("/api/v1/users/?role=admin")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json()["results"]
        assert len(results) == 1
        assert results[0]["username"] == "superadmin_test"
        assert results[0]["account_role"] == "admin"

    def test_filter_users_by_date_period_7d_and_30d(
        self, superadmin_user, community_creator, regular_member, unverified_user
    ):
        """Period filters (7d, 30d, 90d) restrict users by creation date."""
        client = APIClient()
        client.force_authenticate(user=superadmin_user)

        # 7 days: creator (5d) + superadmin (0d)
        resp_7d = client.get("/api/v1/users/?period=7d")
        usernames_7d = [u["username"] for u in resp_7d.json()["results"]]
        assert "community_creator" in usernames_7d
        assert "regular_member" not in usernames_7d
        assert "unverified_john" not in usernames_7d

        # 30 days: adds regular_member (15d)
        resp_30d = client.get("/api/v1/users/?period=30d")
        usernames_30d = [u["username"] for u in resp_30d.json()["results"]]
        assert "community_creator" in usernames_30d
        assert "regular_member" in usernames_30d
        assert "unverified_john" not in usernames_30d

        # 90 days: adds unverified_john (45d)
        resp_90d = client.get("/api/v1/users/?period=90d")
        usernames_90d = [u["username"] for u in resp_90d.json()["results"]]
        assert "unverified_john" in usernames_90d

    def test_superadmin_can_manually_verify_user_email(
        self, superadmin_user, unverified_user, regular_member
    ):
        """Superadmin can verify a user's email directly via endpoint."""
        assert unverified_user.is_email_verified is False
        assert unverified_user.email_verified_at is None

        client = APIClient()
        # Non-admin cannot call this endpoint
        client.force_authenticate(user=regular_member)
        forbidden_resp = client.post(f"/api/v1/admin/users/{unverified_user.id}/verify-email/")
        assert forbidden_resp.status_code == status.HTTP_403_FORBIDDEN

        # Superadmin calls verify endpoint
        client.force_authenticate(user=superadmin_user)
        resp = client.post(f"/api/v1/admin/users/{unverified_user.id}/verify-email/")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()["data"]
        assert data["is_email_verified"] is True
        assert data["status"] == "active"

        # Verify DB persistence
        unverified_user.refresh_from_db()
        assert unverified_user.is_email_verified is True
        assert unverified_user.email_verified_at is not None
