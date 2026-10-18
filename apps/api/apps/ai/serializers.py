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


