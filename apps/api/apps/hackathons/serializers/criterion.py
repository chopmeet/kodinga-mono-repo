from rest_framework import serializers

from apps.hackathons.models.criterion import HackathonCriterion


class HackathonCriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = HackathonCriterion
        fields = [
            "id",
            "name",
            "description",
            "min_score",
            "max_score",
            "weight",
            "display_order",
        ]
