from rest_framework import serializers

from apps.ai.models.audit import ModerationAuditLog


class TranslationRequestSerializer(serializers.Serializer):
    content = serializers.CharField(
        max_length=10000,
        required=True,
        help_text="Texte à traduire",
    )
    target_lang = serializers.CharField(
        max_length=10,
        required=True,
        help_text="Code langue cible (fr, en, wo, bm, etc.)",
    )
    source_lang = serializers.CharField(
        max_length=10,
        required=False,
        allow_blank=True,
        help_text="Code langue source (optionnel, auto-détecté par défaut)",
    )


class TranslationResponseSerializer(serializers.Serializer):
    translated_text = serializers.CharField()
    source_language = serializers.CharField()
    target_language = serializers.CharField()
    provider = serializers.CharField()
    confidence = serializers.FloatField()
    cached = serializers.BooleanField()
    is_fallback_original = serializers.BooleanField()


class LanguageItemSerializer(serializers.Serializer):
    code = serializers.CharField(help_text="Code ISO-639 (ex: wo, bm, ha, sw, fr, en)")
    name = serializers.CharField(help_text="Nom en français")
    native_name = serializers.CharField(help_text="Nom dans la langue d'origine")
    region = serializers.CharField(help_text="Région ou pays où la langue est parlée")
    category = serializers.CharField(help_text="'african' ou 'international'")
    default = serializers.BooleanField(help_text="Vrai si c'est la langue par défaut du système")
    capabilities = serializers.ListField(
        child=serializers.CharField(),
        help_text="Capacités IA (translation, chat, moderation, detection)",
    )


class LanguageListResponseSerializer(serializers.Serializer):
    total = serializers.IntegerField(help_text="Nombre total de langues supportées")
    african_languages_count = serializers.IntegerField(help_text="Nombre de langues africaines")
    international_languages_count = serializers.IntegerField(help_text="Nombre de langues internationales")
    languages = LanguageItemSerializer(many=True, help_text="Liste des langues")


class ModerationAuditLogSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    community_name = serializers.CharField(source="community.name", read_only=True)

    class Meta:
        model = ModerationAuditLog
        fields = [
            "id",
            "community",
            "community_name",
            "user",
            "user_username",
            "content_preview",
            "content_hash",
            "decision",
            "categories",
            "confidence",
            "reason",
            "provider",
            "model",
            "is_reviewed_by_admin",
            "admin_notes",
            "created_at",
        ]
        read_only_fields = fields


class CommunityAISettingsSerializer(serializers.Serializer):
    ai_translation_enabled = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Activer la traduction automatique multilingue",
    )
    default_community_language = serializers.CharField(
        max_length=10,
        required=False,
        default="fr",
        help_text="Langue par défaut de la communauté",
    )
    supported_languages = serializers.ListField(
        child=serializers.CharField(max_length=10),
        required=False,
        default=["fr", "en", "wo", "bm"],
        help_text="Langues cibles autorisées pour la communauté",
    )
    sentiment_analytics_enabled = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Activer l'analyse de sentiment anonymisée pour les statistiques",
    )
    non_mandatory_moderation = serializers.DictField(
        required=False,
        default=dict,
        help_text="Règles optionnelles de la communauté (ex: profanity, spam)",
    )
    moderation_strictness = serializers.ChoiceField(
        choices=["relaxed", "standard", "strict"],
        required=False,
        default="standard",
        help_text="Sensibilité pour les règles optionnelles",
    )
    ai_provider_override = serializers.ChoiceField(
        choices=["", "gemini", "openai"],
        required=False,
        default="",
        allow_blank=True,
        help_text="Provider IA forcé pour cette communauté ('gemini', 'openai', ou vide = défaut système)",
    )

    # Read-only platform safety invariants
    platform_locked_rules = serializers.SerializerMethodField()

    def get_platform_locked_rules(self, obj) -> dict:
        return {
            "prohibit_sexual_harassment": True,
            "prohibit_targeted_harassment": True,
            "prohibit_hate_speech_and_bullying": True,
            "mandatory_pre_publication_moderation": True,
            "fail_closed_on_outage": True,
            "is_customizable_by_owner": False,
            "notice": (
                "Ces protections sont strictement verrouillées au niveau de la plateforme Kodinga "
                "et ne peuvent être désactivées ou affaiblies par aucun administrateur de communauté."
            ),
        }


# ==============================================================================
# AI Community Assistant Serializers
# ==============================================================================

class RecommendCommunitiesRequestSerializer(serializers.Serializer):
    interests = serializers.CharField(
        max_length=1000,
        required=True,
        help_text="Centres d'intérêt, compétences ou objectifs recherchés par l'utilisateur",
    )
    language = serializers.ChoiceField(
        choices=["fr", "en", "wo", "bm"],
        required=False,
        default="fr",
        help_text="Code langue préféré : fr (Français), en (English), wo (Wolof), bm (Bambara)",
    )


class PlanCommunityRequestSerializer(serializers.Serializer):
    idea = serializers.CharField(
        max_length=2000,
        required=True,
        help_text="Description en langage naturel de l'idée de communauté à créer",
    )
    language = serializers.ChoiceField(
        choices=["fr", "en", "wo", "bm"],
        required=False,
        default="fr",
        help_text="Code langue préféré : fr (Français), en (English), wo (Wolof), bm (Bambara)",
    )
    context = serializers.DictField(
        required=False,
        default=dict,
        help_text="Paramètres ou préférences additionnelles",
    )


class SuggestContentRequestSerializer(serializers.Serializer):
    community = serializers.CharField(
        max_length=255,
        required=True,
        help_text="Slug ou ID de la communauté concernée",
    )
    goal = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        default="",
        help_text="Objectif spécifique (ex: accueillir les débutants, animer la fin de semaine)",
    )
    language = serializers.ChoiceField(
        choices=["fr", "en", "wo", "bm"],
        required=False,
        default="fr",
        help_text="Code langue préféré : fr (Français), en (English), wo (Wolof), bm (Bambara)",
    )


class AnalyzeCommunityRequestSerializer(serializers.Serializer):
    community = serializers.CharField(
        max_length=255,
        required=True,
        help_text="Slug ou ID de la communauté à diagnostiquer",
    )
    language = serializers.ChoiceField(
        choices=["fr", "en", "wo", "bm"],
        required=False,
        default="fr",
        help_text="Code langue préféré : fr (Français), en (English), wo (Wolof), bm (Bambara)",
    )


class AssistantChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(
        max_length=3000,
        required=True,
        help_text="Message ou question de l'utilisateur",
    )
    conversation_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        default=None,
        help_text="Optionnel : ID d'une conversation existante pour conserver le contexte. Mettre null ou supprimer ce champ pour démarrer une nouvelle discussion.",
    )
    community = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
        help_text="Slug ou ID de la communauté courante (optionnel)",
    )
    language = serializers.ChoiceField(
        choices=["fr", "en", "wo", "bm"],
        required=False,
        default="fr",
        help_text="Code langue préféré : fr (Français), en (English), wo (Wolof), bm (Bambara)",
    )


class AssistantMessageSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    role = serializers.CharField(help_text="'user', 'assistant' ou 'system'")
    content = serializers.CharField(help_text="Contenu du message")
    metadata = serializers.DictField(read_only=True, default=dict)
    provider = serializers.CharField(read_only=True, default="")
    created_at = serializers.DateTimeField(read_only=True)


class AssistantConversationSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(help_text="Titre de la session de discussion")
    context_type = serializers.CharField(help_text="Type de contexte (general, discovery, creation, management)")
    community_name = serializers.CharField(source="community.name", read_only=True, allow_null=True)
    community_slug = serializers.CharField(source="community.slug", read_only=True, allow_null=True)
    messages_count = serializers.SerializerMethodField(help_text="Nombre total de messages dans la discussion")
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    messages = AssistantMessageSerializer(many=True, read_only=True)

    def get_messages_count(self, obj) -> int:
        if hasattr(obj, "messages"):
            return obj.messages.count()
        return 0


class CreateConversationRequestSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=255,
        required=False,
        default="Nouvelle discussion",
        help_text="Titre initial de la conversation",
    )
    context_type = serializers.ChoiceField(
        choices=["general", "discovery", "creation", "management"],
        required=False,
        default="general",
        help_text="Type de contexte : general, discovery, creation ou management",
    )
    community = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
        help_text="Slug ou ID de la communauté liée (optionnel)",
    )


class UpdateConversationRequestSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=255,
        required=False,
        help_text="Nouveau titre de la session de conversation",
    )
    context_type = serializers.ChoiceField(
        choices=["general", "discovery", "creation", "management"],
        required=False,
        help_text="Type de contexte mis à jour",
    )


class FirstWeekPlanItemSerializer(serializers.Serializer):
    day = serializers.CharField(help_text="ex: Jour 1")
    focus = serializers.CharField(help_text="Thème ou objectif principal")
    action_items = serializers.ListField(
        child=serializers.CharField(),
        help_text="Actions concrètes recommandées",
    )


class CommunityProposalResponseSerializer(serializers.Serializer):
    name_suggestions = serializers.ListField(
        child=serializers.CharField(),
        help_text="Suggestions de noms originaux pour la communauté",
    )
    description = serializers.CharField(help_text="Description complète de la communauté")
    purpose = serializers.CharField(help_text="Mission et proposition de valeur")
    target_audience = serializers.CharField(help_text="Public cible visé")
    suggested_categories = serializers.ListField(
        child=serializers.CharField(),
        help_text="Catégories thématiques adaptées",
    )
    suggested_rules = serializers.ListField(
        child=serializers.CharField(),
        help_text="Règles de communauté recommandées",
    )
    recommended_language = serializers.CharField(help_text="Code langue recommandé")
    recommended_visibility = serializers.CharField(help_text="Visibilité recommandée (public/private)")
    welcome_message = serializers.CharField(help_text="Message de bienvenue pour les nouveaux membres")
    first_discussion_prompts = serializers.ListField(
        child=serializers.CharField(),
        help_text="Sujets pour lancer les premières discussions",
    )
    initial_event_ideas = serializers.ListField(
        child=serializers.CharField(),
        help_text="Idées d'événements inauguraux",
    )
    first_week_launch_plan = FirstWeekPlanItemSerializer(
        many=True,
        help_text="Plan d'action jour par jour pour la première semaine",
    )
    follow_up_questions = serializers.ListField(
        child=serializers.CharField(),
        help_text="Questions pour affiner la stratégie",
    )
    provider = serializers.CharField(help_text="Fournisseur d'IA utilisé (gemini ou openai)")


class CommunityRecommendationCardSerializer(serializers.Serializer):
    id = serializers.CharField(help_text="ID de la communauté")
    name = serializers.CharField(help_text="Nom de la communauté")
    slug = serializers.CharField(help_text="Slug d'accès")
    tagline = serializers.CharField(help_text="Slogan ou phrase d'accroche")
    description = serializers.CharField(help_text="Description de la communauté")
    category = serializers.CharField(help_text="Catégorie principale")
    privacy_type = serializers.CharField(help_text="public ou private")
    pricing_type = serializers.CharField(help_text="free ou paid")
    members_count = serializers.IntegerField(help_text="Nombre de membres actifs")
    language = serializers.CharField(help_text="Langue principale")
    relevance_reason = serializers.CharField(help_text="Pourquoi cette communauté correspond aux intérêts")
    match_score = serializers.FloatField(help_text="Score de pertinence (0 à 1)")


class CommunityRecommendationResponseSerializer(serializers.Serializer):
    recommendations = CommunityRecommendationCardSerializer(
        many=True,
        help_text="Liste des communautés existantes recommandées",
    )
    reasoning = serializers.CharField(help_text="Explication globale de la recommandation")
    suggested_alternatives = serializers.ListField(
        child=serializers.CharField(),
        help_text="Suggestions alternatives de recherche",
    )
    provider = serializers.CharField(help_text="Fournisseur d'IA utilisé (gemini ou openai)")


class ContentSuggestionResponseSerializer(serializers.Serializer):
    discussion_categories = serializers.ListField(
        child=serializers.CharField(),
        help_text="Catégories de discussion suggérées",
    )
    first_post = serializers.DictField(help_text="Modèle pour le premier post d'accueil")
    weekly_activities = serializers.ListField(
        child=serializers.DictField(),
        help_text="Activités hebdomadaires pour engager les membres",
    )
    monthly_events = serializers.ListField(
        child=serializers.DictField(),
        help_text="Événements mensuels suggérés",
    )
    onboarding_prompt = serializers.CharField(help_text="Message d'onboarding suggéré")
    weekly_content_calendar = serializers.ListField(
        child=serializers.DictField(),
        help_text="Calendrier éditorial de la semaine",
    )
    provider = serializers.CharField(help_text="Fournisseur d'IA utilisé (gemini ou openai)")


class CommunityAnalysisResponseSerializer(serializers.Serializer):
    community_name = serializers.CharField(help_text="Nom de la communauté")
    overview_assessment = serializers.CharField(help_text="Bilan global de l'activité")
    strengths = serializers.ListField(child=serializers.CharField(), help_text="Points forts constatés")
    improvement_areas = serializers.ListField(child=serializers.DictField(), help_text="Axes d'amélioration prioritaires")
    quick_wins = serializers.ListField(child=serializers.DictField(), help_text="Actions rapides à fort impact")
    long_term_strategy = serializers.ListField(child=serializers.DictField(), help_text="Recommandations stratégiques à long terme")
    provider = serializers.CharField(help_text="Fournisseur d'IA utilisé (gemini ou openai)")


class AssistantChatResponseSerializer(serializers.Serializer):
    reply = serializers.CharField(help_text="Réponse générée par l'Assistant Kodinga")
    suggested_follow_ups = serializers.ListField(
        child=serializers.CharField(),
        help_text="Suggestions de questions de relance",
    )
    provider = serializers.CharField(help_text="Fournisseur d'IA utilisé (gemini ou openai)")
    conversation_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="ID de session de conversation",
    )




class GlobalAISettingsSerializer(serializers.Serializer):
    strategy = serializers.ChoiceField(
        choices=["auto", "gemini_only", "openai_only", "openai_first"],
        required=False,
        help_text="Stratégie de routage des providers IA",
    )
    primary_provider = serializers.CharField(read_only=True)
    fallback_enabled = serializers.BooleanField(read_only=True)
    max_retries = serializers.IntegerField(read_only=True)
    gemini_model = serializers.CharField(read_only=True)
    openai_model = serializers.CharField(read_only=True)
    circuit_breaker_open = serializers.BooleanField(read_only=True)
    available_strategies = serializers.ListField(
        child=serializers.CharField(), read_only=True
    )


# ==============================================================================
# Feature 2: Semantic Search & Duplicate Detection Serializers
# ==============================================================================

class CheckDuplicatePostRequestSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=255,
        required=True,
        help_text="Titre du post en cours de rédaction",
    )
    content = serializers.CharField(
        required=False,
        default="",
        allow_blank=True,
        help_text="Corps du post",
    )
    threshold = serializers.FloatField(
        required=False,
        default=0.65,
        min_value=0.1,
        max_value=1.0,
        help_text="Seuil de similarité cosinus (défaut: 0.65)",
    )
    limit = serializers.IntegerField(
        required=False,
        default=5,
        min_value=1,
        max_value=20,
    )


class DuplicateMatchItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    title = serializers.CharField()
    similarity_score = serializers.FloatField()
    url = serializers.CharField()
    snippet = serializers.CharField(allow_blank=True)
    is_solved = serializers.BooleanField(default=False)


class CheckDuplicatePostResponseSerializer(serializers.Serializer):
    has_duplicates = serializers.BooleanField()
    threshold = serializers.FloatField()
    count = serializers.IntegerField()
    duplicates = DuplicateMatchItemSerializer(many=True)


class SemanticSearchRequestSerializer(serializers.Serializer):
    query = serializers.CharField(
        max_length=500,
        required=True,
        help_text="Requête de recherche en langage naturel",
    )
    content_types = serializers.ListField(
        child=serializers.ChoiceField(choices=["post", "lesson", "event"]),
        required=False,
        default=["post", "lesson", "event"],
        help_text="Types de contenus à inclure",
    )
    limit = serializers.IntegerField(
        required=False,
        default=10,
        min_value=1,
        max_value=50,
    )


class SemanticSearchResultItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    content_type = serializers.CharField()
    title = serializers.CharField()
    similarity_score = serializers.FloatField()
    url = serializers.CharField()
    snippet = serializers.CharField(allow_blank=True)


# ==============================================================================
# Feature 6: Assessment Generation (Quiz & Code Exercises) Serializers
# ==============================================================================

class GenerateQuizRequestSerializer(serializers.Serializer):
    lesson_id = serializers.UUIDField(required=True)
    question_count = serializers.IntegerField(
        required=False,
        default=3,
        min_value=1,
        max_value=10,
        help_text="Nombre de questions QCM à générer",
    )
    num_questions = serializers.IntegerField(
        required=False,
        default=3,
        min_value=1,
        max_value=10,
        help_text="Nombre de questions QCM à générer",
    )
    difficulty = serializers.ChoiceField(
        choices=["beginner", "intermediate", "advanced"],
        required=False,
        default="intermediate",
    )
    language = serializers.CharField(
        max_length=10,
        required=False,
        default="fr",
    )


class QuizQuestionItemSerializer(serializers.Serializer):
    question = serializers.CharField()
    options = serializers.ListField(child=serializers.CharField())
    correct_index = serializers.IntegerField()
    explanation = serializers.CharField()


class GenerateCodeExerciseRequestSerializer(serializers.Serializer):
    lesson_id = serializers.UUIDField(required=True)
    language = serializers.CharField(
        max_length=30,
        required=False,
        default="python",
        help_text="Langage de programmation (python, javascript, typescript, sql)",
    )
    language_code = serializers.CharField(
        max_length=30,
        required=False,
        default="python",
        help_text="Langage de programmation",
    )
    difficulty = serializers.ChoiceField(
        choices=["beginner", "intermediate", "advanced"],
        required=False,
        default="intermediate",
    )
    instructions = serializers.CharField(
        required=False,
        default="",
        allow_blank=True,
        help_text="Consignes ou focus spécifique du formateur",
    )


class CodeExerciseGeneratedSerializer(serializers.Serializer):
    title = serializers.CharField()
    instructions_markdown = serializers.CharField()
    starter_code = serializers.CharField()
    solution_code = serializers.CharField()
    test_cases = serializers.ListField(child=serializers.DictField())
    language = serializers.CharField()


# ==============================================================================
# Feature 1: Peer Matchmaking Serializers
# ==============================================================================

class PeerMatchItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    user_id = serializers.CharField()
    username = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    avatar_url = serializers.CharField(allow_null=True)
    match_type = serializers.CharField()
    compatibility_score = serializers.FloatField()
    match_reasons = serializers.ListField(child=serializers.CharField())
    status = serializers.CharField()


class PeerMatchRespondRequestSerializer(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=["accept", "decline", "dismiss", "connect"],
        required=True,
    )
    note = serializers.CharField(
        required=False,
        default="",
        allow_blank=True,
    )


class HackathonTeammateSuggestionRequestSerializer(serializers.Serializer):
    hackathon_id = serializers.CharField(
        required=False,
        default=None,
        allow_null=True,
    )
    desired_skills = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    limit = serializers.IntegerField(
        required=False,
        default=3,
        min_value=1,
        max_value=10,
    )


# ==============================================================================
# Feature 4: Post Help & Mentor Tagging Serializers
# ==============================================================================

class MentorSuggestionItemSerializer(serializers.Serializer):
    user_id = serializers.CharField()
    username = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    avatar_url = serializers.CharField(allow_null=True)
    matching_skills = serializers.ListField(child=serializers.CharField())
    reputation_score = serializers.IntegerField()


class PostHelpAssistanceResponseSerializer(serializers.Serializer):
    post_id = serializers.CharField()
    matching_skills = serializers.ListField(child=serializers.CharField())
    ai_comment_draft = serializers.CharField()
    suggested_mentors = MentorSuggestionItemSerializer(many=True)
    status = serializers.CharField()


class PingMentorsRequestSerializer(serializers.Serializer):
    mentor_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
        default=list,
    )
    custom_message = serializers.CharField(
        required=False,
        default="",
        allow_blank=True,
    )


# ==============================================================================
# Feature 5: Churn Risk & Smart Nudges Serializers
# ==============================================================================

class MemberChurnRiskItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    member_id = serializers.CharField(source="member.id", read_only=True)
    user_id = serializers.CharField(source="member.user.id", read_only=True)
    username = serializers.CharField(source="member.user.username", read_only=True)
    first_name = serializers.CharField(source="member.user.first_name", read_only=True)
    last_name = serializers.CharField(source="member.user.last_name", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    def get_avatar_url(self, obj):
        user = getattr(getattr(obj, "member", None), "user", None)
        return getattr(getattr(user, "profile", None), "avatar_url", None) if user else None
    risk_level = serializers.CharField()
    risk_score = serializers.FloatField()
    signals = serializers.DictField()
    suggested_nudge = serializers.CharField()
    status = serializers.CharField()
    nudge_sent_at = serializers.DateTimeField(allow_null=True)


class SendNudgeRequestSerializer(serializers.Serializer):
    member_id = serializers.CharField(required=True)
    message = serializers.CharField(required=False, default="", allow_blank=True)


# ==============================================================================
# Feature 3: Community Weekly Digest Serializers
# ==============================================================================

class CommunityWeeklyDigestSerializer(serializers.Serializer):
    id = serializers.CharField()
    week_identifier = serializers.CharField()
    headline = serializers.CharField()
    summary_markdown = serializers.CharField()
    top_debates = serializers.ListField(child=serializers.DictField())
    highlighted_project = serializers.DictField()
    upcoming_events = serializers.ListField(child=serializers.DictField())
    kpis_snapshot = serializers.DictField()
    created_at = serializers.DateTimeField()


class ApplyAssessmentSerializer(serializers.Serializer):
    lesson_id = serializers.UUIDField(required=True)
    assessment_type = serializers.ChoiceField(choices=["quiz", "code_exercise"])
    payload = serializers.DictField(required=True)


class SendSmartNudgeSerializer(serializers.Serializer):
    custom_message = serializers.CharField(required=False, default="", allow_blank=True)


# Backwards compatibility and alternative naming aliases
CheckDuplicatePostsSerializer = CheckDuplicatePostRequestSerializer
DuplicatePostMatchSerializer = DuplicateMatchItemSerializer
SemanticSearchQuerySerializer = SemanticSearchRequestSerializer
SemanticSearchResultSerializer = SemanticSearchResultItemSerializer
PeerMatchRecommendationSerializer = PeerMatchItemSerializer
HackathonTeammateRequestSerializer = HackathonTeammateSuggestionRequestSerializer
PeerMatchResponseSerializer = PeerMatchRespondRequestSerializer
PostHelpAssistanceSerializer = PostHelpAssistanceResponseSerializer
PingMentorsSerializer = PingMentorsRequestSerializer
MemberChurnRiskSerializer = MemberChurnRiskItemSerializer

GenerateExerciseRequestSerializer = GenerateCodeExerciseRequestSerializer
