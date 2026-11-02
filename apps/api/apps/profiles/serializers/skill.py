from apps.profiles.models.skill import DeveloperSkill
from apps.profiles.serializers.technology import TechnologySerializer
from common.serializers.base import BaseModelSerializer
from rest_framework import serializers


class DeveloperSkillSerializer(BaseModelSerializer):
    technology = TechnologySerializer(read_only=True)

    class Meta:
        model = DeveloperSkill
        fields = [
            'id',
            'technology',
            'level',
            'years_of_experience',
            'is_highlighted',
            'order',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DeveloperSkillCreateUpdateSerializer(serializers.Serializer):
    technology_id = serializers.UUIDField(required=False)
    technology_name = serializers.CharField(max_length=100, required=False)
    level = serializers.ChoiceField(choices=DeveloperSkill._meta.get_field('level').choices, default='intermediate')
    years_of_experience = serializers.IntegerField(min_value=0, max_value=60, default=1)
    is_highlighted = serializers.BooleanField(default=False)
    order = serializers.IntegerField(min_value=0, default=0)

    def validate(self, attrs):
        if not attrs.get('technology_id') and not attrs.get('technology_name'):
            raise serializers.ValidationError("technology_id ou technology_name est requis.")
        return attrs
