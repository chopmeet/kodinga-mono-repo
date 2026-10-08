from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.profiles.models.experience import DeveloperExperience
from apps.profiles.serializers.technology import TechnologySerializer


class DeveloperExperienceSerializer(BaseModelSerializer):
    technologies = TechnologySerializer(many=True, read_only=True)
    technology_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = DeveloperExperience
        fields = [
            'id',
            'title',
            'company_name',
            'company_url',
            'location',
            'employment_type',
            'is_remote',
            'start_date',
            'end_date',
            'is_current',
            'description',
            'technologies',
            'technology_ids',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        start_date = attrs.get('start_date') or (self.instance.start_date if self.instance else None)
        end_date = attrs.get('end_date') if 'end_date' in attrs else (self.instance.end_date if self.instance else None)
        is_current = attrs.get('is_current') if 'is_current' in attrs else (self.instance.is_current if self.instance else False)

        if not is_current and not end_date:
            pass  # Optional
        if end_date and start_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "La date de fin ne peut pas être antérieure à la date de début."})
        return attrs
