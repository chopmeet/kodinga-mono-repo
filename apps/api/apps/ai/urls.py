from django.urls import path

from apps.ai.views import (
    AIAssistantAnalyzeCommunityView,
    AIAssistantChatView,
    AIAssistantConversationClearView,
    AIAssistantConversationDetailView,
    AIAssistantConversationListView,
    AIAssistantPlanCommunityView,
    AIAssistantRecommendCommunitiesView,
    AIAssistantSuggestContentView,
    AILanguageListView,
    AIModerationAuditListView,
    AIProviderHealthView,
    AITranslateView,
    ApplyAssessmentView,
    CheckDuplicatePostsView,
    CommunityAISettingsView,
    CommunityChurnDashboardView,
    CommunityDigestCurrentView,
    CommunityDigestTriggerView,
    CommunityPeerMatchView,
    GenerateCodeExerciseView,
    GenerateQuizView,
    GlobalAIProviderSettingsView,
    HackathonTeammateSuggestionView,
    PeerMatchRespondView,
    PingMentorsView,
    PostHelpAssistanceView,
    SemanticSearchView,
    SendSmartNudgeView,
)

app_name = "ai"

urlpatterns = [
    # Supported Languages Directory
    path("ai/languages/", AILanguageListView.as_view(), name="ai-languages"),
    # Multilingual Translation
    path("ai/translate/", AITranslateView.as_view(), name="ai-translate"),
    # Observability & Health
    path("admin/ai/health/", AIProviderHealthView.as_view(), name="ai-provider-health"),
    # Global AI Provider Routing Strategy (Superadmin)
    path("admin/ai/settings/", GlobalAIProviderSettingsView.as_view(), name="admin-ai-settings"),
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
        name="ai-peer-match-respond",
    ),
    # 3. Community Help Facilitator & Expert Mentor Tagging
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
    # 4. Automated Quiz & Code Exercise Generator for Instructors
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
    # 5. Predictive Churn Detection & Creator Smart Nudges
    path(
        "communities/<slug:slug>/ai/churn-dashboard/",
        CommunityChurnDashboardView.as_view(),
        name="community-ai-churn-dashboard",
    ),
    path(
        "ai/churn-risks/<uuid:pk>/send-nudge/",
        SendSmartNudgeView.as_view(),
        name="ai-churn-risk-send-nudge",
    ),
    # 6. Weekly Community Digest ("Community Pulse")
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
]
