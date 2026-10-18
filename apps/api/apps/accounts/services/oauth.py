import logging
from typing import Any
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models.oauth import OAuthIdentity
from apps.accounts.models.user import User
from apps.accounts.services.security import AccountSecurityService
from apps.accounts.services.session import SessionService
from common.exceptions.handler import ApplicationError
from common.utils.tokens import generate_secure_token

logger = logging.getLogger('kodinga.oauth')


class OAuthService:
    """
    Manages OAuth 2.0 authorization URLs and token exchange for Google and GitHub.
    """

    GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
    GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

    GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
    GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
    GITHUB_USERINFO_URL = "https://api.github.com/user"
    GITHUB_EMAILS_URL = "https://api.github.com/user/emails"

    @classmethod
    def get_authorization_url(cls, provider: str, redirect_uri: str = None) -> dict[str, str]:
        state = generate_secure_token(16)
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

        if provider == OAuthIdentity.PROVIDER_GOOGLE:
            client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
            cb_url = redirect_uri or f"{frontend_url}/auth/callback/google"
            params = {
                'client_id': client_id,
                'redirect_uri': cb_url,
                'response_type': 'code',
                'scope': 'openid email profile',
                'state': state,
                'access_type': 'offline',
                'prompt': 'select_account',
            }
            url = f"{cls.GOOGLE_AUTH_URL}?{urlencode(params)}"
            return {'url': url, 'state': state}

        elif provider == OAuthIdentity.PROVIDER_GITHUB:
            client_id = getattr(settings, 'GITHUB_CLIENT_ID', '')
            cb_url = redirect_uri or f"{frontend_url}/auth/callback/github"
            params = {
                'client_id': client_id,
                'redirect_uri': cb_url,
                'scope': 'read:user user:email',
                'state': state,
            }
            url = f"{cls.GITHUB_AUTH_URL}?{urlencode(params)}"
            return {'url': url, 'state': state}

        raise ApplicationError(message="Unsupported OAuth provider.", code="invalid_provider")

    @classmethod
    def exchange_google_code(cls, code: str, redirect_uri: str = None) -> dict[str, Any]:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        cb_url = redirect_uri or f"{frontend_url}/auth/callback/google"
        client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
        client_secret = getattr(settings, 'GOOGLE_CLIENT_SECRET', '')

        token_resp = requests.post(
            cls.GOOGLE_TOKEN_URL,
            data={
                'code': code,
                'client_id': client_id,
                'client_secret': client_secret,
                'redirect_uri': cb_url,
                'grant_type': 'authorization_code',
            },
            timeout=10
        )
        if not token_resp.ok:
            error_data = token_resp.text
            logger.error(f"Google token error: {error_data}")
            try:
                err_json = token_resp.json()
                err_desc = err_json.get('error_description') or err_json.get('error') or error_data
            except Exception:
                err_desc = error_data
            raise ApplicationError(f"Failed to exchange code with Google: {err_desc}", code="oauth_exchange_failed")

        tokens = token_resp.json()
        access_token = tokens.get('access_token')

        user_resp = requests.get(
            cls.GOOGLE_USERINFO_URL,
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10
        )
        if not user_resp.ok:
            raise ApplicationError("Failed to fetch Google profile.", code="oauth_userinfo_failed")

        userinfo = user_resp.json()
        return {
            'provider_user_id': str(userinfo.get('sub')),
            'email': userinfo.get('email', '').lower(),
            'first_name': userinfo.get('given_name', ''),
            'last_name': userinfo.get('family_name', ''),
            'email_verified': userinfo.get('email_verified', False),
        }

    @classmethod
    def exchange_github_code(cls, code: str, redirect_uri: str = None) -> dict[str, Any]:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        cb_url = redirect_uri or f"{frontend_url}/auth/callback/github"
        client_id = getattr(settings, 'GITHUB_CLIENT_ID', '')
        client_secret = getattr(settings, 'GITHUB_CLIENT_SECRET', '')

        token_resp = requests.post(
            cls.GITHUB_TOKEN_URL,
            data={
                'code': code,
                'client_id': client_id,
                'client_secret': client_secret,
                'redirect_uri': cb_url,
            },
            headers={'Accept': 'application/json'},
            timeout=10
        )
        if not token_resp.ok:
            logger.error(f"GitHub token error: {token_resp.text}")
            raise ApplicationError(f"Failed to exchange code with GitHub: {token_resp.text}", code="oauth_exchange_failed")

        tokens = token_resp.json()
        if 'error' in tokens:
            err_desc = tokens.get('error_description') or tokens.get('error')
            raise ApplicationError(f"GitHub rejected code: {err_desc}", code="oauth_exchange_failed")

        tokens = token_resp.json()
        access_token = tokens.get('access_token')
        if not access_token:
            raise ApplicationError("Invalid code or GitHub authorization rejected.", code="oauth_exchange_failed")

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/vnd.github.v3+json',
        }
        user_resp = requests.get(cls.GITHUB_USERINFO_URL, headers=headers, timeout=10)
        if not user_resp.ok:
            raise ApplicationError("Failed to fetch GitHub profile.", code="oauth_userinfo_failed")

        userinfo = user_resp.json()
        provider_user_id = str(userinfo.get('id'))
        name = userinfo.get('name') or userinfo.get('login') or ''
        parts = name.split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

        email = userinfo.get('email')
        email_verified = False
        if not email:
            emails_resp = requests.get(cls.GITHUB_EMAILS_URL, headers=headers, timeout=10)
            if emails_resp.ok:
                for entry in emails_resp.json():
                    if entry.get('primary') and entry.get('verified'):
                        email = entry.get('email')
                        email_verified = True
                        break

        return {
            'provider_user_id': provider_user_id,
            'email': (email or '').lower(),
            'first_name': first_name,
            'last_name': last_name,
            'username_suggestion': userinfo.get('login'),
            'email_verified': email_verified or bool(email),
        }

    @classmethod
    def handle_callback(
        cls,
        provider: str,
        code: str,
        redirect_uri: str = None,
        request=None
    ) -> dict[str, Any]:
        if provider == OAuthIdentity.PROVIDER_GOOGLE:
            profile = cls.exchange_google_code(code, redirect_uri)
        elif provider == OAuthIdentity.PROVIDER_GITHUB:
            profile = cls.exchange_github_code(code, redirect_uri)
        else:
            raise ApplicationError("Unsupported OAuth provider.", code="invalid_provider")

        provider_user_id = profile['provider_user_id']
        email = profile.get('email')

        with transaction.atomic():
            identity = OAuthIdentity.objects.filter(
                provider=provider,
                provider_user_id=provider_user_id
            ).select_related('user').first()

            if identity:
                user = identity.user
            else:
                if not email:
                    raise ApplicationError(
                        "Could not obtain a verified email address from provider.",
                        code="oauth_missing_email"
                    )

                user = User.objects.filter(email=email).first()
                if not user:
                    # Create new user
                    base_username = (profile.get('username_suggestion') or email.split('@')[0])[:40].lower()
                    username = base_username
                    counter = 1
                    while User.objects.filter(username=username).exists():
                        username = f"{base_username}_{counter}"
                        counter += 1

                    user = User.objects.create_user(
                        email=email,
                        username=username,
                        first_name=profile.get('first_name', ''),
                        last_name=profile.get('last_name', ''),
                        email_verified_at=timezone.now() if profile.get('email_verified') else None
                    )

                # Link OAuth Identity
                OAuthIdentity.objects.create(
                    user=user,
                    provider=provider,
                    provider_user_id=provider_user_id,
                    provider_email=email
                )

            if not user.is_active:
                raise ApplicationError("Account disabled.", code="account_inactive", status_code=403)

            # Issue JWT and Session
            refresh = RefreshToken.for_user(user)
            session = SessionService.create_session(
                user=user,
                refresh_token_str=str(refresh),
                request=request,
                device_name=f"OAuth {provider.title()}"
            )

            AccountSecurityService.log_event(
                event_type='oauth_login_success',
                user=user,
                request=request,
                metadata={'provider': provider, 'provider_user_id': provider_user_id}
            )

            return {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': user,
                'session_id': str(session.id),
            }
