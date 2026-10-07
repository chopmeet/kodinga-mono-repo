from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.profiles.models.education import DeveloperEducation


class DeveloperEducationSerializer(BaseModelSerializer):
    class Meta:
        model = DeveloperEducation
        fields = [
            'id',
            'institution',
            'degree',
            'field_of_study',
            'start_date',
            'end_date',
            'is_current',
            'description',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        start_date = attrs.get('start_date') or (self.instance.start_date if self.instance else None)
        end_date = attrs.get('end_date') if 'end_date' in attrs else (self.instance.end_date if self.instance else None)
        if end_date and start_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "La date de fin ne peut pas être antérieure à la date de début."})
        return attrs
