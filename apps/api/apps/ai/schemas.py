from typing import List, Optional
from pydantic import BaseModel, Field


class LanguageDetectionResult(BaseModel):
    language_code: str
    confidence: float = 1.0
    name: str = ""
    provider: str = ""


class TranslationResult(BaseModel):
    translated_text: str
    source_language: str
    target_language: str
    provider: str = ""
    model: str = ""
    confidence: float = 1.0
    cached: bool = False
    is_fallback_original: bool = False


class SentimentResult(BaseModel):
    sentiment: str = Field(..., description="positive, neutral, negative, mixed, uncertain")
    score: float = 0.0
    confidence: float = 1.0
    reason: str = ""
    provider: str = ""


class ModerationResult(BaseModel):
    decision: str = Field(..., description="allow, reject, review")
    flagged: bool = False
    categories: List[str] = Field(default_factory=list)
    confidence: float = 1.0
    reason: str = ""
    provider: str = ""
    model: str = ""


class PolicyViolationResult(BaseModel):
    violates_mandatory_rules: bool = False
    violates_community_rules: bool = False
    violations: List[str] = Field(default_factory=list)
    decision: str = "allow"
    reason: str = ""


class ProviderHealthStatus(BaseModel):
    provider: str
    is_healthy: bool = True
    circuit_breaker_state: str = "CLOSED"
    consecutive_errors: int = 0
    total_requests: int = 0
    fallback_count: int = 0
    avg_latency_ms: float = 0.0
    last_error: Optional[str] = None
    last_checked_at: Optional[str] = None


# ==============================================================================
# AI Community Assistant Schemas
# ==============================================================================

class CommunityRecommendationCard(BaseModel):
    id: str
    name: str
    slug: str
    tagline: str = ""
    description: str = ""
    category: str = ""
    privacy_type: str = "public"
    pricing_type: str = "free"
    members_count: int = 0
    language: str = "fr"
    relevance_reason: str = ""
    match_score: float = 1.0


class CommunityRecommendationResult(BaseModel):
    recommendations: List[CommunityRecommendationCard] = Field(default_factory=list)
    reasoning: str = ""
    suggested_alternatives: List[str] = Field(default_factory=list)
    provider: str = ""


class FirstWeekPlanItem(BaseModel):
    day: str
    focus: str
    action_items: List[str] = Field(default_factory=list)


class CommunityProposalResult(BaseModel):
    name_suggestions: List[str] = Field(default_factory=list)
    description: str = ""
    purpose: str = ""
    target_audience: str = ""
    suggested_categories: List[str] = Field(default_factory=list)
    suggested_rules: List[str] = Field(default_factory=list)
    recommended_language: str = "fr"
    recommended_visibility: str = "public"
    welcome_message: str = ""
    first_discussion_prompts: List[str] = Field(default_factory=list)
    initial_event_ideas: List[str] = Field(default_factory=list)
    first_week_launch_plan: List[FirstWeekPlanItem] = Field(default_factory=list)
    follow_up_questions: List[str] = Field(default_factory=list)
    provider: str = ""


class ContentSuggestionResult(BaseModel):
    discussion_categories: List[str] = Field(default_factory=list)
    first_post: dict = Field(default_factory=dict)
    weekly_activities: List[dict] = Field(default_factory=list)
    monthly_events: List[dict] = Field(default_factory=list)
    onboarding_prompt: str = ""
    weekly_content_calendar: List[dict] = Field(default_factory=list)
    provider: str = ""


class ImprovementRecommendation(BaseModel):
    category: str = ""
    title: str = ""
    action_draft: str = ""
    rationale: str = ""


class CommunityAnalysisResult(BaseModel):
    community_name: str = ""
    overview_assessment: str = ""
    strengths: List[str] = Field(default_factory=list)
    improvement_areas: List[str] = Field(default_factory=list)
    actionable_recommendations: List[ImprovementRecommendation] = Field(default_factory=list)
    event_suggestions: List[str] = Field(default_factory=list)
    engagement_tactics: List[str] = Field(default_factory=list)
    metrics_summary: dict = Field(default_factory=dict)
    provider: str = ""


class AssistantChatResult(BaseModel):
    reply: str
    suggested_follow_ups: List[str] = Field(default_factory=list)
    suggested_action: Optional[str] = None
    data: Optional[dict] = None
    provider: str = ""

