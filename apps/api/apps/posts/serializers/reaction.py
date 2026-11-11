import unicodedata

from rest_framework import serializers

from apps.posts.models.reaction import ReactionType

REACTION_ALIASES = {
    "👍": ReactionType.LIKE,
    "🔥": ReactionType.FIRE,
    "🚀": ReactionType.ROCKET,
    "❤️": ReactionType.HEART,
    "❤": ReactionType.HEART,
    "👀": ReactionType.EYES,
    "💡": ReactionType.THINKING,
    "🦄": ReactionType.UNICORN,
    "celebrate": ReactionType.FIRE,
    "insightful": ReactionType.THINKING,
    "curious": ReactionType.EYES,
    "love": ReactionType.HEART,
}


def is_valid_emoji_or_reaction(value: str) -> bool:
    if not value or len(value) > 20:
        return False
    if value in dict(ReactionType.choices) or value in REACTION_ALIASES:
        return True
    # Allow Unicode emoji sequences (Symbols/Other 'So', modifiers 'Sk', variation selectors, ZWJ)
    return any(
        unicodedata.category(ch) in ("So", "Sk", "Sm") or ord(ch) > 0x1F000
        for ch in value
    )


class ToggleReactionRequestSerializer(serializers.Serializer):
    reaction_type = serializers.CharField(
        max_length=20,
        required=False,
        default=ReactionType.LIKE,
        help_text="Type de réaction ('like', 'fire', 'rocket', 'heart', 'eyes', 'thinking', 'unicorn') ou emoji Unicode direct ('🎉', '👏', '😂'...).",
    )
    emoji = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        help_text="Alias optionnel permettant d'envoyer directement l'emoji Unicode sélectionné.",
    )

    def validate(self, attrs):
        raw = (
            attrs.get("emoji") or attrs.get("reaction_type") or ReactionType.LIKE
        ).strip()
        normalized = REACTION_ALIASES.get(raw, raw)
        if not is_valid_emoji_or_reaction(normalized):
            raise serializers.ValidationError(
                {"reaction_type": f"Réaction ou emoji '{raw}' invalide."}
            )
        attrs["reaction_type"] = normalized
        return attrs
