import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.communities.models.community import Community, CommunityPrivacy
from apps.communities.models.settings import CommunitySettings
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus
from apps.administration.models.audit import PlatformAuditLog
from apps.administration.models.setting import SystemSetting
from apps.analytics.models.metric import PlatformMetric, MetricType


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def superadmin_user(db):
    user = User.objects.create_user(
        email="superadmin@kodinga.com",
        username="superadmin",
        password="SuperPassword123!",
    )
    user.is_superadmin = True
    user.is_staff = True
    user.save()
    return user


@pytest.fixture
def regular_user(db):
    return User.objects.create_user(
        email="dev@kodinga.com",
        username="dev_regular",
        password="DevPassword123!",
    )


@pytest.fixture
def target_user(db):
    return User.objects.create_user(
        email="target@kodinga.com",
        username="target_user",
        password="TargetPassword123!",
    )


@pytest.fixture
def test_community(db, superadmin_user):
    community = Community.objects.create(
        name="Platform Governance Hub",
        slug="gov-hub",
        owner=superadmin_user,
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunitySettings.objects.create(community=community, allow_member_invites=True)
    CommunityMember.objects.create(
        community=community,
        user=superadmin_user,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    return community


@pytest.mark.django_db
class TestPhase10AnalyticsAPI:
    def test_analytics_overview_permissions(self, api_client, regular_user, superadmin_user):
        # 1. Unauthenticated -> 401
        res = api_client.get("/api/v1/analytics/overview/")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

        # 2. Regular user -> 403 Forbidden
        api_client.force_authenticate(user=regular_user)
        res_forbidden = api_client.get("/api/v1/analytics/overview/")
        assert res_forbidden.status_code == status.HTTP_403_FORBIDDEN

        # 3. Superadmin -> 200 OK
        api_client.force_authenticate(user=superadmin_user)
        res_admin = api_client.get("/api/v1/analytics/overview/")
        assert res_admin.status_code == status.HTTP_200_OK
        data = res_admin.json()["data"]
        assert "users" in data
        assert "communities" in data
        assert "content" in data
        assert "financial" in data

    def test_analytics_financial_and_engagement(self, api_client, superadmin_user):
        api_client.force_authenticate(user=superadmin_user)

        # Financial metrics
        res_fin = api_client.get("/api/v1/analytics/financial/")
        assert res_fin.status_code == status.HTTP_200_OK
        assert "revenue_by_currency" in res_fin.json()["data"]

        # Engagement metrics
        res_eng = api_client.get("/api/v1/analytics/engagement/")
        assert res_eng.status_code == status.HTTP_200_OK
        assert "dau" in res_eng.json()["data"]
        assert "mau" in res_eng.json()["data"]

    def test_record_and_list_platform_metrics(self, api_client, superadmin_user):
        api_client.force_authenticate(user=superadmin_user)

        payload = {
            "metric_name": "custom_course_completions",
            "metric_type": MetricType.ENGAGEMENT,
            "value": 42.00,
            "dimensions": {"cohort": "2026-Q1"},
        }
        res_post = api_client.post("/api/v1/analytics/metrics/", payload, format="json")
        assert res_post.status_code == status.HTTP_201_CREATED
        assert res_post.json()["data"]["metric_name"] == "custom_course_completions"

        # List metrics
        res_list = api_client.get("/api/v1/analytics/metrics/?metric_name=custom_course_completions")
        assert res_list.status_code == status.HTTP_200_OK
        assert len(res_list.json()["results"]) >= 1


@pytest.mark.django_db
class TestPhase10AdministrationAPI:
    def test_admin_dashboard_and_health(self, api_client, superadmin_user):
        api_client.force_authenticate(user=superadmin_user)

        # Dashboard
        res_dash = api_client.get("/api/v1/admin/dashboard/")
        assert res_dash.status_code == status.HTTP_200_OK
        assert "overview" in res_dash.json()["data"]
        assert "recent_audit_logs" in res_dash.json()["data"]

        # System Health
        res_health = api_client.get("/api/v1/admin/system/health/")
        assert res_health.status_code == status.HTTP_200_OK
        health_data = res_health.json()["data"]
        assert health_data["status"] in ["healthy", "degraded"]
        assert "database" in health_data["components"]
        assert "cache" in health_data["components"]

    def test_admin_system_settings_crud(self, api_client, superadmin_user):
        api_client.force_authenticate(user=superadmin_user)

        # Create or update setting
        payload = {
            "key": "maintenance_mode",
            "value": {"enabled": False, "notice": "Platform running smoothly"},
            "description": "Global maintenance switch",
            "is_public": True,
        }
        res_patch = api_client.patch("/api/v1/admin/settings/", payload, format="json")
        assert res_patch.status_code == status.HTTP_200_OK
        assert res_patch.json()["data"]["key"] == "maintenance_mode"

        # Get settings list
        res_list = api_client.get("/api/v1/admin/settings/")
        assert res_list.status_code == status.HTTP_200_OK
        keys = [s["key"] for s in res_list.json()["data"]]
        assert "maintenance_mode" in keys

        # Verify audit log was recorded
        assert PlatformAuditLog.objects.filter(action="system.update_setting").exists()

    def test_admin_toggle_user_status_and_superadmin(
        self, api_client, superadmin_user, target_user
    ):
        api_client.force_authenticate(user=superadmin_user)

        # 1. Suspend target user
        res_suspend = api_client.post(
            f"/api/v1/admin/users/{target_user.id}/toggle-status/",
            {"is_active": False, "reason": "Violation of community standards"},
            format="json",
        )
        assert res_suspend.status_code == status.HTTP_200_OK
        target_user.refresh_from_db()
        assert target_user.is_active is False

        # Verify audit log
        assert PlatformAuditLog.objects.filter(
            action="user.suspend", target_id=str(target_user.id)
        ).exists()

        # 2. Promote target user to superadmin
        res_promote = api_client.post(
            f"/api/v1/admin/users/{target_user.id}/toggle-admin/",
            {"is_superadmin": True},
            format="json",
        )
        assert res_promote.status_code == status.HTTP_200_OK
        target_user.refresh_from_db()
        assert target_user.is_superadmin is True

        # Verify audit log
        assert PlatformAuditLog.objects.filter(
            action="user.promote_superadmin", target_id=str(target_user.id)
        ).exists()

        # 3. Check audit logs endpoint
        res_audit = api_client.get(
            f"/api/v1/admin/audit-logs/?target_id={target_user.id}"
        )
        assert res_audit.status_code == status.HTTP_200_OK
        assert len(res_audit.json()["results"]) >= 2

    def test_user_list_admin_protection(self, api_client, regular_user, superadmin_user):
        # Unauthenticated -> 401
        res_unauth = api_client.get("/api/v1/users/")
        assert res_unauth.status_code == status.HTTP_401_UNAUTHORIZED

        # Regular user -> 403
        api_client.force_authenticate(user=regular_user)
        res_reg = api_client.get("/api/v1/users/")
        assert res_reg.status_code == status.HTTP_403_FORBIDDEN

        # Superadmin -> 200
        api_client.force_authenticate(user=superadmin_user)
        res_admin = api_client.get("/api/v1/users/")
        assert res_admin.status_code == status.HTTP_200_OK
        assert "results" in res_admin.json()

    def test_community_member_list_protection(
        self, api_client, regular_user, superadmin_user, test_community
    ):
        # 1. Unauthenticated -> 401
        res_unauth = api_client.get(f"/api/v1/communities/{test_community.slug}/members/")
        assert res_unauth.status_code == status.HTTP_401_UNAUTHORIZED

        # 2. Regular user (not owner/admin/mod) -> 403
        api_client.force_authenticate(user=regular_user)
        res_forbid = api_client.get(f"/api/v1/communities/{test_community.slug}/members/")
        assert res_forbid.status_code == status.HTTP_403_FORBIDDEN

        # 3. Community owner / platform superadmin -> 200
        api_client.force_authenticate(user=superadmin_user)
        res_owner = api_client.get(f"/api/v1/communities/{test_community.slug}/members/")
        assert res_owner.status_code == status.HTTP_200_OK
        assert len(res_owner.json()["results"]) >= 1
