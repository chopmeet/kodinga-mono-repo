from apps.posts.models.reaction import ReactionType
from rest_framework import serializers


class ToggleReactionRequestSerializer(serializers.Serializer):
    reaction_type = serializers.ChoiceField(
        choices=ReactionType.choices,
        default=ReactionType.LIKE,
        help_text="Type d'emoji ('like', 'celebrate', 'insightful', 'curious', 'heart', 'rocket')."
    )
