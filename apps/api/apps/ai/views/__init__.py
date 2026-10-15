from apps.ai.views.assistant_views import (
    AIAssistantAnalyzeCommunityView,
    AIAssistantChatView,
    AIAssistantConversationDetailView,
    AIAssistantConversationListView,
    AIAssistantPlanCommunityView,
    AIAssistantRecommendCommunitiesView,
    AIAssistantSuggestContentView,
)
from apps.ai.views.health_views import AIProviderHealthView
from apps.ai.views.moderation_views import AIModerationAuditListView
from apps.ai.views.settings_views import CommunityAISettingsView
from apps.ai.views.translation_views import AITranslateView

__all__ = [
    "AITranslateView",
    "AIProviderHealthView",
    "AIModerationAuditListView",
    "CommunityAISettingsView",
    "AIAssistantRecommendCommunitiesView",
    "AIAssistantPlanCommunityView",
    "AIAssistantSuggestContentView",
    "AIAssistantAnalyzeCommunityView",
    "AIAssistantChatView",
    "AIAssistantConversationListView",
    "AIAssistantConversationDetailView",
]

