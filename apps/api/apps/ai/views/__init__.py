from apps.ai.views.assessment_views import (
    ApplyAssessmentView,
    GenerateCodeExerciseView,
    GenerateQuizView,
)
from apps.ai.views.assistant_views import (
    AIAssistantAnalyzeCommunityView,
    AIAssistantChatView,
    AIAssistantConversationClearView,
    AIAssistantConversationDetailView,
    AIAssistantConversationListView,
    AIAssistantPlanCommunityView,
    AIAssistantRecommendCommunitiesView,
    AIAssistantSuggestContentView,
)
from apps.ai.views.churn_views import (
    CommunityChurnDashboardView,
    SendSmartNudgeView,
)
from apps.ai.views.digest_views import (
    CommunityDigestCurrentView,
    CommunityDigestTriggerView,
)
from apps.ai.views.health_views import AIProviderHealthView
from apps.ai.views.help_views import (
    PingMentorsView,
    PostHelpAssistanceView,
)
from apps.ai.views.moderation_views import AIModerationAuditListView
from apps.ai.views.peer_match_views import (
    CommunityPeerMatchView,
    HackathonTeammateSuggestionView,
    PeerMatchRespondView,
)
from apps.ai.views.search_views import (
    CheckDuplicatePostsView,
    SemanticSearchView,
)
from apps.ai.views.settings_views import (
    CommunityAISettingsView,
    GlobalAIProviderSettingsView,
)
from apps.ai.views.translation_views import AILanguageListView, AITranslateView

__all__ = [
    "AILanguageListView",
    "AITranslateView",
    "AIProviderHealthView",
    "AIModerationAuditListView",
    "CommunityAISettingsView",
    "GlobalAIProviderSettingsView",
    "AIAssistantRecommendCommunitiesView",
    "AIAssistantPlanCommunityView",
    "AIAssistantSuggestContentView",
    "AIAssistantAnalyzeCommunityView",
    "AIAssistantChatView",
    "AIAssistantConversationListView",
    "AIAssistantConversationDetailView",
    "AIAssistantConversationClearView",
    # Advanced AI Features
    "CheckDuplicatePostsView",
    "SemanticSearchView",
    "CommunityPeerMatchView",
    "HackathonTeammateSuggestionView",
    "PeerMatchRespondView",
    "PostHelpAssistanceView",
    "PingMentorsView",
    "GenerateQuizView",
    "GenerateCodeExerciseView",
    "ApplyAssessmentView",
    "CommunityChurnDashboardView",
    "SendSmartNudgeView",
    "CommunityDigestCurrentView",
    "CommunityDigestTriggerView",
]
