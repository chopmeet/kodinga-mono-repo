from django.urls import path

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
from apps.ai.views.help_views import PingMentorsView, PostHelpAssistanceView
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
    GlobalAISettingsView,
    WorkspaceAISettingsView,
)
from apps.ai.views.translation_views import ContentTranslationView

app_name = "ai"

urlpatterns = [
    # Global AI Health & Multi-Provider Monitoring
    path(
        "health/",
        AIProviderHealthView.as_view(),
        name="ai-health-check",
    ),
    path(
        "admin/ai/health/",
        AIProviderHealthView.as_view(),
        name="ai-provider-health",
    ),
    # Global Platform Multi-Provider Settings (Superadmin only)
    path(
        "settings/",
        GlobalAISettingsView.as_view(),
        name="global-ai-settings",
    ),
    path(
        "admin/ai/settings/",
        GlobalAISettingsView.as_view(),
        name="admin-ai-settings",
    ),
    # Community-level AI Model & Provider Strategy (Community Admin / Owner)
    path(
        "communities/<slug:slug>/ai-settings/",
        WorkspaceAISettingsView.as_view(),
        name="community-ai-settings",
    ),
    # Multi-turn Interactive AI Community Assistant (Conversational RAG)
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
    path(
        "ai-assistant/conversations/<uuid:conversation_id>/clear/",
        AIAssistantConversationClearView.as_view(),
        name="ai-assistant-conversation-clear",
    ),
    # 1. Semantic Search & Live Duplicate Question Detection
    path(
        "communities/<slug:slug>/posts/check-duplicates/",
        CheckDuplicatePostsView.as_view(),
        name="community-posts-check-duplicates",
    ),
    path(
        "communities/<slug:slug>/ai/check-duplicates/",
        CheckDuplicatePostsView.as_view(),
        name="community-ai-check-duplicates",
    ),
    path(
        "communities/<slug:slug>/ai/semantic-search/",
        SemanticSearchView.as_view(),
        name="community-ai-semantic-search",
    ),
    # 2. Smart Peer Matching & Hackathon Team Matchmaking
    path(
        "communities/<slug:slug>/ai/peer-matches/",
        CommunityPeerMatchView.as_view(),
        name="community-ai-peer-matches",
    ),
    path(
        "communities/<slug:slug>/ai/hackathon-suggestions/",
        HackathonTeammateSuggestionView.as_view(),
        name="community-ai-hackathon-suggestions",
    ),
    path(
        "ai/peer-matches/<uuid:pk>/respond/",
        PeerMatchRespondView.as_view(),
        name="peer-match-respond",
    ),
    # 3. Dynamic Educational Assessment Generator (Quizzes & Code Exercises)
    path(
        "courses/<slug:course_slug>/ai/generate-quiz/",
        GenerateQuizView.as_view(),
        name="course-ai-generate-quiz",
    ),
    path(
        "courses/<slug:course_slug>/ai/generate-exercise/",
        GenerateCodeExerciseView.as_view(),
        name="course-ai-generate-exercise",
    ),
    path(
        "courses/<slug:course_slug>/ai/apply-assessment/",
        ApplyAssessmentView.as_view(),
        name="course-ai-apply-assessment",
    ),
    # 4. Post Assistance & Mentor Discovery
    path(
        "posts/<uuid:post_id>/help-assistance/",
        PostHelpAssistanceView.as_view(),
        name="post-help-assistance",
    ),
    path(
        "posts/<uuid:post_id>/help-assistance/ping-mentors/",
        PingMentorsView.as_view(),
        name="post-help-ping-mentors",
    ),
    # 5. Community Pulse & Weekly AI Digest
    path(
        "communities/<slug:slug>/ai/weekly-digest/",
        CommunityDigestCurrentView.as_view(),
        name="community-ai-weekly-digest",
    ),
    path(
        "communities/<slug:slug>/ai/weekly-digest/trigger/",
        CommunityDigestTriggerView.as_view(),
        name="community-ai-weekly-digest-trigger",
    ),
    # 6. Retention & Predictive Member Churn Prevention
    path(
        "communities/<slug:slug>/ai/churn-dashboard/",
        CommunityChurnDashboardView.as_view(),
        name="community-ai-churn-dashboard",
    ),
    path(
        "ai/churn-risks/<uuid:churn_id>/send-nudge/",
        SendSmartNudgeView.as_view(),
        name="churn-risk-send-nudge",
    ),
    path(
        "ai/churn-risks/<uuid:pk>/send-nudge/",
        SendSmartNudgeView.as_view(),
        name="ai-churn-risk-send-nudge",
    ),
    # Core Utilities
    path(
        "moderation/audit-logs/",
        AIModerationAuditListView.as_view(),
        name="ai-moderation-audit-logs",
    ),
    path(
        "ai/moderation/logs/",
        AIModerationAuditListView.as_view(),
        name="ai-moderation-logs",
    ),
    path(
        "translate/",
        ContentTranslationView.as_view(),
        name="ai-content-translation",
    ),
]
