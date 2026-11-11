import logging
from datetime import timedelta
from typing import Any, Optional

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.ai.models.assistant import AssistantConversation, AssistantMessage
from apps.ai.router import AIProviderStrategy, ai_router
from apps.ai.schemas import (
    AssistantChatResult,
    CommunityAnalysisResult,
    CommunityProposalResult,
    CommunityRecommendationCard,
    CommunityRecommendationResult,
    ContentSuggestionResult,
)
from apps.ai.services.moderation_service import ModerationService
from apps.ai.services.platform_knowledge_service import (
    MISSING_INFORMATION_TEXT,
    OUT_OF_SCOPE_REFUSAL_TEXT,
    AssistantIntent,
    CommunityDynamicDataService,
    CommunityPrivateContentService,
    PlatformDocumentationRAGService,
    PlatformIntentClassifier,
    build_private_content_denied_text,
)
from apps.communities.models.community import Community, CommunityPrivacy
from apps.events.models.event import Event
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.posts.models.post import Post, PostType
from common.permissions.base import is_superadmin_user

logger = logging.getLogger(__name__)


class AIAssistantService:
    """
    Core service powering the Kodinga AI Community Assistant:
    - Grounded community discovery and recommendation.
    - Community creation planning and launch wizard.
    - Content, activity, and event generation.
    - Community health, engagement analysis, and improvement recommendations.
    - Multi-turn conversational chat with context retention.
    """

    @classmethod
    def _resolve_user_language(
        cls, user: Optional[User], requested_language: Optional[str] = None
    ) -> str:
        """Determines the preferred language: requested -> user profile -> default 'fr'."""
        if requested_language and requested_language in ["fr", "en", "wo", "bm"]:
            return requested_language
        if user and user.is_authenticated:
            profile = getattr(user, "developer_profile", None)
            if profile and getattr(profile, "preferred_language", None):
                return profile.preferred_language
        return "fr"

    @classmethod
    def _pre_moderate_input(cls, text: str, user: Optional[User] = None) -> None:
        """
        Ensures all inputs to the assistant comply with platform safety rules.
        Blocks sexual harassment, threats, and degrading bullying.
        """
        if not text or not text.strip():
            return
        ModerationService.enforce_pre_publication(text, author=user)

    # ==========================================================================
    # 1. GROUNDED COMMUNITY RECOMMENDATIONS
    # ==========================================================================

    @classmethod
    def recommend_communities(
        cls,
        interests: str,
        user: Optional[User] = None,
        language: Optional[str] = None,
        limit_candidates: int = 25,
    ) -> CommunityRecommendationResult:
        """
        Retrieves real accessible communities from the database, presents them to the AI,
        and returns grounded, personalized recommendations with relevance rationales.
        """
        cls._pre_moderate_input(interests, user=user)
        resolved_lang = cls._resolve_user_language(user, language)

        # 1. Build DB query for accessible communities
        user_joined_community_ids = set()
        if user and user.is_authenticated:
            user_joined_community_ids = set(
                CommunityMember.objects.filter(
                    user=user, status=MembershipStatus.ACTIVE
                ).values_list("community_id", flat=True)
            )

        # Visibility filter:
        # - Public: visible to all
        # - Private: visible in directory, allows join requests
        # - Secret: only visible if user is an accepted member
        q_filter = Q(is_active=True)
        if user and user.is_authenticated:
            if not is_superadmin_user(user):
                q_filter &= Q(
                    privacy_type__in=[CommunityPrivacy.PUBLIC, CommunityPrivacy.PRIVATE]
                ) | Q(id__in=user_joined_community_ids)
        else:
            q_filter &= Q(privacy_type=CommunityPrivacy.PUBLIC)

        # Keyword filtering to narrow down relevant candidates
        search_terms = [t.strip() for t in interests.split() if len(t.strip()) > 2]
        if search_terms:
            term_q = Q()
            for term in search_terms[:5]:
                term_q |= (
                    Q(name__icontains=term)
                    | Q(tagline__icontains=term)
                    | Q(description__icontains=term)
                    | Q(category__name__icontains=term)
                )
            candidate_qs = Community.objects.filter(q_filter).filter(term_q)
            # If search term gave too few results, fallback to general popular communities
            if candidate_qs.count() < 3:
                candidate_qs = Community.objects.filter(q_filter)
        else:
            candidate_qs = Community.objects.filter(q_filter)

        candidates = candidate_qs.select_related("category", "settings").order_by(
            "-members_count", "-created_at"
        )[:limit_candidates]

        if not candidates.exists():
            return CommunityRecommendationResult(
                recommendations=[],
                reasoning="Aucune communauté publique n'est actuellement disponible sur la plateforme.",
                suggested_alternatives=["Créer votre propre communauté sur ce sujet !"],
                provider="platform_grounded",
            )

        candidate_data = []
        candidates_by_id = {}
        for c in candidates:
            c_lang = "fr"
            if hasattr(c, "settings") and c.settings:
                c_lang = c.settings.default_community_language or "fr"

            c_dict = {
                "id": str(c.id),
                "name": c.name,
                "slug": c.slug,
                "tagline": c.tagline or "",
                "description": c.description[:300] if c.description else "",
                "category": c.category.name if c.category else "Général",
                "privacy_type": c.privacy_type,
                "pricing_type": c.pricing_type,
                "members_count": c.members_count,
                "language": c_lang,
                "is_already_member": c.id in user_joined_community_ids,
            }
            candidate_data.append(c_dict)
            candidates_by_id[str(c.id)] = c

        # 2. Call AI provider router (Gemini -> OpenAI fallback)
        ai_result = ai_router.recommend_communities(
            interests=interests,
            candidate_communities=candidate_data,
            language=resolved_lang,
        )

        # 3. Grounding Verification: Verify every recommended community exists in DB
        verified_recommendations = []
        for rec in ai_result.recommendations:
            # Check by ID or slug
            db_community = candidates_by_id.get(rec.id)
            if not db_community:
                db_community = Community.objects.filter(
                    slug=rec.slug, is_active=True
                ).first()

            if db_community:
                c_lang = "fr"
                if hasattr(db_community, "settings") and db_community.settings:
                    c_lang = db_community.settings.default_community_language or "fr"

                verified_card = CommunityRecommendationCard(
                    id=str(db_community.id),
                    name=db_community.name,
                    slug=db_community.slug,
                    tagline=db_community.tagline or rec.tagline,
                    description=db_community.description or rec.description,
                    category=db_community.category.name
                    if db_community.category
                    else rec.category,
                    privacy_type=db_community.privacy_type,
                    pricing_type=db_community.pricing_type,
                    members_count=db_community.members_count,
                    language=c_lang,
                    relevance_reason=rec.relevance_reason
                    or "Correspond à vos centres d'intérêt.",
                    match_score=rec.match_score,
                )
                verified_recommendations.append(verified_card)

        ai_result.recommendations = verified_recommendations
        return ai_result

    # ==========================================================================
    # 2. COMMUNITY CREATION WIZARD (PROPOSAL GENERATOR)
    # ==========================================================================

    @classmethod
    def plan_community(
        cls,
        idea: str,
        user: Optional[User] = None,
        language: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
    ) -> CommunityProposalResult:
        """
        Transforms a user's natural language concept into an actionable, editable community proposal.
        NEVER creates a community automatically. User must review and confirm.
        """
        clean_idea = (idea or "").strip()
        if not clean_idea:
            raise ValidationError("Veuillez décrire votre idée de communauté.")

        cls._pre_moderate_input(clean_idea, user=user)
        resolved_lang = cls._resolve_user_language(user, language)

        extra_context = context or {}
        if user and user.is_authenticated:
            extra_context["creator_username"] = user.username

        return ai_router.plan_community(
            idea=clean_idea,
            language=resolved_lang,
            context=extra_context,
        )

    # ==========================================================================
    # 3. CONTENT & ACTIVITY SUGGESTIONS
    # ==========================================================================

    @classmethod
    def suggest_content(
        cls,
        community_identifier: str,
        goal: Optional[str] = None,
        user: Optional[User] = None,
        language: Optional[str] = None,
    ) -> ContentSuggestionResult:
        """
        Suggests discussion categories, initial post drafts, weekly activities, and events
        grounded in the community's actual purpose and settings.
        """
        community = cls._get_community_with_access_check(community_identifier, user)
        resolved_lang = cls._resolve_user_language(user, language)

        existing_categories = list(
            community.post_categories.values_list("name", flat=True)
        )

        community_info = {
            "name": community.name,
            "slug": community.slug,
            "tagline": community.tagline or "",
            "description": community.description or "",
            "category": community.category.name if community.category else "Général",
            "members_count": community.members_count,
            "existing_categories": existing_categories,
        }

        return ai_router.suggest_content(
            community_info=community_info,
            goal=goal,
            language=resolved_lang,
        )

    # ==========================================================================
    # 4. COMMUNITY IMPROVEMENT & HEALTH ANALYSIS
    # ==========================================================================

    @classmethod
    def analyze_community(
        cls,
        community_identifier: str,
        user: User,
        language: Optional[str] = None,
    ) -> CommunityAnalysisResult:
        """
        Analyzes real aggregated metrics and structure of a community to propose
        concrete improvements for owners and moderators.
        """
        if not user or not user.is_authenticated:
            raise PermissionDenied(
                "Authentification requise pour analyser une communauté."
            )

        community = cls._get_community_with_access_check(community_identifier, user)

        # Check owner / moderator permissions
        is_owner = community.owner_id == user.id
        is_mod_or_admin = CommunityMember.objects.filter(
            community=community,
            user=user,
            role__in=[
                CommunityRole.OWNER,
                CommunityRole.ADMIN,
                CommunityRole.MODERATOR,
            ],
            status=MembershipStatus.ACTIVE,
        ).exists()

        if not (
            is_owner or is_mod_or_admin or user.is_staff or is_superadmin_user(user)
        ):
            raise PermissionDenied(
                "Vous devez être administrateur ou modérateur de cette communauté."
            )

        resolved_lang = cls._resolve_user_language(user, language)

        # Collect real aggregated metrics
        thirty_days_ago = timezone.now() - timedelta(days=30)
        recent_posts_count = Post.objects.filter(
            community=community, created_at__gte=thirty_days_ago
        ).count()

        unanswered_questions_count = Post.objects.filter(
            community=community,
            post_type=PostType.QUESTION,
            comments_count=0,
        ).count()

        upcoming_events_count = Event.objects.filter(
            community=community, start_time__gte=timezone.now()
        ).count()

        existing_channels = list(
            community.post_categories.values_list("name", flat=True)
        )

        metrics = {
            "members_count": community.members_count,
            "posts_count": community.posts_count,
            "recent_posts_30d": recent_posts_count,
            "unanswered_questions_count": unanswered_questions_count,
            "upcoming_events_count": upcoming_events_count,
            "channels_count": len(existing_channels),
            "channels_list": existing_channels,
            "has_welcome_message": bool(
                hasattr(community, "settings") and community.settings.welcome_message
            ),
        }

        community_info = {
            "name": community.name,
            "slug": community.slug,
            "tagline": community.tagline or "",
            "description": community.description or "",
            "category": community.category.name if community.category else "Général",
        }

        result = ai_router.analyze_community(
            community_info=community_info,
            metrics=metrics,
            language=resolved_lang,
        )
        result.metrics_summary = metrics
        return result

    # ==========================================================================
    # 5. MULTI-TURN CONVERSATIONAL CHAT
    # ==========================================================================

    @classmethod
    def chat(
        cls,
        message: str,
        user: Optional[User] = None,
        conversation_id: Optional[str] = None,
        community_identifier: Optional[str] = None,
        language: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Conversational assistant endpoint handling multi-turn dialog, intent detection,
        context retention, and action suggestions.
        """
        clean_message = (message or "").strip()
        if not clean_message:
            raise ValidationError("Le message ne peut pas être vide.")

        cls._pre_moderate_input(clean_message, user=user)
        resolved_lang = cls._resolve_user_language(user, language)

        community = None
        if community_identifier:
            community = cls._get_community_with_access_check(community_identifier, user)

        # Retrieve or create conversation session
        conversation = None
        is_new_conversation = False
        if conversation_id:
            try:
                c_filter = Q(id=conversation_id)
                if user and user.is_authenticated:
                    # Allow user to access their own conversation or adopt an anonymous guest conversation
                    c_filter &= Q(user=user) | Q(user__isnull=True)
                conversation = AssistantConversation.objects.filter(c_filter).first()
                if (
                    conversation
                    and not conversation.user
                    and user
                    and user.is_authenticated
                ):
                    conversation.user = user
                    conversation.save(update_fields=["user"])
            except Exception:
                conversation = None

        if not conversation:
            is_new_conversation = True
            # Create new conversation with clean title preview
            title_preview = clean_message[:50].strip()
            if len(clean_message) > 50:
                title_preview += "..."
            conversation = AssistantConversation.objects.create(
                user=user if user and user.is_authenticated else None,
                community=community,
                title=title_preview or "Nouvelle discussion",
                context_type="general",
            )

        # Retrieve recent message history (sliding window of latest 6 messages BEFORE this turn)
        history = []
        if not is_new_conversation:
            recent_messages = list(
                conversation.messages.order_by("-created_at").values("role", "content")[
                    :6
                ]
            )
            recent_messages.reverse()
            history = [
                {"role": m["role"], "content": m["content"]}
                for m in recent_messages
                if m["role"] in ["user", "assistant"]
            ]

        # Step 1 & 2: Identify authenticated user and session context
        is_auth = bool(user and user.is_authenticated)
        context: dict[str, Any] = {
            "user_authenticated": is_auth,
            "username": user.username if is_auth else "Invité",
            "preferred_language": resolved_lang,
        }
        if community:
            context["current_community"] = {
                "id": str(community.id),
                "name": community.name,
                "slug": community.slug,
                "category": community.category.name
                if community.category
                else "Général",
            }

        # Step 3: Classify user question intent
        classification = PlatformIntentClassifier.classify(
            message=clean_message,
            community_identifier=community.slug if community else community_identifier,
        )
        intent = classification["intent"]
        context["intent"] = intent

        chat_result: Optional[AssistantChatResult] = None

        # Step 4: Controlled refusal for OUT_OF_SCOPE or prompt injection (no LLM general knowledge call)
        if intent == AssistantIntent.OUT_OF_SCOPE:
            chat_result = AssistantChatResult(
                reply=OUT_OF_SCOPE_REFUSAL_TEXT,
                suggested_follow_ups=[
                    "Comment créer une communauté sur Kodinga ?",
                    "Quelles communautés gratuites sont disponibles ?",
                    "Quelles sont les fonctionnalités de la plateforme ?",
                ],
                suggested_action="explore_communities",
                data={
                    "intent": intent,
                    "refused": True,
                    "is_prompt_injection": classification.get(
                        "is_prompt_injection", False
                    ),
                },
                provider="kodinga_guard",
            )

        # Step 5 & 6: Determine authorized sources, verify permissions, and query relevant sources
        elif intent == AssistantIntent.COMMUNITY_PRIVATE_CONTENT:
            target_ref = classification.get("extracted_community_ref")
            if not target_ref and community:
                target_ref = community.slug
            if not target_ref and is_auth:
                # Resolve user's active community when asking "Quels sont les modules de ma communauté ?"
                owned = Community.objects.filter(owner=user, is_active=True).first()
                if owned:
                    target_ref = owned.slug
                else:
                    mem = (
                        CommunityMember.objects.filter(
                            user=user, status=MembershipStatus.ACTIVE
                        )
                        .select_related("community")
                        .first()
                    )
                    if mem and mem.community:
                        target_ref = mem.community.slug

            private_res = CommunityPrivateContentService.get_authorized_private_content(
                user=user,
                community_id_or_slug=target_ref or "",
            )

            if not private_res["found"]:
                chat_result = AssistantChatResult(
                    reply=MISSING_INFORMATION_TEXT,
                    suggested_follow_ups=[
                        "Quelles communautés sont disponibles ?",
                        "Comment rejoindre une communauté ?",
                    ],
                    suggested_action="explore_communities",
                    data={"intent": intent, "authorized": False},
                    provider="kodinga_guard",
                )
            elif not private_res["authorized"]:
                # Strict backend block: never pass private content to LLM or unauthorized user
                chat_result = AssistantChatResult(
                    reply=build_private_content_denied_text(
                        private_res.get("community_name")
                    ),
                    suggested_follow_ups=[
                        f"À quoi sert la communauté {private_res.get('community_name')} ?",
                        "Comment rejoindre cette communauté ?",
                        "Quelles communautés gratuites sont disponibles ?",
                    ],
                    suggested_action="request_join_community",
                    data={
                        "intent": intent,
                        "authorized": False,
                        "reason": private_res.get("reason"),
                        "community_slug": private_res.get("community_slug"),
                    },
                    provider="kodinga_guard",
                )
            else:
                context["authorized_private_content"] = private_res

        elif intent == AssistantIntent.COMMUNITY_INFORMATION:
            target_ref = classification.get("extracted_community_ref") or (
                community.slug if community else community_identifier
            )
            if target_ref:
                details = CommunityDynamicDataService.get_accessible_community_context(
                    user=user, community_id=target_ref
                )
                members_info = CommunityDynamicDataService.get_community_members_count(
                    community_id=target_ref, user=user
                )
                access_info = CommunityDynamicDataService.get_community_access_type(
                    community_id=target_ref, user=user
                )
                if details:
                    context["dynamic_community_data"] = {
                        "details": details,
                        "members_info": members_info,
                        "access_info": access_info,
                    }
                else:
                    chat_result = AssistantChatResult(
                        reply=MISSING_INFORMATION_TEXT,
                        suggested_follow_ups=[
                            "Quelles communautés gratuites sont disponibles ?",
                            "Comment créer une communauté ?",
                        ],
                        suggested_action="explore_communities",
                        data={"intent": intent, "reason": "community_not_found"},
                        provider="kodinga_guard",
                    )
            else:
                chat_result = AssistantChatResult(
                    reply=MISSING_INFORMATION_TEXT,
                    suggested_follow_ups=[
                        "Quelles communautés gratuites sont disponibles ?",
                        "Comment créer une communauté ?",
                    ],
                    suggested_action="explore_communities",
                    data={"intent": intent, "reason": "missing_community_reference"},
                    provider="kodinga_guard",
                )

        elif intent == AssistantIntent.COMMUNITY_DISCOVERY:
            filters = classification.get("filters") or {}
            public_communities = CommunityDynamicDataService.search_public_communities(
                query=clean_message,
                filters=filters,
                user=user,
                limit=8,
            )
            context["available_public_communities"] = public_communities
            context["discovery_filters"] = filters

        else:
            # Intents: PLATFORM_HELP, PLATFORM_FEATURE, ACCOUNT_HELP, SUBSCRIPTION_HELP, PLATFORM_TROUBLESHOOTING, UNKNOWN
            if not classification.get("is_greeting"):
                rag_result = PlatformDocumentationRAGService.retrieve_relevant_docs(
                    query=clean_message,
                    intent=intent,
                )
                # Step 7: Evaluate relevance of retrieved official documentation
                if not rag_result["has_sufficient_knowledge"]:
                    chat_result = AssistantChatResult(
                        reply=MISSING_INFORMATION_TEXT,
                        suggested_follow_ups=[
                            "Quelles sont les fonctionnalités de Kodinga ?",
                            "Comment créer une communauté ?",
                            "Quelles communautés gratuites sont disponibles ?",
                        ],
                        suggested_action=None,
                        data={
                            "intent": intent,
                            "has_sufficient_knowledge": False,
                        },
                        provider="kodinga_guard",
                    )
                else:
                    context["official_documentation"] = rag_result["documents"]

        # Step 8, 9 & 10: Build bounded context, send to OpenAI if not already resolved by guard, and validate response
        if chat_result is None:
            chat_result = ai_router.assistant_chat(
                message=clean_message,
                history=history,
                context=context,
                language=resolved_lang,
                strategy=AIProviderStrategy.OPENAI_ONLY,
            )

        # Persist user + assistant messages in a single DB round-trip
        now = timezone.now()
        AssistantMessage.objects.bulk_create(
            [
                AssistantMessage(
                    conversation=conversation,
                    role="user",
                    content=clean_message,
                    created_at=now,
                ),
                AssistantMessage(
                    conversation=conversation,
                    role="assistant",
                    content=chat_result.reply,
                    metadata={
                        "suggested_follow_ups": chat_result.suggested_follow_ups,
                        "suggested_action": chat_result.suggested_action,
                        "data": chat_result.data,
                    },
                    provider=chat_result.provider,
                    created_at=now + timedelta(milliseconds=1),
                ),
            ]
        )

        return {
            "conversation_id": str(conversation.id),
            "reply": chat_result.reply,
            "suggested_follow_ups": chat_result.suggested_follow_ups,
            "suggested_action": chat_result.suggested_action,
            "data": chat_result.data,
            "provider": chat_result.provider,
        }

    # ==========================================================================
    # Helper Methods
    # ==========================================================================

    @classmethod
    def _get_community_with_access_check(
        cls, identifier: str, user: Optional[User] = None
    ) -> Community:
        import uuid

        is_valid_uuid = False
        try:
            uuid.UUID(str(identifier))
            is_valid_uuid = True
        except (ValueError, TypeError, AttributeError):
            is_valid_uuid = False

        if is_valid_uuid:
            community = Community.objects.filter(
                Q(id=identifier) | Q(slug=identifier)
            ).first()
        else:
            community = Community.objects.filter(slug=identifier).first()

        if not community:
            raise ValidationError(f"Communauté '{identifier}' introuvable.")

        # If secret, user must be a member
        if community.privacy_type == CommunityPrivacy.SECRET:
            if not user or not user.is_authenticated:
                raise PermissionDenied("Cette communauté est secrète.")
            if not is_superadmin_user(user):
                is_member = CommunityMember.objects.filter(
                    community=community,
                    user=user,
                    status=MembershipStatus.ACTIVE,
                ).exists()
                if not is_member and not user.is_staff:
                    raise PermissionDenied(
                        "Accès restreint à cette communauté secrète."
                    )

        return community
