from rest_framework import serializers

from apps.ai.models.audit import ModerationAuditLog
from apps.communities.models.settings import CommunitySettings


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
    language = serializers.CharField(
        max_length=10,
        required=False,
        default="fr",
        help_text="Code langue préféré (fr, en, wo, bm)",
    )


class PlanCommunityRequestSerializer(serializers.Serializer):
    idea = serializers.CharField(
        max_length=2000,
        required=True,
        help_text="Description en langage naturel de l'idée de communauté à créer",
    )
    language = serializers.CharField(
        max_length=10,
        required=False,
        default="fr",
        help_text="Code langue préféré (fr, en, wo, bm)",
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
    language = serializers.CharField(
        max_length=10,
        required=False,
        default="fr",
        help_text="Code langue préféré (fr, en, wo, bm)",
    )


class AnalyzeCommunityRequestSerializer(serializers.Serializer):
    community = serializers.CharField(
        max_length=255,
        required=True,
        help_text="Slug ou ID de la communauté à diagnostiquer",
    )
    language = serializers.CharField(
        max_length=10,
        required=False,
        default="fr",
        help_text="Code langue préféré (fr, en, wo, bm)",
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
        help_text="ID de la session de conversation existante (optionnel)",
    )
    community = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
        help_text="Slug ou ID de la communauté courante (optionnel)",
    )
    language = serializers.CharField(
        max_length=10,
        required=False,
        default="fr",
        help_text="Code langue préféré (fr, en, wo, bm)",
    )


class AssistantMessageSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    role = serializers.CharField()
    content = serializers.CharField()
    metadata = serializers.DictField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)


class AssistantConversationSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField()
    context_type = serializers.CharField()
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    messages = AssistantMessageSerializer(many=True, read_only=True)

