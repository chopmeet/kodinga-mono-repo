from django.urls import path

from apps.events.views.attendee import EventAttendeeListView, EventRSVPView
from apps.events.views.event import (
    CommunityEventDetailView,
    CommunityEventListView,
    PublicEventListView,
    UserAttendingEventListView,
)
from apps.events.views.live import (
    EventCalendarDownloadView,
    EventJoinLiveView,
    EventLiveKitWebhookView,
    EventReplayAttachView,
    EventStatusUpdateView,
)

app_name = "events"

urlpatterns = [
    # Global public events discovery
    path(
        "events/",
        PublicEventListView.as_view(),
        name="public-events-list",
    ),
    # User's registered events
    path(
        "events/my/",
        UserAttendingEventListView.as_view(),
        name="user-attending-events",
    ),
    # Community events
    path(
        "communities/<slug:slug>/events/",
        CommunityEventListView.as_view(),
        name="community-events-list",
    ),
    path(
        "communities/<slug:slug>/events/<str:event_id>/",
        CommunityEventDetailView.as_view(),
        name="community-events-detail",
    ),
    path(
        "communities/<slug:slug>/events/<str:event_id>/rsvp/",
        EventRSVPView.as_view(),
        name="community-events-rsvp",
    ),
    path(
        "communities/<slug:slug>/events/<str:event_id>/attendees/",
        EventAttendeeListView.as_view(),
        name="community-events-attendees",
    ),
    path(
        "communities/<slug:slug>/events/<str:event_id>/join-live/",
        EventJoinLiveView.as_view(),
        name="community-events-join-live",
    ),
    path(
        "communities/<slug:slug>/events/<str:event_id>/status/",
        EventStatusUpdateView.as_view(),
        name="community-events-status",
    ),
    path(
        "communities/<slug:slug>/events/<str:event_id>/replay/",
        EventReplayAttachView.as_view(),
        name="community-events-replay",
    ),
    path(
        "communities/<slug:slug>/events/<str:event_id>/calendar.ics",
        EventCalendarDownloadView.as_view(),
        name="community-events-calendar",
    ),
    # LiveKit real-time webhook
    path(
        "events/webhooks/livekit/",
        EventLiveKitWebhookView.as_view(),
        name="event-livekit-webhook",
    ),
]
