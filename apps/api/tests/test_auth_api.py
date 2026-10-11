import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.token import AuthToken
from apps.accounts.models.user import User
from common.utils.tokens import hash_token


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="dev_api@kodinga.com",
        username="devapi",
        password="TestPassword123!",
        first_name="Marc",
        last_name="Dev",
    )


@pytest.fixture
def auth_client(api_client, user):
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return api_client, user, refresh


@pytest.mark.django_db
class TestAuthAPIEndpoints:
    def test_register_endpoint_success(self, api_client):
        url = reverse("accounts:register")
        payload = {
            "email": "newuser@kodinga.com",
            "username": "newuser",
            "password": "Password123!",
            "first_name": "New",
            "last_name": "User",
            "terms_accepted": True,
        }
        response = api_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["success"] is True
        assert response.data["data"]["email"] == "newuser@kodinga.com"

    def test_register_endpoint_duplicate_email(self, api_client, user):
        url = reverse("accounts:register")
        payload = {
            "email": user.email,
            "username": "distinctuser",
            "password": "Password123!",
            "terms_accepted": True,
        }
        response = api_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["success"] is False

    def test_login_endpoint(self, api_client, user):
        url = reverse("accounts:login")
        payload = {
            "email": user.email,
            "password": "TestPassword123!",
            "device_name": "Pytest Client",
        }
        response = api_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert "access" in response.data["data"]
        assert "refresh" in response.data["data"]

    def test_token_refresh_endpoint(self, api_client, user):
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)

        url = reverse("accounts:token_refresh")
        response = api_client.post(url, {"refresh": str(refresh)}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data

    def test_email_verification_endpoint(self, api_client, user):
        from datetime import timedelta

        from django.utils import timezone

        raw_tok = "test_raw_token_xyz"
        AuthToken.objects.create(
            user=user,
            purpose=AuthToken.PURPOSE_EMAIL_VERIFICATION,
            token_hash=hash_token(raw_tok),
            expires_at=timezone.now() + timedelta(hours=24),
        )
        url = reverse("accounts:verify_email")
        response = api_client.post(url, {"token": raw_tok}, format="json")
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.is_email_verified is True

    def test_resend_verification_endpoint(self, api_client, user):
        url = reverse("accounts:resend_verification")
        response = api_client.post(url, {"email": user.email}, format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_password_reset_request_and_confirm(self, api_client, user):
        req_url = reverse("accounts:password_reset_request")
        response = api_client.post(req_url, {"email": user.email}, format="json")
        assert response.status_code == status.HTTP_200_OK

        token_obj = AuthToken.objects.filter(
            user=user, purpose=AuthToken.PURPOSE_PASSWORD_RESET
        ).first()
        raw_tok = "pwd_reset_raw_token_123"
        token_obj.token_hash = hash_token(raw_tok)
        token_obj.save()

        conf_url = reverse("accounts:password_reset_confirm")
        conf_response = api_client.post(
            conf_url,
            {
                "token": raw_tok,
                "new_password": "UpdatedPassword123!",
                "confirm_password": "UpdatedPassword123!",
            },
            format="json",
        )
        assert conf_response.status_code == status.HTTP_200_OK

    def test_change_password_endpoint(self, auth_client):
        client, user, _ = auth_client
        url = reverse("accounts:password_change")
        payload = {
            "current_password": "TestPassword123!",
            "new_password": "NewSecretPassword123!",
            "confirm_password": "NewSecretPassword123!",
        }
        response = client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password("NewSecretPassword123!")

    def test_user_me_endpoint(self, auth_client):
        client, user, _ = auth_client
        url = reverse("accounts:user_me")

        # GET me
        get_resp = client.get(url)
        assert get_resp.status_code == status.HTTP_200_OK
        assert get_resp.data["data"]["username"] == user.username

        # PATCH me
        patch_resp = client.patch(url, {"first_name": "UpdatedFirst"}, format="json")
        assert patch_resp.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.first_name == "UpdatedFirst"

    def test_sessions_list_and_revoke(self, auth_client):
        client, user, refresh = auth_client
        from apps.accounts.services.session import SessionService

        session = SessionService.create_session(
            user=user, refresh_token_str=str(refresh), device_name="Test Browser"
        )

        list_url = reverse("accounts:session_list")
        list_resp = client.get(list_url)
        assert list_resp.status_code == status.HTTP_200_OK
        assert len(list_resp.data["data"]) >= 1

        detail_url = reverse(
            "accounts:session_detail", kwargs={"session_id": session.id}
        )
        del_resp = client.delete(detail_url)
        assert del_resp.status_code == status.HTTP_204_NO_CONTENT

    def test_logout_and_logout_all(self, auth_client):
        client, user, refresh = auth_client

        # Logout
        logout_url = reverse("accounts:logout")
        resp = client.post(logout_url, {"refresh": str(refresh)}, format="json")
        assert resp.status_code == status.HTTP_200_OK

        # Logout all
        logout_all_url = reverse("accounts:logout_all")
        resp_all = client.post(logout_all_url, {}, format="json")
        assert resp_all.status_code == status.HTTP_200_OK

    def test_oauth_start_endpoint(self, api_client):
        url = reverse("accounts:oauth_start", kwargs={"provider": "google"})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert "url" in response.data["data"]
        assert "accounts.google.com" in response.data["data"]["url"]

    def test_login_with_username_endpoint(self, api_client, user):
        url = reverse("accounts:login")
        payload = {
            "username": user.username,
            "password": "TestPassword123!",
        }
        response = api_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert "access" in response.data["data"]
        assert "token" in response.data["data"]

    def test_email_verification_get_endpoint(self, api_client, user):
        from datetime import timedelta
        from django.utils import timezone

        raw_tok = "test_get_token_abc123"
        AuthToken.objects.create(
            user=user,
            purpose=AuthToken.PURPOSE_EMAIL_VERIFICATION,
            token_hash=hash_token(raw_tok),
            expires_at=timezone.now() + timedelta(hours=24),
        )
        url = f"{reverse('accounts:verify_email')}?token={raw_tok}"
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.is_email_verified is True

    def test_password_reset_nonexistent_email_creates_no_token(self, api_client):
        initial_token_count = AuthToken.objects.count()
        req_url = reverse("accounts:password_reset_request")
        response = api_client.post(req_url, {"email": "completely_unknown@kodinga.com"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert AuthToken.objects.count() == initial_token_count
