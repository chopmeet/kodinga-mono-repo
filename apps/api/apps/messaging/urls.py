from django.urls import path

from apps.messaging.views import (
    ConversationDetailView,
    ConversationListView,
    ConversationMarkReadView,
    ConversationMessagesView,
    MessageDetailView,
)

app_name = "messaging"

urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="conversation_list"),
    path(
        "conversations/<uuid:conversation_id>/",
        ConversationDetailView.as_view(),
        name="conversation_detail",
    ),
    path(
        "conversations/<uuid:conversation_id>/messages/",
        ConversationMessagesView.as_view(),
        name="conversation_messages",
    ),
    path(
        "conversations/<uuid:conversation_id>/read/",
        ConversationMarkReadView.as_view(),
        name="conversation_mark_read",
    ),
    path("messages/<uuid:message_id>/", MessageDetailView.as_view(), name="message_detail"),
]
