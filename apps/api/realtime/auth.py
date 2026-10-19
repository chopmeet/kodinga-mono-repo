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


class WebSocketTicketAuthMiddleware:
    """
    ASGI middleware for authenticating WebSocket connections via single-use tickets.
    Extracts 'ticket' query parameter from the connection handshake URL.
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

                if ticket_list and len(ticket_list) > 0:
                    ticket = ticket_list[0]
                    user = await sync_to_async(
                        RealtimeAuthService.validate_and_consume_ticket
                    )(ticket)
                    scope["user"] = user if user else AnonymousUser()
                else:
                    scope["user"] = AnonymousUser()

        return await self.inner(scope, receive, send)


def WebSocketTicketAuthMiddlewareStack(inner):
    """
    Helper function wrapping an ASGI application with ticket auth middleware.
    """
    return WebSocketTicketAuthMiddleware(inner)
