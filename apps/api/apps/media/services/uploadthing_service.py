import logging
import uuid
from typing import Any

import requests
from django.conf import settings
from rest_framework.exceptions import NotFound, ValidationError

from apps.accounts.models.user import User
from apps.media.models.media_asset import (
    MediaAsset,
    MediaProvider,
    MediaPurpose,
    MediaStatus,
)
from common.permissions.base import is_superadmin_user

logger = logging.getLogger('kodinga.media')


class UploadThingService:
    """
    Handles presigned upload generation and confirmation for UploadThing / Object storage.
    """

    ALLOWED_MIME_TYPES = {
        'avatar': ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        'banner': ['image/jpeg', 'image/png', 'image/webp'],
        'post_attachment': ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'],
        'lesson_attachment': ['application/pdf', 'application/zip', 'text/plain', 'image/jpeg', 'image/png'],
        'document': [
            'application/pdf',
            'application/zip',
            'application/msword',
            'text/plain',
            'video/mp4',
            'video/webm',
            'video/quicktime',
        ],
        'general': None,
    }

    MAX_FILE_SIZES = {
        'avatar': 5 * 1024 * 1024,          # 5 MB
        'banner': 10 * 1024 * 1024,         # 10 MB
        'post_attachment': 25 * 1024 * 1024,# 25 MB
        'lesson_attachment': 100 * 1024 * 1024, # 100 MB
        'document': 100 * 1024 * 1024,       # 100 MB
        'general': 500 * 1024 * 1024,        # 500 MB (large demo video support)
    }

    @classmethod
    def get_uploadthing_credentials(cls) -> dict[str, Any]:
        """
        Parses UploadThing v7 UPLOADTHING_TOKEN (base64 JSON containing apiKey, appId, regions)
        or falls back to legacy UPLOADTHING_SECRET / UPLOADTHING_APP_ID.
        """
        token = getattr(settings, 'UPLOADTHING_TOKEN', '').strip()
        if token:
            try:
                import base64
                import json
                decoded = base64.b64decode(token).decode('utf-8')
                parsed = json.loads(decoded)
                return {
                    'api_key': parsed.get('apiKey', ''),
                    'app_id': parsed.get('appId', ''),
                    'regions': parsed.get('regions', ['fra1']),
                }
            except Exception:
                return {'api_key': token, 'app_id': '', 'regions': ['fra1']}

        return {
            'api_key': getattr(settings, 'UPLOADTHING_SECRET', '').strip(),
            'app_id': getattr(settings, 'UPLOADTHING_APP_ID', '').strip(),
            'regions': ['fra1'],
        }

    @classmethod
    def generate_upload_url(
        cls,
        user: User,
        file_name: str,
        file_size: int,
        mime_type: str,
        purpose: str = 'general'
    ) -> dict[str, Any]:
        """
        Validates file constraints and creates a pending MediaAsset with an upload URL (UploadThing v7 compliant).
        """
        # Validate purpose
        if purpose not in dict(MediaPurpose.choices):
            purpose = MediaPurpose.GENERAL

        # Validate MIME type
        allowed = cls.ALLOWED_MIME_TYPES.get(purpose)
        if allowed and mime_type not in allowed:
            raise ValidationError(
                f"Type de fichier non autorisé pour '{purpose}'. Types autorisés: {', '.join(allowed)}"
            )

        # Validate file size
        max_size = cls.MAX_FILE_SIZES.get(purpose, 50 * 1024 * 1024)
        if file_size > max_size:
            raise ValidationError(
                f"Le fichier dépasse la taille maximale autorisée ({max_size // (1024 * 1024)} Mo)."
            )

        file_key = f"kodinga/{purpose}/{uuid.uuid4().hex[:16]}_{file_name}"
        
        credentials = cls.get_uploadthing_credentials()
        api_key = credentials.get('api_key')
        
        # UploadThing v7 API URL or direct client presigned URL
        upload_url = "https://api.uploadthing.com/v6/uploadFiles" if api_key else f"https://api.kodinga.com/upload-mock/{file_key}"

        asset = MediaAsset.objects.create(
            user=user,
            file_name=file_name,
            file_key=file_key,
            file_size=file_size,
            mime_type=mime_type,
            provider=MediaProvider.UPLOADTHING,
            purpose=purpose,
            status=MediaStatus.PENDING,
            metadata={
                'upload_initiated_by': str(user.id) if user else None,
                'target_purpose': purpose,
                'app_id': credentials.get('app_id')
            }
        )

        return {
            'asset_id': str(asset.id),
            'file_key': file_key,
            'upload_url': upload_url,
            'fields': {
                'key': file_key,
                'Content-Type': mime_type,
            },
            'max_file_size': max_size,
        }

    @classmethod
    def confirm_upload(
        cls,
        user: User,
        file_key: str,
        file_url: str,
        file_size: int = None,
        metadata: dict[str, Any] = None,
    ) -> MediaAsset:
        """
        Confirms successful upload of the file, marks asset READY and records URL.
        """
        try:
            asset = MediaAsset.objects.get(file_key=file_key)
        except MediaAsset.DoesNotExist as err:
            raise NotFound("Fichier média introuvable.") from err

        # If owned by user, verify permission
        if asset.user and user and asset.user_id != user.id and not (user.is_staff or is_superadmin_user(user)):
            raise ValidationError("Action non autorisée sur cette ressource.")

        asset.file_url = file_url
        if file_size:
            asset.file_size = file_size
        if metadata:
            asset.metadata.update(metadata)
        asset.status = MediaStatus.READY
        asset.save()

        # Update profile avatar or banner if uploaded for that purpose
        if user and asset.purpose == MediaPurpose.AVATAR and hasattr(user, 'profile'):
            user.profile.avatar_url = file_url
            user.profile.save(update_fields=['avatar_url', 'updated_at'])
        elif user and asset.purpose == MediaPurpose.BANNER and hasattr(user, 'profile'):
            user.profile.banner_url = file_url
            user.profile.save(update_fields=['banner_url', 'updated_at'])

        return asset

    @classmethod
    def delete_asset(cls, user: User, asset_id: str) -> None:
        try:
            asset = MediaAsset.objects.get(id=asset_id)
        except MediaAsset.DoesNotExist as err:
            raise NotFound("Média introuvable.") from err

        if asset.user and user and asset.user_id != user.id and not (user.is_staff or is_superadmin_user(user)):
            raise ValidationError("Vous n'êtes pas propriétaire de ce média.")

        asset.status = MediaStatus.DELETED
        asset.save(update_fields=['status', 'updated_at'])

    @classmethod
    def upload_file_direct(
        cls,
        user: User,
        file_name: str,
        file_bytes: bytes,
        mime_type: str,
        purpose: str = 'general',
    ) -> dict[str, Any]:
        """
        Uploads binary file data directly to UploadThing via the v7 prepareUpload + ingest flow.
        Returns a dict containing 'file_url', 'file_key', 'file_size', and 'asset_id'.
        """
        credentials = cls.get_uploadthing_credentials()
        api_key = credentials.get('api_key')
        if not api_key:
            raise ValidationError("UploadThing API key non configurée.")

        file_size = len(file_bytes)

        # Step 1: Request presigned ingestion URL from UploadThing v7 API
        try:
            prepare_res = requests.post(
                'https://api.uploadthing.com/v7/prepareUpload',
                headers={
                    'x-uploadthing-api-key': api_key,
                    'Content-Type': 'application/json',
                    'x-uploadthing-fe-package': 'kodinga',
                    'x-uploadthing-version': '7.7.4',
                },
                json={
                    'fileName': file_name,
                    'fileSize': file_size,
                    'fileType': mime_type,
                    'acl': 'public-read',
                },
                timeout=30,
            )
        except Exception as exc:
            logger.error("UploadThing prepareUpload request error: %s", exc)
            raise ValidationError("Impossible de contacter le service de stockage UploadThing.") from exc

        if prepare_res.status_code != 200:
            logger.error("UploadThing prepareUpload failed: %s %s", prepare_res.status_code, prepare_res.text)
            raise ValidationError(f"Échec de préparation du stockage UploadThing ({prepare_res.status_code}).")

        prep_data = prepare_res.json()
        upload_url = prep_data.get('url')
        file_key = prep_data.get('key')

        if not upload_url or not file_key:
            raise ValidationError("Réponse UploadThing invalide (URL ou clé manquante).")

        # Step 2: PUT multipart binary to the UploadThing ingest endpoint
        try:
            put_res = requests.put(
                upload_url,
                files={'files': (file_name, file_bytes, mime_type)},
                timeout=120,
            )
        except Exception as exc:
            logger.error("UploadThing PUT ingestion request error: %s", exc)
            raise ValidationError("Échec lors du téléversement vers UploadThing.") from exc

        if put_res.status_code != 200:
            logger.error("UploadThing ingestion failed: %s %s", put_res.status_code, put_res.text)
            raise ValidationError(f"Échec du transfert vers UploadThing ({put_res.status_code}).")

        put_data = put_res.json()
        file_url = put_data.get('ufsUrl') or put_data.get('url') or f"https://utfs.io/f/{file_key}"

        # Step 3: Record MediaAsset in database
        asset, _ = MediaAsset.objects.update_or_create(
            file_key=file_key,
            defaults={
                'user': user if user and user.is_authenticated else None,
                'file_name': file_name,
                'file_url': file_url,
                'file_size': file_size,
                'mime_type': mime_type,
                'provider': MediaProvider.UPLOADTHING,
                'purpose': purpose if purpose in dict(MediaPurpose.choices) else MediaPurpose.GENERAL,
                'status': MediaStatus.READY,
                'metadata': {
                    'app_id': credentials.get('app_id'),
                    'file_hash': put_data.get('fileHash'),
                },
            },
        )

        return {
            'asset_id': str(asset.id),
            'file_url': file_url,
            'file_key': file_key,
            'file_size': file_size,
            'mime_type': mime_type,
        }
