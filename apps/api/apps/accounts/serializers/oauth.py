from rest_framework import serializers


class OAuthCallbackSerializer(serializers.Serializer):
    code = serializers.CharField(required=True)
    state = serializers.CharField(required=False, allow_blank=True, default="")
    redirect_uri = serializers.CharField(required=False, allow_blank=True, default="")
