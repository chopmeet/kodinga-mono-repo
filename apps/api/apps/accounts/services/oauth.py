import contextlib
import logging
from typing import Any
from urllib.parse import urlencode, urlparse

import requests
from apps.accounts.models.oauth import OAuthIdentity
from apps.accounts.models.user import User
from apps.accounts.services.security import AccountSecurityService
from apps.accounts.services.session import SessionService
from common.exceptions.handler import ApplicationError
from common.utils.tokens import generate_secure_token
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger('kodinga.oauth')


class OAuthService:
    """
    Manages OAuth 2.0 authorization URLs and token exchange for Google and GitHub.
    Guarantees strict redirect_uri consistency between authorization start and code exchange.
    """

    GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
    GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

    GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
    GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
    GITHUB_USERINFO_URL = "https://api.github.com/user"
    GITHUB_EMAILS_URL = "https://api.github.com/user/emails"

    @classmethod
    def _get_allowed_origins(cls) -> set[str]:
        origins: set[str] = set()
        candidates = [
            getattr(settings, 'FRONTEND_URL', ''),
            getattr(settings, 'BACKEND_URL', ''),
            getattr(settings, 'GOOGLE_REDIRECT_URI', ''),
            getattr(settings, 'GITHUB_REDIRECT_URI', ''),
        ]
        candidates.extend(getattr(settings, 'CORS_ALLOWED_ORIGINS', []) or [])
        candidates.extend(getattr(settings, 'OAUTH_ALLOWED_REDIRECT_URIS', []) or [])

        for item in candidates:
            if not item:
                continue
            parsed = urlparse(str(item).strip())
            if parsed.scheme and parsed.netloc:
                origins.add(f"{parsed.scheme.lower()}://{parsed.netloc.lower()}")
        if getattr(settings, 'DEBUG', False) or getattr(settings, 'IS_TESTING', False):
            origins.update({
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:8000",
                "http://127.0.0.1:8000",
            })
        return origins

    @classmethod
    def resolve_redirect_uri(
        cls,
        provider: str,
        redirect_uri: str | None = None,
        state: str | None = None,
    ) -> str:
        """
        Resolves and validates the exact redirect_uri for OAuth start and callback.
        1. If state is provided and redirect_uri is omitted, recovers the exact redirect_uri cached during /start/.
        2. Otherwise uses explicit redirect_uri if provided and valid.
        3. Otherwise falls back to GOOGLE_REDIRECT_URI / GITHUB_REDIRECT_URI, then FRONTEND_URL/auth/callback/<provider>.
        """
        cleaned = (redirect_uri or '').strip()

        if not cleaned and state:
            try:
                cached_uri = cache.get(f"oauth_redirect_uri:{state.strip()}")
                if cached_uri:
                    cleaned = str(cached_uri).strip()
            except Exception:
                pass

        if not cleaned:
            if provider == OAuthIdentity.PROVIDER_GOOGLE:
                configured = (getattr(settings, 'GOOGLE_REDIRECT_URI', '') or '').strip()
                if configured:
                    cleaned = configured
            elif provider == OAuthIdentity.PROVIDER_GITHUB:
                configured = (getattr(settings, 'GITHUB_REDIRECT_URI', '') or '').strip()
                if configured:
                    cleaned = configured

        if not cleaned:
            frontend_url = (getattr(settings, 'FRONTEND_URL', 'http://localhost:3000') or 'http://localhost:3000').strip().rstrip('/')
            cleaned = f"{frontend_url}/auth/callback/{provider}"

        parsed = urlparse(cleaned)
        if parsed.scheme.lower() not in ('http', 'https') or not parsed.netloc:
            raise ApplicationError(
                message="Invalid redirect_uri format. Must be an absolute http(s) URL.",
                code="invalid_redirect_uri",
                status_code=400,
            )

        origin = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"
        allowed_origins = cls._get_allowed_origins()
        if (
            allowed_origins
            and not getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', False)
            and origin not in allowed_origins
            and parsed.hostname not in ('localhost', '127.0.0.1')
        ):
            raise ApplicationError(
                message=f"Redirect URI origin '{origin}' is not in the allowed origins.",
                code="disallowed_redirect_uri",
                status_code=400,
            )

        return cleaned

    @classmethod
    def get_authorization_url(cls, provider: str, redirect_uri: str = None) -> dict[str, str]:
        if provider not in (OAuthIdentity.PROVIDER_GOOGLE, OAuthIdentity.PROVIDER_GITHUB):
            raise ApplicationError(message="Unsupported OAuth provider.", code="invalid_provider")

        state = generate_secure_token(16)
        cb_url = cls.resolve_redirect_uri(provider=provider, redirect_uri=redirect_uri)

        with contextlib.suppress(Exception):
            cache.set(f"oauth_redirect_uri:{state}", cb_url, timeout=900)

        if provider == OAuthIdentity.PROVIDER_GOOGLE:
            client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
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
            return {'url': url, 'state': state, 'redirect_uri': cb_url}

        elif provider == OAuthIdentity.PROVIDER_GITHUB:
            client_id = getattr(settings, 'GITHUB_CLIENT_ID', '')
            params = {
                'client_id': client_id,
                'redirect_uri': cb_url,
                'scope': 'read:user user:email',
                'state': state,
            }
            url = f"{cls.GITHUB_AUTH_URL}?{urlencode(params)}"
            return {'url': url, 'state': state, 'redirect_uri': cb_url}

        raise ApplicationError(message="Unsupported OAuth provider.", code="invalid_provider")

    @classmethod
    def exchange_google_code(
        cls,
        code: str,
        redirect_uri: str = None,
        state: str = None,
    ) -> dict[str, Any]:
        cb_url = cls.resolve_redirect_uri(
            provider=OAuthIdentity.PROVIDER_GOOGLE,
            redirect_uri=redirect_uri,
            state=state,
        )
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
            logger.error(f"Google token error (redirect_uri={cb_url}): {error_data}")
            err_code = "oauth_exchange_failed"
            try:
                err_json = token_resp.json()
                raw_err = err_json.get('error', '')
                err_desc = err_json.get('error_description') or raw_err or error_data
                if raw_err == 'redirect_uri_mismatch':
                    err_code = 'redirect_uri_mismatch'
                    err_desc = (
                        f"Erreur redirect_uri_mismatch : l'URI de redirection envoyée ('{cb_url}') "
                        "ne correspond pas à celle autorisée dans Google Cloud Console ou lors de l'initialisation OAuth."
                    )
            except Exception:
                err_desc = error_data
            raise ApplicationError(f"Failed to exchange code with Google: {err_desc}", code=err_code)

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
    def exchange_github_code(
        cls,
        code: str,
        redirect_uri: str = None,
        state: str = None,
    ) -> dict[str, Any]:
        cb_url = cls.resolve_redirect_uri(
            provider=OAuthIdentity.PROVIDER_GITHUB,
            redirect_uri=redirect_uri,
            state=state,
        )
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
        request=None,
        state: str = None,
    ) -> dict[str, Any]:
        if provider == OAuthIdentity.PROVIDER_GOOGLE:
            profile = cls.exchange_google_code(code, redirect_uri=redirect_uri, state=state)
        elif provider == OAuthIdentity.PROVIDER_GITHUB:
            profile = cls.exchange_github_code(code, redirect_uri=redirect_uri, state=state)
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
                if profile.get('email_verified') and not user.email_verified_at:
                    user.email_verified_at = timezone.now()
                    user.save(update_fields=['email_verified_at', 'updated_at'])
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
                elif profile.get('email_verified') and not user.email_verified_at:
                    user.email_verified_at = timezone.now()
                    user.save(update_fields=['email_verified_at', 'updated_at'])

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
