"""
ASGI config for Kodinga platform.
Routes standard HTTP traffic to Django ASGI and WebSocket traffic to Channels ProtocolTypeRouter.
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Initialize Django ASGI application early to ensure AppRegistry is populated
django_http_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from realtime.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_http_app,
        "websocket": URLRouter(websocket_urlpatterns),
    }
)
