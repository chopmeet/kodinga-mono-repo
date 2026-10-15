from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from apps.ai.schemas import (
    LanguageDetectionResult,
    TranslationResult,
    SentimentResult,
    ModerationResult,
    PolicyViolationResult,
)


class BaseAIProvider(ABC):
    """
    Abstract base interface for all AI provider adapters (Gemini, OpenAI).
    Enforces identical method signatures and structured return schemas.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name identifier of the provider (e.g. 'gemini', 'openai')."""
        pass

    @abstractmethod
    def detect_language(self, text: str) -> LanguageDetectionResult:
        """
        Detects primary language of the text.
        Supports French (fr), English (en), Wolof (wo), Bambara (bm), etc.
        """
        pass

    @abstractmethod
    def translate_text(
        self, text: str, target_lang: str, source_lang: Optional[str] = None
    ) -> TranslationResult:
        """
        Translates text into the target language while preserving formatting,
        mentions, emojis, and code blocks.
        """
        pass

    @abstractmethod
    def analyze_sentiment(self, text: str) -> SentimentResult:
        """
        Classifies sentiment into positive, neutral, negative, mixed, uncertain.
        """
        pass

    @abstractmethod
    def moderate_content(
        self, text: str, context: Optional[Dict[str, Any]] = None
    ) -> ModerationResult:
        """
        Evaluates content against platform-wide mandatory safety rules
        (sexual harassment, abusive harassment, humiliation/bullying, severe safety violations).
        """
        pass

    @abstractmethod
    def classify_community_policy_violation(
        self, text: str, community_rules: Optional[Dict[str, Any]] = None
    ) -> PolicyViolationResult:
        """
        Evaluates content against custom community-specific rules
        in addition to platform-wide mandatory rules.
        """
        pass

    @abstractmethod
    def recommend_communities(
        self,
        interests: str,
        candidate_communities: list,
        language: str = "fr",
    ):
        """
        Selects and ranks candidate communities matching user interests/goals.
        Provides grounded reasoning for each recommendation.
        """
        pass

    @abstractmethod
    def plan_community(
        self,
        idea: str,
        language: str = "fr",
        context: Optional[Dict[str, Any]] = None,
    ):
        """
        Transforms a user's natural language community idea into a structured proposal.
        """
        pass

    @abstractmethod
    def suggest_content(
        self,
        community_info: Dict[str, Any],
        goal: Optional[str] = None,
        language: str = "fr",
    ):
        """
        Generates actionable discussion categories, first post draft, weekly activities,
        monthly events, and content calendar.
        """
        pass

    @abstractmethod
    def analyze_community(
        self,
        community_info: Dict[str, Any],
        metrics: Dict[str, Any],
        language: str = "fr",
    ):
        """
        Analyzes real community metrics and suggests high-impact improvements.
        """
        pass

    @abstractmethod
    def assistant_chat(
        self,
        message: str,
        history: list,
        context: Optional[Dict[str, Any]] = None,
        language: str = "fr",
    ):
        """
        Conversational assistant response retaining context and suggesting relevant follow-ups.
        """
        pass

