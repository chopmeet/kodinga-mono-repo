from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.profiles.models.technology import Technology


class TechnologySerializer(BaseModelSerializer):
    class Meta:
        model = Technology
        fields = [
            'id',
            'name',
            'slug',
            'category',
            'icon_url',
            'description',
            'is_verified',
            'usage_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'is_verified', 'usage_count', 'created_at', 'updated_at']
