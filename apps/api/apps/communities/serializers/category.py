from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.communities.models.category import CommunityCategory


class CommunityCategorySerializer(BaseModelSerializer):
    communities_count = serializers.IntegerField(source='communities.count', read_only=True)

    class Meta:
        model = CommunityCategory
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'icon_url',
            'is_active',
            'order',
            'communities_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'communities_count', 'created_at', 'updated_at']


class CommunityCategoryCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunityCategory
        fields = [
            'name',
            'slug',
            'description',
            'icon_url',
            'is_active',
            'order',
        ]
        extra_kwargs = {
            'slug': {'required': False},
            'description': {'required': False},
            'icon_url': {'required': False},
            'is_active': {'required': False},
            'order': {'required': False},
        }

