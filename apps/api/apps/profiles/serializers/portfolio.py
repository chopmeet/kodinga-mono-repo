from apps.profiles.models.portfolio import DeveloperPortfolioProject
from apps.profiles.serializers.technology import TechnologySerializer
from common.serializers.base import BaseModelSerializer
from rest_framework import serializers


class DeveloperPortfolioProjectSerializer(BaseModelSerializer):
    technologies = TechnologySerializer(many=True, read_only=True)
    technology_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = DeveloperPortfolioProject
        fields = [
            'id',
            'title',
            'description',
            'project_url',
            'repo_url',
            'thumbnail_url',
            'is_featured',
            'order',
            'technologies',
            'technology_ids',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
