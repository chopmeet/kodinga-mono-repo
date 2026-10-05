from rest_framework import serializers


class BaseModelSerializer(serializers.ModelSerializer):
    """
    Standard base serializer automatically making audit and primary key fields read-only.
    """
    id = serializers.UUIDField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class EmptySerializer(serializers.Serializer):
    """
    Serializer used for actions without payload.
    """
    pass
