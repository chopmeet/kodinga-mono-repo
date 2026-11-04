import hashlib
import json
import logging
import math
import re
from typing import Any, Optional

from django.conf import settings

from apps.ai.providers.base import BaseAIProvider
from apps.ai.providers.exceptions import (
    ConfigurationError,
    QuotaExhaustedError,
    RateLimitError,
    RecoverableProviderError,
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


class OpenAIAdapter(BaseAIProvider):
    """
    Fallback AI provider adapter utilizing the official OpenAI Python SDK.
    Includes support for chat completions and the dedicated OpenAI Moderation API.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        moderation_model: Optional[str] = None,
        timeout_ms: Optional[int] = None,
    ):
        self._explicit_key = api_key is not None
        self.api_key = api_key or getattr(settings, "OPENAI_API_KEY", "")
        self.model_name = model_name or getattr(settings, "OPENAI_TEXT_MODEL", "gpt-4o-mini")
        self.moderation_model = moderation_model or getattr(
            settings, "OPENAI_MODERATION_MODEL", "omni-moderation-latest"
        )
        self.timeout_ms = timeout_ms or getattr(settings, "AI_PROVIDER_TIMEOUT_MS", 15000)
        self._client = None

    @property
    def provider_name(self) -> str:
        return "openai"

    def _get_client(self):
        if not self._client:
            effective_key = self.api_key if self._explicit_key else getattr(settings, "OPENAI_API_KEY", "")
            if not effective_key:
                raise ConfigurationError(
                    "OPENAI_API_KEY is not configured.", provider=self.provider_name
                )
            try:
                from openai import OpenAI
                timeout_sec = self.timeout_ms / 1000.0
                self._client = OpenAI(api_key=effective_key, timeout=timeout_sec)
            except Exception as e:
                logger.error(f"[OpenAI] Failed to initialize OpenAI client: {e}")
                raise ConfigurationError(
                    f"OpenAI client initialization failed: {e}",
                    provider=self.provider_name,
                ) from e
        return self._client

    def _clean_json_response(self, text: str) -> dict:
        clean = text.strip()
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean)
        if match:
            clean = match.group(1).strip()
        try:
            return json.loads(clean)
        except Exception as e:
            braces_match = re.search(r"\{[\s\S]*\}", clean)
            if braces_match:
                try:
                    return json.loads(braces_match.group(0))
                except Exception:
                    pass
            logger.warning(f"[OpenAI] Failed to parse JSON response: {text[:200]}...")
            raise RecoverableProviderError(
                f"Invalid JSON returned by OpenAI: {e}", provider=self.provider_name
            ) from e

    def _handle_openai_error(self, e: Exception) -> None:
        err_msg = str(e).lower()
        err_class = e.__class__.__name__.lower()

        # Check for Quota exhaustion
        if "insufficient_quota" in err_msg or "quota" in err_msg:
            logger.warning(f"[OpenAI] Quota exhausted: {e}")
            raise QuotaExhaustedError(
                f"OpenAI quota exhausted: {e}", provider=self.provider_name
            )

        # Check for Rate limiting
        if "rate_limit" in err_class or "ratelimit" in err_class or "429" in err_msg:
            logger.warning(f"[OpenAI] Rate limited: {e}")
            raise RateLimitError(
                f"OpenAI rate limit exceeded: {e}", provider=self.provider_name
            )

        # Check for Configuration / Authentication errors
        if (
            "authentication" in err_class
            or "invalid_api_key" in err_msg
            or "401" in err_msg
            or "permission" in err_msg
        ):
            logger.critical(f"[OpenAI] Configuration / Auth error: {e}")
            raise ConfigurationError(
                f"OpenAI authentication error: {e}", provider=self.provider_name
            )

        # Check for Transient errors
        if (
            "timeout" in err_msg
            or "connection" in err_msg
            or "503" in err_msg
            or "500" in err_msg
            or "internalservererror" in err_class
        ):
            logger.warning(f"[OpenAI] Transient recoverable error: {e}")
            raise RecoverableProviderError(
                f"OpenAI transient error: {e}", provider=self.provider_name
            )

        raise RecoverableProviderError(
            f"OpenAI operation failed: {e}", provider=self.provider_name
        )

    def _chat_completion(self, system: str, user_prompt: str) -> str:
        client = self._get_client()
        try:
            response = client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            return response.choices[0].message.content or "{}"
        except Exception as e:
            self._handle_openai_error(e)

    def detect_language(self, text: str) -> LanguageDetectionResult:
        system = (
            "You are a professional linguistic classifier. Identify the language of the provided text. "
            "Supported languages include French ('fr'), English ('en'), Wolof ('wo'), Bambara ('bm'), "
            "or standard ISO 639-1 code. Return strictly valid JSON with keys: language_code, confidence, name."
        )
        raw = self._chat_completion(system, f"Text to classify:\n\"\"\"{text[:2000]}\"\"\"")
        data = self._clean_json_response(raw)

        lang_code = data.get("language_code", "fr").strip().lower()
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
        prompt = f"Source language: {source_lang or 'auto'}\nTarget language: {target_lang}\n\nContent:\n\"\"\"{text}\"\"\""
        raw = self._chat_completion(system, prompt)
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
        raw = self._chat_completion(system, f"Text to analyze:\n\"\"\"{text[:3000]}\"\"\"")
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

    def check_moderation_api(self, text: str) -> Optional[ModerationResult]:
        """
        Uses the dedicated official OpenAI Moderation API (/v1/moderations)
        as an additional safety signal.
        """
        client = self._get_client()
        try:
            resp = client.moderations.create(
                model=self.moderation_model,
                input=text[:4000],
            )
            result = resp.results[0]
            if result.flagged:
                flagged_cats = []
                categories_dict = getattr(result, "categories", {})
                if hasattr(categories_dict, "model_dump"):
                    cat_map = categories_dict.model_dump()
                elif isinstance(categories_dict, dict):
                    cat_map = categories_dict
                else:
                    cat_map = getattr(categories_dict, "__dict__", {})

                for k, v in cat_map.items():
                    if v:
                        if "sexual" in k:
                            flagged_cats.append("sexual_harassment")
                        elif "harassment" in k:
                            flagged_cats.append("targeted_harassment")
                        elif "hate" in k:
                            flagged_cats.append("hate_speech_and_humiliation")
                        elif "violence" in k or "self-harm" in k:
                            flagged_cats.append("severe_safety_violation")
                        else:
                            flagged_cats.append(k)

                return ModerationResult(
                    decision="reject",
                    flagged=True,
                    categories=list(set(flagged_cats)),
                    confidence=0.99,
                    reason="Contenu signalé par l'API officielle OpenAI Moderation.",
                    provider=self.provider_name,
                    model=self.moderation_model,
                )
            return None
        except Exception as e:
            logger.warning(f"[OpenAI Moderation API] Check failed: {e}")
            return None

    def moderate_content(
        self, text: str, context: Optional[dict[str, Any]] = None
    ) -> ModerationResult:
        # Check dedicated OpenAI Moderation API endpoint first
        api_mod = self.check_moderation_api(text)
        if api_mod and api_mod.flagged:
            return api_mod

        # Contextual policy classification prompt
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
        raw = self._chat_completion(system, f"Content to moderate:\n\"\"\"{text[:4000]}\"\"\"")
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
        system = (
            f"You are the Kodinga AI Community Guide.\n"
            f"CRITICAL RULES:\n"
            f"1. Only recommend communities present in the candidates list. Do NOT invent new ones.\n"
            f"2. For each recommendation, provide an insightful 'relevance_reason' explaining why it matches the user.\n"
            f"3. Respond in {lang_instruction}.\n"
            f"4. Respond strictly in valid JSON format."
        )
        user_prompt = (
            f"User interests: \"{interests}\"\n\n"
            f"Candidate communities:\n{candidates_json}\n\n"
            f'Schema:\n{{\n'
            f'  "recommendations": [\n'
            f'    {{"id": "str", "name": "str", "slug": "str", "tagline": "str", "description": "str", '
            f'      "category": "str", "privacy_type": "str", "pricing_type": "str", "members_count": 10, '
            f'      "language": "str", "relevance_reason": "str", "match_score": 0.95}}\n'
            f'  ],\n'
            f'  "reasoning": "Overview explanation",\n'
            f'  "suggested_alternatives": ["alternative 1", "alternative 2"]\n'
            f'}}'
        )
        raw = self._chat_completion(system, user_prompt)
        data = self._clean_json_response(raw)
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

    def plan_community(
        self,
        idea: str,
        language: str = "fr",
        context: Optional[dict[str, Any]] = None,
    ) -> CommunityProposalResult:
        lang_instruction = self._get_lang_prompt(language)
        system = (
            f"You are the Kodinga Community Builder Assistant.\n"
            f"Transform community concepts into structured, actionable proposals.\n"
            f"Respond in {lang_instruction}.\n"
            f"Respond strictly in valid JSON format."
        )
        user_prompt = (
            f"User community idea: \"{idea}\"\n"
            f"Context: {json.dumps(context or {}, ensure_ascii=False)}\n\n"
            f'Schema:\n{{\n'
            f'  "name_suggestions": ["name1", "name2", "name3"],\n'
            f'  "description": "Full description",\n'
            f'  "purpose": "Mission",\n'
            f'  "target_audience": "Audience",\n'
            f'  "suggested_categories": ["#general", "#annonces", "#projets", "#entraide"],\n'
            f'  "suggested_rules": ["rule 1", "rule 2"],\n'
            f'  "recommended_language": "fr",\n'
            f'  "recommended_visibility": "public",\n'
            f'  "welcome_message": "Welcome message",\n'
            f'  "first_discussion_prompts": ["Prompt 1", "Prompt 2", "Prompt 3"],\n'
            f'  "initial_event_ideas": ["Event 1", "Event 2"],\n'
            f'  "first_week_launch_plan": [\n'
            f'    {{"day": "Jour 1", "focus": "Bienvenue", "action_items": ["Action 1", "Action 2"]}}\n'
            f'  ],\n'
            f'  "follow_up_questions": []\n'
            f'}}'
        )
        raw = self._chat_completion(system, user_prompt)
        data = self._clean_json_response(raw)
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

    def suggest_content(
        self,
        community_info: dict[str, Any],
        goal: Optional[str] = None,
        language: str = "fr",
    ) -> ContentSuggestionResult:
        lang_instruction = self._get_lang_prompt(language)
        system = (
            f"You are the Kodinga Community Assistant.\n"
            f"Suggest actionable content, activities, and events.\n"
            f"Respond in {lang_instruction}.\n"
            f"Respond strictly in valid JSON format."
        )
        user_prompt = (
            f"Community info: {json.dumps(community_info, ensure_ascii=False)}\n"
            f"Goal: {goal or 'Encourager la participation et les échanges'}\n\n"
            f'Schema:\n{{\n'
            f'  "discussion_categories": ["#general", "#showcase", "#aide", "#opportunites"],\n'
            f'  "first_post": {{"title": "Titre", "content": "Corps", "type": "discussion"}},\n'
            f'  "weekly_activities": [{{"title": "Activité", "description": "Détail"}}],\n'
            f'  "monthly_events": [{{"title": "Événement", "format": "online", "description": "Détail"}}],\n'
            f'  "onboarding_prompt": "Texte d\'accueil",\n'
            f'  "weekly_content_calendar": [{{"day": "Lundi", "topic": "Partage de code", "type": "post"}}]\n'
            f'}}'
        )
        raw = self._chat_completion(system, user_prompt)
        data = self._clean_json_response(raw)
        return ContentSuggestionResult(
            discussion_categories=data.get("discussion_categories", []),
            first_post=data.get("first_post", {}),
            weekly_activities=data.get("weekly_activities", []),
            monthly_events=data.get("monthly_events", []),
            onboarding_prompt=data.get("onboarding_prompt", ""),
            weekly_content_calendar=data.get("weekly_content_calendar", []),
            provider=self.provider_name,
        )

    def analyze_community(
        self,
        community_info: dict[str, Any],
        metrics: dict[str, Any],
        language: str = "fr",
    ) -> CommunityAnalysisResult:
        lang_instruction = self._get_lang_prompt(language)
        system = (
            f"You are the Kodinga Community Improvement Analyst.\n"
            f"Analyze real community data and metrics objectively.\n"
            f"Do not fabricate numbers. Distinguish recommendations from actions.\n"
            f"Respond in {lang_instruction}.\n"
            f"Respond strictly in valid JSON format."
        )
        user_prompt = (
            f"Community: {json.dumps(community_info, ensure_ascii=False)}\n"
            f"Real Metrics: {json.dumps(metrics, ensure_ascii=False)}\n\n"
            f'Schema:\n{{\n'
            f'  "community_name": "{community_info.get("name", "")}",\n'
            f'  "overview_assessment": "Diagnostic",\n'
            f'  "strengths": ["Strength 1"],\n'
            f'  "improvement_areas": ["Area 1"],\n'
            f'  "actionable_recommendations": [\n'
            f'    {{"category": "engagement", "title": "Titre", "action_draft": "Draft", "rationale": "Why"}}\n'
            f'  ],\n'
            f'  "event_suggestions": ["Event 1"],\n'
            f'  "engagement_tactics": ["Tactic 1"],\n'
            f'  "metrics_summary": {json.dumps(metrics, ensure_ascii=False)}\n'
            f'}}'
        )
        raw = self._chat_completion(system, user_prompt)
        data = self._clean_json_response(raw)
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

    def assistant_chat(
        self,
        message: str,
        history: list,
        context: Optional[dict[str, Any]] = None,
        language: str = "fr",
    ) -> AssistantChatResult:
        lang_instruction = self._get_lang_prompt(language)
        system = (
            f"You are the Kodinga AI Community Assistant.\n"
            f"Respond in {lang_instruction}.\n"
            f"Respond strictly in valid JSON format."
        )
        user_prompt = (
            f"Context: {json.dumps(context or {}, ensure_ascii=False)}\n"
            f"History: {json.dumps(history, ensure_ascii=False)}\n\n"
            f"Message: \"{message}\"\n\n"
            f'Schema:\n{{\n'
            f'  "reply": "Response text",\n'
            f'  "suggested_follow_ups": ["Follow up 1", "Follow up 2"],\n'
            f'  "suggested_action": null,\n'
            f'  "data": null\n'
            f'}}'
        )
        raw = self._chat_completion(system, user_prompt)
        data = self._clean_json_response(raw)
        return AssistantChatResult(
            reply=data.get("reply", raw),
            suggested_follow_ups=data.get("suggested_follow_ups", []),
            suggested_action=data.get("suggested_action"),
            data=data.get("data"),
            provider=self.provider_name,
        )

    def generate_embedding(self, text: str) -> list[float]:
        if getattr(settings, "IS_TESTING", False):
            return self._deterministic_embedding(text)
        try:
            client = self._get_client()
            res = client.embeddings.create(
                model="text-embedding-3-small",
                input=text,
            )
            if res.data and len(res.data) > 0:
                return [float(x) for x in res.data[0].embedding]
        except Exception as e:
            logger.warning(f"OpenAI embedding API call failed: {e}. Falling back to deterministic embedding.")
        
        return self._deterministic_embedding(text)

    def _deterministic_embedding(self, text: str, dim: int = 128) -> list[float]:
        words = text.lower().split()
        vec = [0.0] * dim
        for _i, word in enumerate(words):
            h = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
            idx = h % dim
            val = ((h >> 8) % 1000) / 500.0 - 1.0
            vec[idx] += val
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        return [round(x / norm, 6) for x in vec]
