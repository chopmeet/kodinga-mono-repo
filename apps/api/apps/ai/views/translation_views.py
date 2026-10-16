from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.ai.serializers import TranslationRequestSerializer, TranslationResponseSerializer
from apps.ai.services.translation_service import TranslationService
from common.utils.responses import error_response, success_response


class AITranslateView(APIView):
    """
    On-demand translation endpoint for messages, posts, and comments.
    Translates into target language (French, English, Wolof, Bambara, etc.)
    with automatic persistent caching and transparent OpenAI fallback.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["AI Services"],
        summary="Traduire un texte vers une langue cible (Wolof, Bambara, Français, Anglais)",
        request=TranslationRequestSerializer,
        responses={200: TranslationResponseSerializer},
    )
    def post(self, request):
        serializer = TranslationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Données invalides.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details=serializer.errors,
            )

        content = serializer.validated_data["content"]
        target_lang = serializer.validated_data["target_lang"]
        source_lang = serializer.validated_data.get("source_lang")

        result = TranslationService.translate(
            text=content,
            target_lang=target_lang,
            source_lang=source_lang,
            use_cache=True,
        )

        response_data = {
            "translated_text": result.translated_text,
            "source_language": result.source_language,
            "target_language": result.target_language,
            "provider": result.provider,
            "confidence": result.confidence,
            "cached": result.cached,
            "is_fallback_original": result.is_fallback_original,
        }
        return success_response(data=response_data, status_code=status.HTTP_200_OK)
