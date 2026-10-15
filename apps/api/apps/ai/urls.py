from django.urls import path

from apps.ai.views import (
    AIAssistantAnalyzeCommunityView,
    AIAssistantChatView,
    AIAssistantConversationDetailView,
    AIAssistantConversationListView,
    AIAssistantPlanCommunityView,
    AIAssistantRecommendCommunitiesView,
    AIAssistantSuggestContentView,
    AIModerationAuditListView,
    AIProviderHealthView,
    AITranslateView,
    CommunityAISettingsView,
)

app_name = "ai"

urlpatterns = [
    # Multilingual Translation
    path("ai/translate/", AITranslateView.as_view(), name="ai-translate"),
    # Observability & Health
    path("admin/ai/health/", AIProviderHealthView.as_view(), name="ai-provider-health"),
    # Moderation Audit Logs
    path("ai/moderation/logs/", AIModerationAuditListView.as_view(), name="ai-moderation-logs"),
    # Community Owner AI Settings
    path(
        "communities/<slug:slug>/ai-settings/",
        CommunityAISettingsView.as_view(),
        name="community-ai-settings",
    ),
    # AI Community Assistant Endpoints
    path(
        "ai-assistant/recommend-communities/",
        AIAssistantRecommendCommunitiesView.as_view(),
        name="ai-assistant-recommend-communities",
    ),
    path(
        "ai-assistant/plan-community/",
        AIAssistantPlanCommunityView.as_view(),
        name="ai-assistant-plan-community",
    ),
    path(
        "ai-assistant/suggest-content/",
        AIAssistantSuggestContentView.as_view(),
        name="ai-assistant-suggest-content",
    ),
    path(
        "ai-assistant/analyze-community/",
        AIAssistantAnalyzeCommunityView.as_view(),
        name="ai-assistant-analyze-community",
    ),
    path(
        "ai-assistant/chat/",
        AIAssistantChatView.as_view(),
        name="ai-assistant-chat",
    ),
    path(
        "ai-assistant/conversations/",
        AIAssistantConversationListView.as_view(),
        name="ai-assistant-conversations",
    ),
    path(
        "ai-assistant/conversations/<uuid:conversation_id>/",
        AIAssistantConversationDetailView.as_view(),
        name="ai-assistant-conversation-detail",
    ),
]

