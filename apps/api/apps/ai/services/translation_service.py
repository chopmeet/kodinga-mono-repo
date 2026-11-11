import hashlib
import logging
from typing import Optional

from django.db.models import F

from apps.ai.models.translation import TranslationCache
from apps.ai.router import ai_router
from apps.ai.schemas import TranslationResult

logger = logging.getLogger(__name__)


class TranslationService:
    """
    Multilingual translation service supporting French, English, Wolof, and Bambara.
    Uses Gemini first with OpenAI fallback and persistent content-hash caching.
    """

    AVAILABLE_LANGUAGES = [
        # Langues de travail principales / internationales
        {
            "code": "fr",
            "name": "Français",
            "native_name": "Français",
            "region": "Afrique francophone & International",
            "category": "international",
            "default": True,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "en",
            "name": "Anglais",
            "native_name": "English",
            "region": "Afrique anglophone & International",
            "category": "international",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "ar",
            "name": "Arabe",
            "native_name": "العربية",
            "region": "Afrique du Nord (Maghreb, Égypte, Soudan, Mauritanie)",
            "category": "international",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "pt",
            "name": "Portugais",
            "native_name": "Português",
            "region": "Afrique lusophone (Angola, Mozambique, Cap-Vert, Guinée-Bissau)",
            "category": "international",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        # Langues africaines majeures
        {
            "code": "wo",
            "name": "Wolof",
            "native_name": "Wolof",
            "region": "Afrique de l'Ouest (Sénégal, Gambie, Mauritanie)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "bm",
            "name": "Bambara (Mandingue)",
            "native_name": "Bamanankan",
            "region": "Afrique de l'Ouest (Mali, Burkina Faso, Côte d'Ivoire, Guinée)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "ha",
            "name": "Haoussa",
            "native_name": "Hausa",
            "region": "Afrique de l'Ouest & Centrale (Nigeria, Niger, Bénin, Cameroun, Tchad)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "yo",
            "name": "Yoruba",
            "native_name": "Èdè Yorùbá",
            "region": "Afrique de l'Ouest (Nigeria, Bénin, Togo)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "ig",
            "name": "Igbo",
            "native_name": "Asụsụ Igbo",
            "region": "Afrique de l'Ouest (Nigeria, Guinée équatoriale)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "sw",
            "name": "Swahili (Kiswahili)",
            "native_name": "Kiswahili",
            "region": "Afrique de l'Est & Centrale (Tanzanie, Kenya, Ouganda, RD Congo, Rwanda)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "ln",
            "name": "Lingala",
            "native_name": "Lingála",
            "region": "Afrique Centrale (RD Congo, République du Congo, Centrafrique)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "ff",
            "name": "Peul (Pulaar / Fulfulde)",
            "native_name": "Fulfulde / Pulaar",
            "region": "Afrique de l'Ouest & Centrale (Sénégal, Guinée, Mali, Cameroun, Niger)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "am",
            "name": "Amharique",
            "native_name": "አማርኛ",
            "region": "Afrique de l'Est (Éthiopie)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "so",
            "name": "Somali",
            "native_name": "Soomaali",
            "region": "Corne de l'Afrique (Somalie, Djibouti, Éthiopie, Kenya)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "mg",
            "name": "Malgache",
            "native_name": "Fiteny Malagasy",
            "region": "Océan Indien (Madagascar)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "sn",
            "name": "Shona",
            "native_name": "chiShona",
            "region": "Afrique australe (Zimbabwe, Mozambique)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "zu",
            "name": "Zoulou",
            "native_name": "isiZulu",
            "region": "Afrique australe (Afrique du Sud, Eswatini)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "xh",
            "name": "Xhosa",
            "native_name": "isiXhosa",
            "region": "Afrique australe (Afrique du Sud, Lesotho)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "tw",
            "name": "Akan / Twi",
            "native_name": "Twi",
            "region": "Afrique de l'Ouest (Ghana, Côte d'Ivoire)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "ee",
            "name": "Ewe",
            "native_name": "Èʋegbe",
            "region": "Afrique de l'Ouest (Togo, Ghana)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
        {
            "code": "sg",
            "name": "Sango",
            "native_name": "Sängö",
            "region": "Afrique Centrale (République centrafricaine)",
            "category": "african",
            "default": False,
            "capabilities": ["translation", "chat", "moderation", "detection"],
        },
    ]

    SUPPORTED_LANGUAGES = {lang["code"]: lang["name"] for lang in AVAILABLE_LANGUAGES}

    @classmethod
    def get_content_hash(cls, text: str) -> str:
        return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()

    @classmethod
    def is_supported_language(cls, lang_code: str) -> bool:
        if not lang_code:
            return False
        return lang_code.lower() in cls.SUPPORTED_LANGUAGES

    @classmethod
    def translate(
        cls,
        text: str,
        target_lang: str,
        source_lang: Optional[str] = None,
        use_cache: bool = True,
    ) -> TranslationResult:
        """
        Translates text to target_lang.
        Checks TranslationCache first; if missed, routes to Gemini -> OpenAI.
        If all providers fail, falls back safely to returning the original text.
        """
        clean_text = (text or "").strip()
        if not clean_text:
            return TranslationResult(
                translated_text="",
                source_language=source_lang or target_lang,
                target_language=target_lang,
                cached=True,
            )

        target_code = target_lang.lower().strip()

        # Do not translate into the same language unnecessarily
        if source_lang and source_lang.lower().strip() == target_code:
            return TranslationResult(
                translated_text=clean_text,
                source_language=source_lang,
                target_language=target_code,
                cached=True,
            )

        content_hash = cls.get_content_hash(clean_text)

        # 1. Check cache
        if use_cache:
            try:
                cached = TranslationCache.objects.filter(
                    content_hash=content_hash,
                    target_language=target_code,
                ).first()

                if cached:
                    # Increment hit counter
                    TranslationCache.objects.filter(id=cached.id).update(
                        hit_count=F("hit_count") + 1
                    )
                    return TranslationResult(
                        translated_text=cached.translated_text,
                        source_language=cached.source_language,
                        target_language=cached.target_language,
                        provider=f"{cached.provider}_cache",
                        model=cached.model,
                        confidence=cached.confidence,
                        cached=True,
                    )
            except Exception as e:
                logger.warning(f"[TranslationService] Cache check failed: {e}")

        # 2. Call AI Provider Router (Gemini -> OpenAI)
        try:
            result = ai_router.translate_text(
                clean_text, target_lang=target_code, source_lang=source_lang
            )

            # Store in cache
            if use_cache:
                try:
                    TranslationCache.objects.update_or_create(
                        content_hash=content_hash,
                        source_language=result.source_language,
                        target_language=target_code,
                        defaults={
                            "original_text": clean_text[:2000],
                            "translated_text": result.translated_text,
                            "provider": result.provider,
                            "model": result.model,
                            "confidence": result.confidence,
                        },
                    )
                except Exception as cache_err:
                    logger.warning(
                        f"[TranslationService] Cache save failed: {cache_err}"
                    )

            return result

        except Exception as e:
            logger.error(
                f"[TranslationService] Translation failed for target '{target_code}': {e}. "
                f"Providing safe fallback to original message."
            )
            # Safe fallback: return original message without crashing
            return TranslationResult(
                translated_text=clean_text,
                source_language=source_lang or "auto",
                target_language=target_code,
                provider="original_fallback",
                confidence=1.0,
                is_fallback_original=True,
            )
