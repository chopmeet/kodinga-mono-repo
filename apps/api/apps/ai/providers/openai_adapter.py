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
        self.model_name = model_name or getattr(
            settings, "OPENAI_TEXT_MODEL", "gpt-4o-mini"
        )
        self.moderation_model = moderation_model or getattr(
            settings, "OPENAI_MODERATION_MODEL", "omni-moderation-latest"
        )
        self.timeout_ms = timeout_ms or getattr(
            settings, "AI_PROVIDER_TIMEOUT_MS", 15000
        )
        self._client = None

    @property
    def provider_name(self) -> str:
        return "openai"

    def _get_client(self):
        if not self._client:
            effective_key = (
                self.api_key
                if self._explicit_key
                else getattr(settings, "OPENAI_API_KEY", "")
            )
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

    def _generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        max_tokens: Optional[int] = None,
        max_output_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        response_format: Optional[dict[str, Any]] = None,
        **kwargs,
    ) -> str:
        client = self._get_client()
        limit = max_tokens or max_output_tokens
        temp = temperature if temperature is not None else 0.2

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        create_kwargs: dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "temperature": temp,
        }
        if limit:
            create_kwargs["max_tokens"] = limit
        if response_format:
            create_kwargs["response_format"] = response_format

        try:
            response = client.chat.completions.create(**create_kwargs)
            return response.choices[0].message.content or ""
        except Exception as e:
            self._handle_openai_error(e)

    def detect_language(self, text: str) -> LanguageDetectionResult:
        system = (
            "You are a professional linguistic classifier. Identify the language of the provided text. "
            "Supported languages include French ('fr'), English ('en'), Wolof ('wo'), Bambara ('bm'), "
            "or standard ISO 639-1 code. Return strictly valid JSON with keys: language_code, confidence, name."
        )
        raw = self._chat_completion(system, f'Text to classify:\n"""{text[:2000]}"""')
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
            f'3. Return strictly valid JSON: {{"translated_text": "...", "source_language": "...", "target_language": "{target_lang}", "confidence": 0.95}}'
        )
        prompt = f'Source language: {source_lang or "auto"}\nTarget language: {target_lang}\n\nContent:\n"""{text}"""'
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
            'Return strictly valid JSON: {"sentiment": "...", "score": 0.0, "confidence": 0.95, "reason": "..."}'
        )
        raw = self._chat_completion(system, f'Text to analyze:\n"""{text[:3000]}"""')
        data = self._clean_json_response(raw)

        sentiment_val = str(data.get("sentiment", "neutral")).lower()
        if sentiment_val not in [
            "positive",
            "neutral",
            "negative",
            "mixed",
            "uncertain",
        ]:
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
            '3. Return strictly valid JSON: {"decision": "allow"|"reject"|"review", "flagged": boolean, "categories": [...], "confidence": 0.98, "reason": "..."}'
        )
        raw = self._chat_completion(
            system, f'Content to moderate:\n"""{text[:4000]}"""'
        )
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
        mandatory_violations = [
            c for c in mod_result.categories if c in mandatory_categories
        ]
        community_violations = [
            c for c in mod_result.categories if c not in mandatory_categories
        ]

        violates_mandatory = (
            len(mandatory_violations) > 0 or mod_result.decision == "reject"
        )
        violates_community = len(community_violations) > 0

        final_decision = (
            "reject"
            if violates_mandatory
            else ("review" if violates_community else "allow")
        )

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
            f'User interests: "{interests}"\n\n'
            f"Candidate communities:\n{candidates_json}\n\n"
            f"Schema:\n{{\n"
            f'  "recommendations": [\n'
            f'    {{"id": "str", "name": "str", "slug": "str", "tagline": "str", "description": "str", '
            f'      "category": "str", "privacy_type": "str", "pricing_type": "str", "members_count": 10, '
            f'      "language": "str", "relevance_reason": "str", "match_score": 0.95}}\n'
            f"  ],\n"
            f'  "reasoning": "Overview explanation",\n'
            f'  "suggested_alternatives": ["alternative 1", "alternative 2"]\n'
            f"}}"
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
            f'User community idea: "{idea}"\n'
            f"Context: {json.dumps(context or {}, ensure_ascii=False)}\n\n"
            f"Schema:\n{{\n"
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
            f"  ],\n"
            f'  "follow_up_questions": []\n'
            f"}}"
        )
        raw = self._chat_completion(system, user_prompt)
        data = self._clean_json_response(raw)
        plan_items = [
            FirstWeekPlanItem(**item) for item in data.get("first_week_launch_plan", [])
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
            f"Schema:\n{{\n"
            f'  "discussion_categories": ["#general", "#showcase", "#aide", "#opportunites"],\n'
            f'  "first_post": {{"title": "Titre", "content": "Corps", "type": "discussion"}},\n'
            f'  "weekly_activities": [{{"title": "Activité", "description": "Détail"}}],\n'
            f'  "monthly_events": [{{"title": "Événement", "format": "online", "description": "Détail"}}],\n'
            f'  "onboarding_prompt": "Texte d\'accueil",\n'
            f'  "weekly_content_calendar": [{{"day": "Lundi", "topic": "Partage de code", "type": "post"}}]\n'
            f"}}"
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
            f"Schema:\n{{\n"
            f'  "community_name": "{community_info.get("name", "")}",\n'
            f'  "overview_assessment": "Diagnostic",\n'
            f'  "strengths": ["Strength 1"],\n'
            f'  "improvement_areas": ["Area 1"],\n'
            f'  "actionable_recommendations": [\n'
            f'    {{"category": "engagement", "title": "Titre", "action_draft": "Draft", "rationale": "Why"}}\n'
            f"  ],\n"
            f'  "event_suggestions": ["Event 1"],\n'
            f'  "engagement_tactics": ["Tactic 1"],\n'
            f'  "metrics_summary": {json.dumps(metrics, ensure_ascii=False)}\n'
            f"}}"
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

    def _build_instant_assistant_response(
        self,
        message: str,
        context: Optional[dict[str, Any]] = None,
        language: str = "fr",
    ) -> Optional[AssistantChatResult]:
        """
        Ultra-low-latency (<5ms) automatic responder for common Kodinga assistant intents:
        - Community discovery & grounded recommendations
        - Community creation & launch planning
        - First post / onboarding ideas
        - Boosting community participation & weekly activities
        - Greetings & quick platform guidance
        """
        msg = (message or "").strip()
        lower = msg.lower()
        lang = (language or "fr").lower()
        ctx = context or {}

        # 0A. SOURCE C: Authorized Private Community Content (Courses, Modules, Lessons)
        private_ctx = ctx.get("authorized_private_content")
        if (
            private_ctx
            and isinstance(private_ctx, dict)
            and private_ctx.get("authorized")
        ):
            comm_name = private_ctx.get("community_name") or "votre communauté"
            modules = private_ctx.get("modules") or []
            courses = private_ctx.get("courses") or []
            if modules:
                mod_lines = []
                for idx, m in enumerate(modules, 1):
                    lessons_list = m.get("lessons") or []
                    lessons_str = (
                        f" — Leçons : {', '.join(lessons_list)}" if lessons_list else ""
                    )
                    mod_lines.append(
                        f"{idx}. **{m['module_title']}** *(Cours : {m['course_title']})*{lessons_str}"
                    )
                reply_text = (
                    f"Voici les modules de formation disponibles dans la communauté **{comm_name}** :\n\n"
                    + "\n".join(mod_lines)
                    + "\n\nVous pouvez y accéder directement depuis l'onglet **Classroom** de la communauté."
                )
            elif courses:
                course_lines = [
                    f"- **{c['title']}** ({c.get('level', 'Tous niveaux')})"
                    for c in courses
                ]
                reply_text = (
                    f"Voici les cours disponibles dans la communauté **{comm_name}** :\n\n"
                    + "\n".join(course_lines)
                )
            else:
                reply_text = f"La communauté **{comm_name}** ne contient actuellement aucun module ou cours publié dans son Classroom."

            return AssistantChatResult(
                reply=reply_text,
                suggested_follow_ups=[
                    "Comment suivre ma progression dans le Classroom ?",
                    f"À quoi sert la communauté {comm_name} ?",
                    "Quelles sont les dernières discussions de la communauté ?",
                ],
                suggested_action="open_classroom",
                data={"private_content": private_ctx},
                provider=self.provider_name,
            )

        # 0B. SOURCE B: Dynamic Community Information (Member count, Presentation, Access type)
        dyn_comm = ctx.get("dynamic_community_data")
        if dyn_comm and isinstance(dyn_comm, dict) and dyn_comm.get("details"):
            details = dyn_comm["details"]
            comm_name = details.get("name", "")
            members_count = details.get("members_count", 0)
            tagline = details.get("tagline") or ""
            description = (
                details.get("description")
                or tagline
                or "Aucune description renseignée."
            )
            pricing_label = (
                "Gratuite"
                if details.get("pricing_type") == "free"
                else "Payante (sur abonnement)"
            )
            privacy_label = (
                "Publique" if details.get("privacy_type") == "public" else "Privée"
            )

            if any(
                w in lower
                for w in [
                    "combien de membres",
                    "nombre de membres",
                    "membres possède",
                    "membres compte",
                ]
            ):
                reply_text = (
                    f"La communauté **{comm_name}** compte actuellement **{members_count} membre(s)** "
                    f"(donnée récupérée en temps réel depuis la plateforme).\n\n"
                    f"- **Accès** : {privacy_label} ({pricing_label})\n"
                    f"- **Catégorie** : {details.get('category', 'Général')}"
                )
            elif any(
                w in lower
                for w in [
                    "à quoi sert",
                    "présentation",
                    "à propos",
                    "description",
                    "objectif",
                    "but",
                ]
            ):
                reply_text = (
                    f"**Présentation de la communauté {comm_name}** :\n\n"
                    f"- **Accroche** : {tagline or 'Communauté Kodinga'}\n"
                    f"- **À propos** : {description}\n"
                    f"- **Catégorie** : {details.get('category', 'Général')}\n"
                    f"- **Type d'accès** : {privacy_label} — {pricing_label}\n"
                    f"- **Membres actifs** : {members_count} membre(s)"
                )
            else:
                reply_text = (
                    f"Voici les informations actuelles sur la communauté **{comm_name}** :\n\n"
                    f"- **Description** : {description}\n"
                    f"- **Nombre de membres** : {members_count} membre(s)\n"
                    f"- **Type d'accès** : {privacy_label} ({pricing_label})\n"
                    f"- **Propriétaire** : @{details.get('owner_username', 'kodinga')}"
                )

            return AssistantChatResult(
                reply=reply_text,
                suggested_follow_ups=[
                    f"Comment rejoindre la communauté {comm_name} ?",
                    "Quelles autres communautés sont disponibles ?",
                    "Comment créer ma propre communauté ?",
                ],
                suggested_action="view_community",
                data={"community": details},
                provider=self.provider_name,
            )

        # 0C. SOURCE A: Official Documentation procedure for "Comment créer une communauté ?"
        official_docs = ctx.get("official_documentation") or []
        if (
            official_docs
            and "comment" in lower
            and any(w in lower for w in ["créer", "lancer", "gérer"])
            and "communauté" in lower
        ):
            doc = official_docs[0]
            return AssistantChatResult(
                reply=(
                    f"D'après la documentation officielle de Kodinga (**{doc.get('title')}**, v{doc.get('version', '1.0')}) :\n\n"
                    f"{doc.get('content', '')}\n\n"
                    f"Vous pouvez démarrer immédiatement depuis la page de création de communauté (`/communities/create`)."
                ),
                suggested_follow_ups=[
                    "Génère-moi un plan de lancement pour ma communauté",
                    "Quelle est la différence entre communauté publique, privée et secrète ?",
                    "Comment configurer un abonnement payant avec PayDunya ?",
                ],
                suggested_action="create_community",
                data={"documentation": doc},
                provider=self.provider_name,
            )

        # 1. Intent: Community Creation / Launch Plan
        is_creation = any(
            w in lower
            for w in [
                "créer",
                "lancer",
                "création",
                "fond",
                "bâtir",
                "create",
                "launch",
                "build",
            ]
        ) and any(
            w in lower
            for w in ["communauté", "groupe", "espace", "club", "community", "group"]
        )
        if is_creation:
            topic = "Tech & Innovation"
            if "python" in lower or "ia" in lower or "ai" in lower or "data" in lower:
                topic = "IA, Data & Python"
            elif "design" in lower or "ui" in lower or "ux" in lower:
                topic = "Design & Produit"
            elif "business" in lower or "entrepreneur" in lower or "startup" in lower:
                topic = "Entrepreneuriat & Startups"
            elif "web" in lower or "react" in lower or "dev" in lower:
                topic = "Développement Web & Mobile"

            proposal_data = {
                "name_suggestions": [
                    f"Kodinga {topic} Hub",
                    f" collectif {topic} Afrique".strip().title(),
                    f"Cercle {topic} Pro",
                ],
                "description": (
                    f"Communauté dédiée aux passionnés et professionnels autour de {topic} : "
                    f"partage de projets, entraide technique, mentorat et opportunités."
                ),
                "purpose": f"Fédérer, former et connecter les talents autour de {topic}.",
                "target_audience": "Développeurs, étudiants, créateurs et professionnels du secteur",
                "suggested_categories": [
                    "#annonces",
                    "#présentations",
                    "#entraide-technique",
                    "#projets-et-démos",
                    "#opportunités",
                ],
                "suggested_rules": [
                    "Bienveillance et respect mutuel en toutes circonstances",
                    "Partage constructif : pas de spam ni d'autopromotion excessive",
                    "Aider les nouveaux membres et documenter les solutions",
                ],
                "recommended_language": lang
                if lang in ["fr", "en", "wo", "bm"]
                else "fr",
                "recommended_visibility": "public",
                "welcome_message": (
                    f"Bienvenue dans la communauté {topic} ! Présentez-vous en quelques lignes : "
                    f"votre parcours, vos projets actuels et ce que vous souhaitez apprendre."
                ),
                "first_discussion_prompts": [
                    "Quel est le projet sur lequel vous travaillez cette semaine ?",
                    "Quel outil ou ressource vous a le plus aidé récemment ?",
                    "Quel défi technique cherchez-vous à résoudre ce mois-ci ?",
                ],
                "initial_event_ideas": [
                    "Session Live : Café d'accueil & networking des membres fondateurs",
                    "Atelier pratique / Démo de projet en direct (45 min)",
                ],
                "first_week_launch_plan": [
                    {
                        "day": "Jour 1",
                        "focus": "Configuration & Message d'accueil",
                        "action_items": [
                            "Épingler le post de bienvenue",
                            "Créer les 4 canaux principaux",
                        ],
                    },
                    {
                        "day": "Jour 3",
                        "focus": "Invitation des pionniers",
                        "action_items": [
                            "Inviter 10 à 15 membres fondateurs actifs",
                            "Lancer la première question brise-glace",
                        ],
                    },
                    {
                        "day": "Jour 7",
                        "focus": "Premier événement live",
                        "action_items": [
                            "Planifier un premier appel communautaire de 30 minutes",
                        ],
                    },
                ],
                "follow_up_questions": [],
            }

            reply_map = {
                "en": (
                    f"Great initiative! Here is an instant launch blueprint for your **{topic}** community:\n\n"
                    f"1. **Clear Identity**: Choose a memorable name and a concrete mission.\n"
                    f"2. **Simple Structure**: Start with `#welcome`, `#help`, and `#projects`.\n"
                    f"3. **Founding Momentum**: Invite 10 founding members before opening widely.\n\n"
                    f"You can review and launch this proposal directly from the card below!"
                ),
                "wo": (
                    f"Xalaat bu rafet la ! Lii moy sa plan ngir sos mbooloo **{topic}** ci Kodinga :\n"
                    f"- Tekkal tur wu leer ak yoon wu jub.\n"
                    f"- Tambalil ak `#dalal-jamm`, `#ndimbal`, ak `#projets`.\n"
                    f"Mën nga ko jariñoo ci suuf !"
                ),
                "bm": (
                    f"Hakilinaumanba don ! Nin yeɲɛbilasira ye ka **{topic}** jɛkulu da Kodinga kan :\n"
                    f"- Tɔgɔɲuman sugandi.\n"
                    f"- Daminɛ ni `#bisimila`, `#dɛmɛ`, ani `#baara` ye."
                ),
            }
            reply_text = reply_map.get(
                lang,
                (
                    f"Excellente initiative ! Voici un plan clé en main pour lancer votre communauté **{topic}** :\n\n"
                    f"1. **Positionnement clair** : Une mission orientée pratique et entraide.\n"
                    f"2. **Canaux essentiels** : `#présentations`, `#entraide-technique`, `#projets-et-démos` et `#opportunités`.\n"
                    f"3. **Démarrage rapide** : Accueillez vos 10 premiers membres avec un post brise-glace épinglé.\n\n"
                    f"Consultez la proposition détaillée ci-dessous pour lancer la création en un clic."
                ),
            )
            return AssistantChatResult(
                reply=reply_text,
                suggested_follow_ups=[
                    "Rédige le premier post de bienvenue",
                    "Quelles activités hebdomadaires organiser ?",
                    "Comment attirer mes 50 premiers membres ?",
                ],
                suggested_action="create_community",
                data={"proposal": proposal_data},
                provider=self.provider_name,
            )

        # 2. Intent: Community Discovery / Recommendations
        is_discovery = ctx.get("intent") == "COMMUNITY_DISCOVERY" or any(
            w in lower
            for w in [
                "recommande",
                "conseille",
                "cherche",
                "trouve",
                "trouver",
                "découvrir",
                "rejoindre",
                "quelles communautés",
                "communautés gratuites",
                "communautés payantes",
                "communautés disponibles",
                "recommend",
                "find",
                "discover",
            ]
        )
        if is_discovery:
            public_list = ctx.get("available_public_communities") or []
            keywords = [
                w
                for w in re.findall(r"\w+", lower)
                if len(w) > 2
                and w
                not in {
                    "les",
                    "des",
                    "une",
                    "pour",
                    "dans",
                    "avec",
                    "sur",
                    "que",
                    "qui",
                    "quelles",
                    "communautés",
                    "communaute",
                    "gratuites",
                    "gratuite",
                    "gratuit",
                    "payantes",
                    "payante",
                    "payant",
                    "disponibles",
                    "disponible",
                    "sont",
                    "conseilles",
                    "recommande",
                    "cherche",
                    "trouver",
                    "veux",
                    "moi",
                }
            ]

            scored = []
            for c in public_list:
                cat_name = c.get("category") or c.get("category__name") or ""
                haystack = f"{c.get('name', '')} {c.get('tagline', '')} {c.get('description', '')} {cat_name}".lower()
                hits = sum(1 for kw in keywords if kw in haystack)
                scored.append((hits, c.get("members_count", 0), c))

            scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
            selected = [item[2] for item in scored[:5]]

            cards = []
            for c in selected:
                cat_name = (
                    c.get("category") or c.get("category__name") or "Tech & Communauté"
                )
                cards.append(
                    {
                        "id": str(c.get("id", "")),
                        "name": c.get("name", ""),
                        "slug": c.get("slug", ""),
                        "tagline": c.get("tagline") or "Communauté active sur Kodinga",
                        "description": c.get("description") or c.get("tagline") or "",
                        "category": cat_name,
                        "privacy_type": c.get("privacy_type") or "public",
                        "pricing_type": c.get("pricing_type") or "free",
                        "members_count": c.get("members_count", 0),
                        "language": lang,
                        "relevance_reason": "Communauté active correspondant à votre recherche sur Kodinga.",
                        "match_score": 0.95,
                    }
                )

            if cards:
                bullet_lines = [
                    f"- **{c['name']}** ({c['members_count']} membre(s), {'gratuite' if c['pricing_type'] == 'free' else 'payante'}) : {c['tagline']}"
                    for c in cards
                ]
                reply_text = (
                    "Voici les communautés disponibles sur Kodinga correspondant à votre recherche :\n\n"
                    + "\n".join(bullet_lines)
                    + "\n\nCliquez sur **Découvrir** dans les cartes ci-dessous pour les rejoindre directement !"
                )
            else:
                reply_text = (
                    "Aucune communauté publique correspondant exactement à ces critères n'est disponible pour le moment sur Kodinga. "
                    "Vous pouvez toutefois explorer l'annuaire ou créer votre propre communauté !"
                )

            return AssistantChatResult(
                reply=reply_text,
                suggested_follow_ups=[
                    "Je veux créer ma propre communauté",
                    "Comment fonctionne une communauté sur Kodinga ?",
                    "Propose-moi une idée de premier post",
                ],
                suggested_action="explore_communities",
                data={"recommendations": cards} if cards else {"recommendations": []},
                provider=self.provider_name,
            )

        # 3. Intent: First Post / Welcome / Onboarding
        if any(
            w in lower
            for w in [
                "premier post",
                "accueillir",
                "bienvenue",
                "brise-glace",
                "welcome post",
                "first post",
            ]
        ):
            comm_name = (ctx.get("current_community") or {}).get(
                "name"
            ) or "notre communauté"
            return AssistantChatResult(
                reply=(
                    f"Voici un modèle de **premier post d'accueil** prêt à publier pour **{comm_name}** :\n\n"
                    f"---\n"
                    f"👋 **Bienvenue à toutes et à tous dans {comm_name} !**\n\n"
                    f"Ravi de vous compter parmi les membres. Pour faire connaissance, présentez-vous en commentaire :\n"
                    f"1. **Qui êtes-vous et d'où venez-vous ?**\n"
                    f"2. **Sur quel projet ou sujet travaillez-vous en ce moment ?**\n"
                    f"3. **Qu'aimeriez-vous apprendre ou partager ici ?**\n\n"
                    f"Hâte de lire vos présentations ! 🚀\n"
                    f"---"
                ),
                suggested_follow_ups=[
                    "Quelles activités hebdomadaires lancer ?",
                    "Comment dynamiser la participation des membres ?",
                    "Quelles règles de modération adopter ?",
                ],
                suggested_action=None,
                data=None,
                provider=self.provider_name,
            )

        # 4. Intent: Boost Participation / Engagement / Activities
        if any(
            w in lower
            for w in [
                "dynamiser",
                "participation",
                "engag",
                "animer",
                "activité",
                "activite",
                "hebdomadaire",
            ]
        ):
            return AssistantChatResult(
                reply=(
                    "Voici **3 rituels simples et ultra-efficaces** pour dynamiser votre communauté dès cette semaine :\n\n"
                    "1. **Lundi Objectifs (#check-in)** : Chaque membre partage en 1 phrase sa priorité de la semaine.\n"
                    "2. **Mercredi Feedback / Démo (#showcase)** : Les membres montrent une avancée, un code ou une maquette pour recevoir des retours bienveillants.\n"
                    "3. **Vendredi Victoires & Ressources (#partage)** : Partagez la meilleure astuce ou réussite de la semaine et identifiez 3 membres pour lancer la discussion."
                ),
                suggested_follow_ups=[
                    "Rédige le post du Lundi Objectifs",
                    "Propose une idée d'événement en ligne",
                    "Comment accueillir mes premiers membres ?",
                ],
                suggested_action=None,
                data=None,
                provider=self.provider_name,
            )

        # 5. Intent: Greetings & Short Help
        if len(lower) <= 35 and any(
            w in lower
            for w in [
                "bonjour",
                "salut",
                "hello",
                "hi",
                "bonsoir",
                "coucou",
                "nanga def",
                "na nga def",
                "aw ni sogoma",
                "aide",
                "help",
            ]
        ):
            greetings = {
                "en": "Hello! I am your Kodinga AI Assistant (powered by OpenAI). I can help you find communities, launch your own space, or write engaging posts. What would you like to do?",
                "wo": "Na nga def ! Dalal ak jamm ci Kodinga. Man la sa Assistant IA. Mën naa la dimbali nga gis mbooloo walla nga sos sa bos. Lan nga bëgg def tey ?",
                "bm": "Aw ni ce ! Bisimila Kodinga kan. Ne ye i ka IA dɛmɛbaga ye. Ne bɛ se ka i dɛmɛ ka jɛkuluwɲini walima ka i ta da. Mun bɛ i kɔnɔ bi ?",
            }
            return AssistantChatResult(
                reply=greetings.get(
                    lang,
                    "Bonjour ! Je suis votre Assistant Kodinga propulsé par OpenAI. Je peux vous recommander des communautés, générer un plan de création ou rédiger vos publications en un instant. Que souhaitez-vous faire ?",
                ),
                suggested_follow_ups=[
                    "Quelles communautés me conseilles-tu ?",
                    "Je veux lancer une communauté tech en Afrique",
                    "Idée de premier post pour engager les membres",
                ],
                suggested_action=None,
                data=None,
                provider=self.provider_name,
            )

        return None

    def assistant_chat(
        self,
        message: str,
        history: list,
        context: Optional[dict[str, Any]] = None,
        language: str = "fr",
    ) -> AssistantChatResult:
        from apps.ai.services.platform_knowledge_service import (
            KODINGA_OFFICIAL_SYSTEM_PROMPT,
            MISSING_INFORMATION_TEXT,
        )

        # 1. Instant local / grounded response (<5ms) for dynamic data & common assistant intents
        instant = self._build_instant_assistant_response(
            message=message, context=context, language=language
        )
        if instant is not None:
            return instant

        ctx = context or {}
        has_dynamic_context = any(
            k in ctx
            for k in (
                "dynamic_community_data",
                "authorized_private_content",
                "available_public_communities",
            )
        )

        # 2. Check short-lived cache only for static documentation queries
        from django.core.cache import cache

        comm_slug = (ctx.get("current_community") or {}).get("slug", "")
        docs_ver = ",".join(
            f"{d.get('slug')}:{d.get('version')}"
            for d in (ctx.get("official_documentation") or [])
        )
        cache_seed = f"asst_openai_v3:{language}:{comm_slug}:{docs_ver}:{message.strip().lower()}"
        cache_key = "ai_chat_" + hashlib.md5(cache_seed.encode("utf-8")).hexdigest()
        if not has_dynamic_context:
            cached_payload = cache.get(cache_key)
            if cached_payload and isinstance(cached_payload, dict):
                return AssistantChatResult(
                    reply=cached_payload.get("reply", ""),
                    suggested_follow_ups=cached_payload.get("suggested_follow_ups", []),
                    suggested_action=cached_payload.get("suggested_action"),
                    data=cached_payload.get("data"),
                    provider=self.provider_name,
                )

        # 3. Grounded OpenAI completion with official Kodinga System Prompt & isolated <platform_context>
        lang_instruction = self._get_lang_prompt(language)
        compact_history = (history or [])[-4:]
        grounded_ctx = {
            k: v
            for k, v in ctx.items()
            if k
            in (
                "username",
                "current_community",
                "preferred_language",
                "intent",
                "official_documentation",
                "dynamic_community_data",
                "available_public_communities",
                "authorized_private_content",
            )
        }
        system = (
            f"{KODINGA_OFFICIAL_SYSTEM_PROMPT}\n\n"
            f"LANGUE DE RÉPONSE : {lang_instruction}.\n"
            f"FORMAT DE SORTIE : Retourne strictement un objet JSON valide :\n"
            f'{{"reply":"...","suggested_follow_ups":["q1","q2"]}}'
        )
        user_prompt = (
            f"<platform_context>\n{json.dumps(grounded_ctx, ensure_ascii=False)}\n</platform_context>\n"
            f"<conversation_history>\n{json.dumps(compact_history, ensure_ascii=False)}\n</conversation_history>\n"
            f"Question de l'utilisateur : {message}"
        )

        client = self._get_client()
        try:
            response = client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=320,
                response_format={"type": "json_object"},
                timeout=3.5,
            )
            raw = response.choices[0].message.content or "{}"
            data = self._clean_json_response(raw)
            result = AssistantChatResult(
                reply=data.get("reply", raw),
                suggested_follow_ups=data.get("suggested_follow_ups", [])[:3],
                suggested_action=data.get("suggested_action"),
                data=data.get("data"),
                provider=self.provider_name,
            )
            if not has_dynamic_context:
                cache.set(
                    cache_key,
                    {
                        "reply": result.reply,
                        "suggested_follow_ups": result.suggested_follow_ups,
                        "suggested_action": result.suggested_action,
                        "data": result.data,
                    },
                    timeout=300,
                )
            return result
        except Exception as e:
            logger.warning(f"[OpenAI Assistant] Grounded fallback triggered ({e})")
            official_docs = ctx.get("official_documentation") or []
            if official_docs:
                top_doc = official_docs[0]
                return AssistantChatResult(
                    reply=(
                        f"D'après la documentation officielle de Kodinga (**{top_doc.get('title')}**) :\n\n"
                        f"{top_doc.get('content', top_doc.get('summary', ''))}"
                    ),
                    suggested_follow_ups=[
                        "Comment créer une communauté sur Kodinga ?",
                        "Quelles communautés gratuites sont disponibles ?",
                        "Comment fonctionnent les abonnements PayDunya ?",
                    ],
                    suggested_action=None,
                    data={"documentation": top_doc},
                    provider=self.provider_name,
                )

            return AssistantChatResult(
                reply=MISSING_INFORMATION_TEXT,
                suggested_follow_ups=[
                    "Quelles sont les fonctionnalités de Kodinga ?",
                    "Comment créer une communauté ?",
                    "Quelles communautés gratuites sont disponibles ?",
                ],
                suggested_action=None,
                data=None,
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
                dimensions=768,
            )
            if res.data and len(res.data) > 0:
                return [float(x) for x in res.data[0].embedding]
        except Exception as e:
            logger.warning(
                f"OpenAI embedding API call failed: {e}. Falling back to deterministic embedding."
            )

        return self._deterministic_embedding(text)

    def _deterministic_embedding(self, text: str, dim: int = 768) -> list[float]:
        words = text.lower().split()
        vec = [0.0] * dim
        for _i, word in enumerate(words):
            h = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
            idx = h % dim
            val = ((h >> 8) % 1000) / 500.0 - 1.0
            vec[idx] += val
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        return [round(x / norm, 6) for x in vec]
