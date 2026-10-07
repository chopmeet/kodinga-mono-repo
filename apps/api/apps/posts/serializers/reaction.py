from rest_framework import serializers
from apps.posts.models.reaction import ReactionType


class ToggleReactionRequestSerializer(serializers.Serializer):
    reaction_type = serializers.ChoiceField(choices=ReactionType.choices, default=ReactionType.LIKE)
