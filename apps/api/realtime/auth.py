import secrets
from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache

User = get_user_model()

TICKET_CACHE_PREFIX = "ws_ticket:"
TICKET_EXPIRY_SECONDS = 30


class RealtimeAuthService:
    """
    Manages short-lived, single-use authentication tickets for WebSockets.
    """

    @classmethod
    def create_ticket(cls, user) -> dict:
        ticket = secrets.token_urlsafe(32)
        cache_key = f"{TICKET_CACHE_PREFIX}{ticket}"
        cache.set(cache_key, str(user.id), timeout=TICKET_EXPIRY_SECONDS)
        return {
            "ticket": ticket,
            "expires_in": TICKET_EXPIRY_SECONDS,
        }

    @classmethod
    def validate_and_consume_ticket(cls, ticket: str):
        if not ticket or not isinstance(ticket, str):
            return None

        cache_key = f"{TICKET_CACHE_PREFIX}{ticket.strip()}"
        user_id = cache.get(cache_key)
        if not user_id:
            return None

        # One-time use: delete immediately upon validation
        cache.delete(cache_key)

        user = User.objects.filter(id=user_id, is_active=True).first()
        return user

    @classmethod
    def validate_jwt_token(cls, raw_token: str):
        if not raw_token or not isinstance(raw_token, str):
            return None
        try:
            from rest_framework_simplejwt.tokens import AccessToken

            validated_token = AccessToken(raw_token.strip())
            user_id = validated_token.get("user_id")
            if not user_id:
                return None
            return User.objects.filter(id=user_id, is_active=True).first()
        except Exception:
            return None


class WebSocketTicketAuthMiddleware:
    """
    ASGI middleware for authenticating WebSocket connections via single-use tickets
    or fallback JWT access tokens.
    Extracts 'ticket' or 'token' query parameters from the connection handshake URL.
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        # Only process websocket connections
        if scope["type"] == "websocket":
            # If user already set (e.g. In unit tests), keep it
            existing_user = scope.get("user")
            if not existing_user or isinstance(existing_user, AnonymousUser):
                query_string = scope.get("query_string", b"").decode("utf-8")
                query_params = parse_qs(query_string)
                ticket_list = query_params.get("ticket")
                token_list = query_params.get("token")

                user = None
                if ticket_list and len(ticket_list) > 0:
                    ticket = ticket_list[0]
                    user = await sync_to_async(
                        RealtimeAuthService.validate_and_consume_ticket
                    )(ticket)

                if not user and token_list and len(token_list) > 0:
                    raw_token = token_list[0]
                    user = await sync_to_async(
                        RealtimeAuthService.validate_jwt_token
                    )(raw_token)

                scope["user"] = user if user else AnonymousUser()

        return await self.inner(scope, receive, send)


def WebSocketTicketAuthMiddlewareStack(inner):
    """
    Helper function wrapping an ASGI application with ticket auth middleware.
    """
    return WebSocketTicketAuthMiddleware(inner)
