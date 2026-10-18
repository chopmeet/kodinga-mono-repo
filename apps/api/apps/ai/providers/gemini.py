import json
import logging
import re
from typing import Any, Optional

from django.conf import settings

from apps.ai.providers.base import BaseAIProvider
from apps.ai.providers.exceptions import (
    ConfigurationError,
    QuotaExhaustedError,
    RateLimitError,
    RecoverableProviderError,
    SafetyRejectionError,
)
from apps.ai.schemas import (
    AssistantChatResult,
    CommunityAnalysisResult,
    CommunityProposalResult,
    CommunityRecommendationCard,
    CommunityRecommendationResult,
    ContentSuggestionResult,
    FirstWeekPlanItem,
    ImprovementRecommendation,
    LanguageDetectionResult,
    ModerationResult,
    PolicyViolationResult,
    SentimentResult,
    TranslationResult,
)

logger = logging.getLogger(__name__)


class GeminiAdapter(BaseAIProvider):
    """
    Primary AI provider adapter utilizing the official Google GenAI SDK.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout_ms: Optional[int] = None,
    ):
        self.api_key = api_key or getattr(settings, "GEMINI_API_KEY", "")
        self.model_name = model_name or getattr(settings, "GEMINI_TEXT_MODEL", "gemini-2.5-flash")
        self.timeout_ms = timeout_ms or getattr(settings, "AI_PROVIDER_TIMEOUT_MS", 15000)
        self._client = None

    @property
    def provider_name(self) -> str:
        return "gemini"

    def _get_client(self):
        if not self._client:
            if not self.api_key:
                raise ConfigurationError(
                    "GEMINI_API_KEY is not configured.", provider=self.provider_name
                )
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"[Gemini] Failed to initialize genai.Client: {e}")
                raise ConfigurationError(
                    f"Gemini client initialization failed: {e}",
                    provider=self.provider_name,
                ) from e
        return self._client

    def _clean_json_response(self, text: str) -> dict:
        """Strip markdown fences and extract pure JSON dict."""
        clean = text.strip()
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean)
        if match:
            clean = match.group(1).strip()
        try:
            return json.loads(clean)
        except Exception as e:
            # Try to find { ... }
            braces_match = re.search(r"\{[\s\S]*\}", clean)
            if braces_match:
                try:
                    return json.loads(braces_match.group(0))
                except Exception:
                    pass
            logger.warning(f"[Gemini] Failed to parse JSON response: {text[:200]}...")
            raise RecoverableProviderError(
                f"Invalid JSON returned by Gemini: {e}", provider=self.provider_name
            ) from e

    def _handle_gemini_error(self, e: Exception) -> None:
        """Categorize Gemini API exceptions into domain-specific error types."""
        err_msg = str(e).lower()
        e.__class__.__name__.lower()

        # Check for Quota exhaustion
        if (
            "resource_exhausted" in err_msg
            or "quota" in err_msg
            or "insufficient_quota" in err_msg
            or "429" in err_msg and ("exhausted" in err_msg or "quota" in err_msg)
        ):
            logger.warning(f"[Gemini] Quota exhausted: {e}")
            raise QuotaExhaustedError(
                f"Gemini quota exhausted: {e}", provider=self.provider_name
            )

        # Check for short-term rate limits
        if "429" in err_msg or "rate limit" in err_msg or "too many requests" in err_msg:
            logger.warning(f"[Gemini] Rate limited: {e}")
            raise RateLimitError(
                f"Gemini rate limit exceeded: {e}", provider=self.provider_name
            )

        # Check for authentication / configuration errors
        if (
            "api_key_invalid" in err_msg
            or "api key not valid" in err_msg
            or "permission_denied" in err_msg
            or "unauthorized" in err_msg
            or "401" in err_msg
            or "403" in err_msg
        ):
            logger.critical(f"[Gemini] Configuration / Auth error: {e}")
            raise ConfigurationError(
                f"Gemini authentication / configuration error: {e}",
                provider=self.provider_name,
            )

        # Check for transient server errors and timeouts
        if (
            "503" in err_msg
            or "500" in err_msg
            or "unavailable" in err_msg
            or "deadline_exceeded" in err_msg
            or "timeout" in err_msg
            or "connection" in err_msg
            or "network" in err_msg
        ):
            logger.warning(f"[Gemini] Transient recoverable error: {e}")
            raise RecoverableProviderError(
                f"Gemini transient error: {e}", provider=self.provider_name
            )

        # Default fallback to recoverable provider error
        raise RecoverableProviderError(
            f"Gemini operation failed: {e}", provider=self.provider_name
        )

    def _generate(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        client = self._get_client()
        try:
            from google.genai import types

            config = types.GenerateContentConfig(
                temperature=0.1,
                top_p=0.95,
            )
            if system_instruction:
                config.system_instruction = system_instruction

            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config,
            )

            # Check for safety finish reason
            candidates = getattr(response, "candidates", [])
            if candidates:
                first_cand = candidates[0]
                finish_reason = getattr(first_cand, "finish_reason", None)
                finish_str = str(finish_reason).upper()
                if "SAFETY" in finish_str:
                    logger.info("[Gemini] Request flagged by model safety filter.")
                    raise SafetyRejectionError(
                        "Contenu bloqué par les filtres de sécurité Gemini.",
                        provider=self.provider_name,
                    )

            text = response.text or ""
            return text
        except SafetyRejectionError:
            raise
        except Exception as e:
            self._handle_gemini_error(e)

    def detect_language(self, text: str) -> LanguageDetectionResult:
        system = (
            "You are a professional linguistic classifier. Identify the language of the provided text. "
            "Supported languages include French ('fr'), English ('en'), Wolof ('wo'), Bambara ('bm'), "
            "or standard ISO 639-1 code. Return strictly valid JSON with keys: language_code, confidence, name."
        )
        prompt = f"Text to classify:\n\"\"\"{text[:2000]}\"\"\"\n\nReturn JSON:"
        raw = self._generate(prompt, system_instruction=system)
        data = self._clean_json_response(raw)

        lang_code = data.get("language_code", "fr").strip().lower()
        # Normalize code
        if lang_code in ["wolof", "wolo"]:
            lang_code = "wo"
        elif lang_code in ["bambara", "bam"]:
            lang_code = "bm"
        elif lang_code in ["french", "francais", "français"]:
            lang_code = "fr"
        elif lang_code in ["english", "anglais"]:
            lang_code = "en"

        return LanguageDetectionResult(
            language_code=lang_code,
            confidence=float(data.get("confidence", 0.95)),
            name=data.get("name", lang_code),
            provider=self.provider_name,
        )

    def translate_text(
        self, text: str, target_lang: str, source_lang: Optional[str] = None
    ) -> TranslationResult:
        system = (
            f"You are an expert multilingual translator specialized in African and international languages. "
            f"Translate the text accurately into target language '{target_lang}'. "
            f"Languages supported include French (fr), English (en), Wolof (wo), and Bambara (bm). "
            f"CRITICAL RULES:\n"
            f"1. Preserve all URLs, code blocks, @mentions, #tags, numbers, and emojis verbatim.\n"
            f"2. For Wolof (wo) and Bambara (bm), use natural and authentic standard orthography. "
            f"Do NOT hallucinate or invent non-existent words. If technical terms have no direct translation, preserve them.\n"
            f"3. Return strictly valid JSON: {{\"translated_text\": \"...\", \"source_language\": \"...\", \"target_language\": \"{target_lang}\", \"confidence\": 0.95}}"
        )
        prompt = f"Source language: {source_lang or 'auto'}\nTarget language: {target_lang}\n\nContent:\n\"\"\"{text}\"\"\"\n\nJSON:"
        raw = self._generate(prompt, system_instruction=system)
        data = self._clean_json_response(raw)

        translated = data.get("translated_text", text)
        detected_src = data.get("source_language", source_lang or "auto")

        return TranslationResult(
            translated_text=translated,
            source_language=detected_src,
            target_language=target_lang,
            provider=self.provider_name,
            model=self.model_name,
            confidence=float(data.get("confidence", 0.95)),
        )

    def analyze_sentiment(self, text: str) -> SentimentResult:
        system = (
            "You are an objective sentiment analysis engine. Classify the sentiment of the text into "
            "exactly one of: 'positive', 'neutral', 'negative', 'mixed', 'uncertain'. "
            "Distinguish constructive technical criticism or complaints from hate/abuse. "
            "Return strictly valid JSON: {\"sentiment\": \"...\", \"score\": 0.0, \"confidence\": 0.95, \"reason\": \"...\"}"
        )
        prompt = f"Text to analyze:\n\"\"\"{text[:3000]}\"\"\"\n\nJSON:"
        raw = self._generate(prompt, system_instruction=system)
        data = self._clean_json_response(raw)

        sentiment_val = str(data.get("sentiment", "neutral")).lower()
        if sentiment_val not in ["positive", "neutral", "negative", "mixed", "uncertain"]:
            sentiment_val = "neutral"

        return SentimentResult(
            sentiment=sentiment_val,
            score=float(data.get("score", 0.0)),
            confidence=float(data.get("confidence", 0.95)),
            reason=data.get("reason", ""),
            provider=self.provider_name,
        )

    def moderate_content(
        self, text: str, context: Optional[dict[str, Any]] = None
    ) -> ModerationResult:
        try:
            system = (
                "You are the central safety and content moderation auditor for Kodinga community platform. "
                "Evaluate text against MANDATORY PLATFORM SAFETY RULES:\n"
                "- sexual_harassment: Sexual harassment, sexually abusive content, explicit sexual solicitation.\n"
                "- targeted_harassment: Targeted personal attacks, intimidation, stalking, threats of violence.\n"
                "- hate_speech_and_humiliation: Humiliation, bullying, degrading attacks against individuals based on identity.\n"
                "- severe_safety_violation: Promotion of suicide, self-harm, cyberattacks, illegal weapons.\n"
                "NON-MANDATORY CATEGORIES (mark if detected):\n"
                "- profanity: gratuitous insults or vulgarities.\n"
                "- spam_and_scam: deceptive ads, phishing, scam links.\n\n"
                "CRITICAL INSTRUCTIONS:\n"
                "1. Legitimate debates, disagreements, technical critiques, and complaints are ALLOWED.\n"
                "2. Decision must be 'allow', 'reject' (clear mandatory violation), or 'review' (ambiguous/low confidence).\n"
                "3. Return strictly valid JSON: {\"decision\": \"allow\"|\"reject\"|\"review\", \"flagged\": boolean, \"categories\": [...], \"confidence\": 0.98, \"reason\": \"...\"}"
            )
            prompt = f"Content to moderate:\n\"\"\"{text[:4000]}\"\"\"\n\nJSON:"
            raw = self._generate(prompt, system_instruction=system)
            data = self._clean_json_response(raw)

            decision = data.get("decision", "allow").lower()
            if decision not in ["allow", "reject", "review"]:
                decision = "allow"

            categories = data.get("categories", [])
            if not isinstance(categories, list):
                categories = []

            flagged = data.get("flagged", decision in ["reject", "review"])

            return ModerationResult(
                decision=decision,
                flagged=flagged,
                categories=categories,
                confidence=float(data.get("confidence", 0.95)),
                reason=data.get("reason", ""),
                provider=self.provider_name,
                model=self.model_name,
            )
        except SafetyRejectionError as e:
            # Gemini safety filters directly rejected content
            return ModerationResult(
                decision="reject",
                flagged=True,
                categories=["severe_safety_violation"],
                confidence=1.0,
                reason=str(e),
                provider=self.provider_name,
                model=self.model_name,
            )

    def classify_community_policy_violation(
        self, text: str, community_rules: Optional[dict[str, Any]] = None
    ) -> PolicyViolationResult:
        mod_result = self.moderate_content(text)
        mandatory_categories = [
            "sexual_harassment",
            "targeted_harassment",
            "hate_speech_and_humiliation",
            "severe_safety_violation",
        ]
        mandatory_violations = [c for c in mod_result.categories if c in mandatory_categories]
        community_violations = [c for c in mod_result.categories if c not in mandatory_categories]

        violates_mandatory = len(mandatory_violations) > 0 or mod_result.decision == "reject"
        violates_community = len(community_violations) > 0

        final_decision = "reject" if violates_mandatory else ("review" if violates_community else "allow")

        return PolicyViolationResult(
            violates_mandatory_rules=violates_mandatory,
            violates_community_rules=violates_community,
            violations=mod_result.categories,
            decision=final_decision,
            reason=mod_result.reason,
        )

    def _get_lang_prompt(self, language: str) -> str:
        lang = (language or "fr").lower()
        mapping = {
            "wo": "Wolof language (Senegal/Gambia). Use natural, welcoming Wolof phrasing.",
            "bm": "Bambara language (Mali). Use natural, welcoming Bambara phrasing.",
            "en": "English language.",
        }
        return mapping.get(lang, "French language.")

    def recommend_communities(
        self,
        interests: str,
        candidate_communities: list,
        language: str = "fr",
    ) -> CommunityRecommendationResult:
        lang_instruction = self._get_lang_prompt(language)
        candidates_json = json.dumps(candidate_communities, ensure_ascii=False)
        prompt = (
            f"You are the Kodinga AI Community Guide.\n"
            f"Analyze user interests and goals: \"{interests}\".\n"
            f"Select the most relevant communities strictly from this list of candidates:\n"
            f"{candidates_json}\n\n"
            f"CRITICAL RULES:\n"
            f"1. Only recommend communities present in the candidates list. Do NOT invent new ones.\n"
            f"2. For each recommendation, provide an insightful 'relevance_reason' explaining why it matches the user.\n"
            f"3. Respond in {lang_instruction}.\n\n"
            f"Respond ONLY in valid JSON matching this schema:\n"
            f'{{\n'
            f'  "recommendations": [\n'
            f'    {{\n'
            f'      "id": "str",\n'
            f'      "name": "str",\n'
            f'      "slug": "str",\n'
            f'      "tagline": "str",\n'
            f'      "description": "str",\n'
            f'      "category": "str",\n'
            f'      "privacy_type": "str",\n'
            f'      "pricing_type": "str",\n'
            f'      "members_count": 10,\n'
            f'      "language": "str",\n'
            f'      "relevance_reason": "str",\n'
            f'      "match_score": 0.95\n'
            f'    }}\n'
            f'  ],\n'
            f'  "reasoning": "Overview explanation of why these were chosen",\n'
            f'  "suggested_alternatives": ["alternative topic 1", "alternative topic 2"]\n'
            f'}}'
        )
        try:
            client = self._get_client()
            resp = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
            )
            data = self._clean_json_response(resp.text)
            recs = [
                CommunityRecommendationCard(**item)
                for item in data.get("recommendations", [])
            ]
            return CommunityRecommendationResult(
                recommendations=recs,
                reasoning=data.get("reasoning", ""),
                suggested_alternatives=data.get("suggested_alternatives", []),
                provider=self.provider_name,
            )
        except Exception as e:
            self._handle_gemini_error(e)
            raise RecoverableProviderError(f"Gemini error: {e}", provider=self.provider_name) from e

    def plan_community(
        self,
        idea: str,
        language: str = "fr",
        context: Optional[dict[str, Any]] = None,
    ) -> CommunityProposalResult:
        lang_instruction = self._get_lang_prompt(language)
        prompt = (
            f"You are the Kodinga Community Builder Assistant.\n"
            f"A user wants to create a community with this concept:\n\"{idea}\"\n\n"
            f"Context: {json.dumps(context or {}, ensure_ascii=False)}\n\n"
            f"Transform this idea into a structured, highly actionable community proposal.\n"
            f"Provide 3-5 name suggestions, a compelling description and purpose, target audience, "
            f"suggested discussion categories (channels), community rules, language recommendation, "
            f"visibility recommendation ('public' or 'private'), a warm welcome message, the first 3 discussion prompts, "
            f"initial event or workshop ideas, and a practical 7-day launch plan.\n"
            f"If essential details are missing, include 1-2 follow_up_questions.\n"
            f"Respond in {lang_instruction}.\n\n"
            f"Respond ONLY in valid JSON matching this schema:\n"
            f'{{\n'
            f'  "name_suggestions": ["name1", "name2", "name3"],\n'
            f'  "description": "Full description",\n'
            f'  "purpose": "Core mission",\n'
            f'  "target_audience": "Who this is for",\n'
            f'  "suggested_categories": ["#general", "#annonces", "#projets", "#entraide"],\n'
            f'  "suggested_rules": ["rule 1", "rule 2"],\n'
            f'  "recommended_language": "fr",\n'
            f'  "recommended_visibility": "public",\n'
            f'  "welcome_message": "Warm welcome message",\n'
            f'  "first_discussion_prompts": ["Prompt 1", "Prompt 2", "Prompt 3"],\n'
            f'  "initial_event_ideas": ["Event 1", "Event 2"],\n'
            f'  "first_week_launch_plan": [\n'
            f'    {{"day": "Jour 1", "focus": "Bienvenue", "action_items": ["Action 1", "Action 2"]}}\n'
            f'  ],\n'
            f'  "follow_up_questions": []\n'
            f'}}'
        )
        try:
            client = self._get_client()
            resp = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
            )
            data = self._clean_json_response(resp.text)
            plan_items = [
                FirstWeekPlanItem(**item)
                for item in data.get("first_week_launch_plan", [])
            ]
            return CommunityProposalResult(
                name_suggestions=data.get("name_suggestions", []),
                description=data.get("description", ""),
                purpose=data.get("purpose", ""),
                target_audience=data.get("target_audience", ""),
                suggested_categories=data.get("suggested_categories", []),
                suggested_rules=data.get("suggested_rules", []),
                recommended_language=data.get("recommended_language", "fr"),
                recommended_visibility=data.get("recommended_visibility", "public"),
                welcome_message=data.get("welcome_message", ""),
                first_discussion_prompts=data.get("first_discussion_prompts", []),
                initial_event_ideas=data.get("initial_event_ideas", []),
                first_week_launch_plan=plan_items,
                follow_up_questions=data.get("follow_up_questions", []),
                provider=self.provider_name,
            )
        except Exception as e:
            self._handle_gemini_error(e)
            raise RecoverableProviderError(f"Gemini error: {e}", provider=self.provider_name) from e

    def suggest_content(
        self,
        community_info: dict[str, Any],
        goal: Optional[str] = None,
        language: str = "fr",
    ) -> ContentSuggestionResult:
        lang_instruction = self._get_lang_prompt(language)
        info_json = json.dumps(community_info, ensure_ascii=False)
        prompt = (
            f"You are the Kodinga Community Assistant.\n"
            f"Suggest actionable content, activities, and events tailored to this community:\n"
            f"{info_json}\n"
            f"Goal: {goal or 'Encourager la participation et les échanges'}\n"
            f"Respond in {lang_instruction}.\n\n"
            f"Respond ONLY in valid JSON matching this schema:\n"
            f'{{\n'
            f'  "discussion_categories": ["#general", "#showcase", "#aide", "#opportunites"],\n'
            f'  "first_post": {{"title": "Titre", "content": "Corps du message", "type": "discussion"}},\n'
            f'  "weekly_activities": [{{"title": "Activité", "description": "Détail"}}],\n'
            f'  "monthly_events": [{{"title": "Événement", "format": "online", "description": "Détail"}}],\n'
            f'  "onboarding_prompt": "Texte d\'accueil",\n'
            f'  "weekly_content_calendar": [{{"day": "Lundi", "topic": "Partage de code", "type": "post"}}]\n'
            f'}}'
        )
        try:
            client = self._get_client()
            resp = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
            )
            data = self._clean_json_response(resp.text)
            return ContentSuggestionResult(
                discussion_categories=data.get("discussion_categories", []),
                first_post=data.get("first_post", {}),
                weekly_activities=data.get("weekly_activities", []),
                monthly_events=data.get("monthly_events", []),
                onboarding_prompt=data.get("onboarding_prompt", ""),
                weekly_content_calendar=data.get("weekly_content_calendar", []),
                provider=self.provider_name,
            )
        except Exception as e:
            self._handle_gemini_error(e)
            raise RecoverableProviderError(f"Gemini error: {e}", provider=self.provider_name) from e

    def analyze_community(
        self,
        community_info: dict[str, Any],
        metrics: dict[str, Any],
        language: str = "fr",
    ) -> CommunityAnalysisResult:
        lang_instruction = self._get_lang_prompt(language)
        prompt = (
            f"You are the Kodinga Community Improvement Analyst.\n"
            f"Analyze this community's real data and metrics objectively:\n"
            f"Community: {json.dumps(community_info, ensure_ascii=False)}\n"
            f"Real Metrics: {json.dumps(metrics, ensure_ascii=False)}\n\n"
            f"RULES:\n"
            f"- Base your analysis only on real metrics; do not fabricate numbers.\n"
            f"- Clearly distinguish recommendations from completed actions.\n"
            f"- Respond in {lang_instruction}.\n\n"
            f"Respond ONLY in valid JSON matching this schema:\n"
            f'{{\n'
            f'  "community_name": "{community_info.get("name", "")}",\n'
            f'  "overview_assessment": "Global diagnostic",\n'
            f'  "strengths": ["Strength 1", "Strength 2"],\n'
            f'  "improvement_areas": ["Area 1", "Area 2"],\n'
            f'  "actionable_recommendations": [\n'
            f'    {{"category": "engagement", "title": "Titre", "action_draft": "Draft", "rationale": "Why"}}\n'
            f'  ],\n'
            f'  "event_suggestions": ["Event suggestion 1"],\n'
            f'  "engagement_tactics": ["Tactic 1", "Tactic 2"],\n'
            f'  "metrics_summary": {json.dumps(metrics, ensure_ascii=False)}\n'
            f'}}'
        )
        try:
            client = self._get_client()
            resp = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
            )
            data = self._clean_json_response(resp.text)
            recs = [
                ImprovementRecommendation(**item)
                for item in data.get("actionable_recommendations", [])
            ]
            return CommunityAnalysisResult(
                community_name=data.get("community_name", community_info.get("name", "")),
                overview_assessment=data.get("overview_assessment", ""),
                strengths=data.get("strengths", []),
                improvement_areas=data.get("improvement_areas", []),
                actionable_recommendations=recs,
                event_suggestions=data.get("event_suggestions", []),
                engagement_tactics=data.get("engagement_tactics", []),
                metrics_summary=metrics,
                provider=self.provider_name,
            )
        except Exception as e:
            self._handle_gemini_error(e)
            raise RecoverableProviderError(f"Gemini error: {e}", provider=self.provider_name) from e

    def assistant_chat(
        self,
        message: str,
        history: list,
        context: Optional[dict[str, Any]] = None,
        language: str = "fr",
    ) -> AssistantChatResult:
        lang_instruction = self._get_lang_prompt(language)
        prompt = (
            f"You are the Kodinga AI Community Assistant, an intelligent and warm community guide and builder.\n"
            f"Context: {json.dumps(context or {}, ensure_ascii=False)}\n"
            f"Conversation history: {json.dumps(history, ensure_ascii=False)}\n\n"
            f"User message: \"{message}\"\n\n"
            f"Provide a helpful, concise, and structured reply in {lang_instruction}.\n"
            f"If the user wants to discover communities, plan a community, suggest content, or improve a community, "
            f"indicate the suggested_action ('recommend_communities', 'plan_community', 'suggest_content', 'analyze_community', or null).\n"
            f"Suggest 2-3 relevant follow-up prompts.\n\n"
            f"Respond ONLY in valid JSON matching this schema:\n"
            f'{{\n'
            f'  "reply": "Assistant response text",\n'
            f'  "suggested_follow_ups": ["Follow up 1", "Follow up 2"],\n'
            f'  "suggested_action": null,\n'
            f'  "data": null\n'
            f'}}'
        )
        try:
            client = self._get_client()
            resp = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
            )
            data = self._clean_json_response(resp.text)
            return AssistantChatResult(
                reply=data.get("reply", resp.text),
                suggested_follow_ups=data.get("suggested_follow_ups", []),
                suggested_action=data.get("suggested_action"),
                data=data.get("data"),
                provider=self.provider_name,
            )
        except Exception as e:
            self._handle_gemini_error(e)
            raise RecoverableProviderError(f"Gemini error: {e}", provider=self.provider_name) from e

