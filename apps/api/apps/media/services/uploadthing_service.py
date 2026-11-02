import contextlib
import logging
import os
import re
import uuid
from typing import Any, Optional

import requests
from apps.accounts.models.user import User
from apps.media.models.media_asset import (
    MediaAsset,
    MediaProvider,
    MediaPurpose,
    MediaStatus,
)
from common.permissions.base import is_superadmin_user
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

logger = logging.getLogger('kodinga.media')


class UploadThingService:
    """
    Handles presigned upload generation, direct binary/streaming upload,
    local storage fallback, and centralized banner image management for
    Events, Hackathons, Courses, Communities, and Profiles.
    """

    BANNER_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    BANNER_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}

    VIDEO_MIME_TYPES = [
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/ogg',
        'video/x-matroska',
        'application/octet-stream',
    ]

    ALLOWED_MIME_TYPES = {
        'avatar': ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
        'banner': BANNER_MIME_TYPES,
        'event_banner': BANNER_MIME_TYPES,
        'hackathon_banner': BANNER_MIME_TYPES,
        'course_banner': BANNER_MIME_TYPES,
        'classroom_cover': BANNER_MIME_TYPES,
        'community_banner': BANNER_MIME_TYPES,
        'post_attachment': [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/gif',
            'application/pdf',
            'text/plain',
        ],
        'lesson_attachment': [
            'application/pdf',
            'application/zip',
            'application/x-zip-compressed',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/octet-stream',
        ],
        'lesson_video': VIDEO_MIME_TYPES,
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
        'avatar': 1 * 1024 * 1024,            # 1 MB
        'banner': 5 * 1024 * 1024,            # 5 MB
        'event_banner': 5 * 1024 * 1024,      # 5 MB
        'hackathon_banner': 5 * 1024 * 1024,  # 5 MB
        'course_banner': 5 * 1024 * 1024,     # 5 MB
        'classroom_cover': 5 * 1024 * 1024,   # 5 MB
        'community_banner': 5 * 1024 * 1024,  # 5 MB
        'post_attachment': 25 * 1024 * 1024,  # 25 MB
        'lesson_attachment': 100 * 1024 * 1024, # 100 MB
        'lesson_video': 500 * 1024 * 1024,    # 500 MB (212 MB+ video lessons)
        'document': 100 * 1024 * 1024,        # 100 MB
        'general': 500 * 1024 * 1024,         # 500 MB (large video support)
    }

    @classmethod
    def _sanitize_filename(cls, file_name: str) -> str:
        base = os.path.basename(file_name or 'upload.bin')
        cleaned = re.sub(r'[^A-Za-z0-9._-]', '_', base)
        return cleaned or 'upload.bin'

    @classmethod
    def get_max_size_for_purpose(cls, purpose: str) -> int:
        if purpose in (
            'banner',
            'event_banner',
            'hackathon_banner',
            'course_banner',
            'classroom_cover',
            'community_banner',
        ):
            return int(getattr(settings, 'BANNER_MAX_FILE_SIZE_BYTES', cls.MAX_FILE_SIZES['banner']))
        if purpose == 'avatar':
            return int(getattr(settings, 'AVATAR_MAX_FILE_SIZE_BYTES', cls.MAX_FILE_SIZES['avatar']))
        if purpose in ('lesson_video', 'general'):
            return int(getattr(settings, 'VIDEO_MAX_FILE_SIZE_BYTES', cls.MAX_FILE_SIZES['general']))
        return cls.MAX_FILE_SIZES.get(purpose, 50 * 1024 * 1024)

    @classmethod
    def validate_file_constraints(
        cls,
        file_name: str,
        file_size: int,
        mime_type: str,
        purpose: str = 'general',
    ) -> None:
        normalized_mime = (mime_type or '').split(';')[0].strip().lower()
        allowed = cls.ALLOWED_MIME_TYPES.get(purpose)
        if allowed and normalized_mime not in allowed:
            raise ValidationError(
                f"Type de fichier '{normalized_mime}' non autorisé pour '{purpose}'. "
                f"Types autorisés: {', '.join(allowed)}"
            )

        if purpose in (
            'banner',
            'event_banner',
            'hackathon_banner',
            'course_banner',
            'classroom_cover',
            'community_banner',
        ):
            ext = os.path.splitext(file_name or '')[1].lower()
            if ext and ext not in cls.BANNER_EXTENSIONS:
                raise ValidationError(
                    f"Extension d'image '{ext}' non supportée pour une bannière. "
                    f"Extensions autorisées : JPEG (.jpg, .jpeg), PNG (.png), WebP (.webp)."
                )

        max_size = cls.get_max_size_for_purpose(purpose)
        if file_size > max_size:
            raise ValidationError(
                f"Le fichier dépasse la taille maximale autorisée ({max_size // (1024 * 1024)} Mo)."
            )

    @classmethod
    def get_uploadthing_credentials(cls) -> dict[str, Any]:
        """
        Parses UploadThing v7 UPLOADTHING_TOKEN (base64 JSON containing apiKey, appId, regions)
        or falls back to legacy UPLOADTHING_SECRET / UPLOADTHING_APP_ID.
        """
        token = getattr(settings, 'UPLOADTHING_TOKEN', '')
        if isinstance(token, str):
            token = token.strip("'\" \t\r\n")
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
        purpose: str = 'general',
        target_type: str = '',
        target_id: str = '',
    ) -> dict[str, Any]:
        """
        Validates file constraints and creates a pending MediaAsset with an upload URL (UploadThing v7 compliant).
        """
        if purpose not in dict(MediaPurpose.choices):
            purpose = MediaPurpose.GENERAL

        clean_name = cls._sanitize_filename(file_name)
        cls.validate_file_constraints(
            file_name=clean_name,
            file_size=file_size,
            mime_type=mime_type,
            purpose=purpose,
        )
        max_size = cls.get_max_size_for_purpose(purpose)

        file_key = f"kodinga/{purpose}/{uuid.uuid4().hex[:16]}_{clean_name}"

        credentials = cls.get_uploadthing_credentials()
        api_key = credentials.get('api_key')

        upload_url = None
        method = "POST"
        ut_key = None

        if api_key:
            try:
                prep_res = requests.post(
                    'https://api.uploadthing.com/v7/prepareUpload',
                    headers={
                        'x-uploadthing-api-key': api_key,
                        'Content-Type': 'application/json',
                        'x-uploadthing-fe-package': 'kodinga',
                        'x-uploadthing-version': '7.7.4',
                    },
                    json={
                        'fileName': clean_name,
                        'fileSize': file_size,
                        'fileType': mime_type,
                        'acl': 'public-read',
                    },
                    timeout=15,
                )
                if prep_res.status_code == 200:
                    prep_data = prep_res.json()
                    upload_url = prep_data.get('url')
                    ut_key = prep_data.get('key')
                    method = "PUT"
                else:
                    logger.warning(
                        "UploadThing prepareUpload failed (%s): %s",
                        prep_res.status_code,
                        prep_res.text,
                    )
            except Exception as exc:
                logger.error("Failed to connect to UploadThing prepareUpload: %s", exc)

        if not upload_url:
            backend_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8000').rstrip('/')
            upload_url = f"{backend_url}/api/v1/media/upload/"
            method = "POST"

        asset = MediaAsset.objects.create(
            user=user,
            file_name=clean_name,
            file_key=file_key,
            file_size=file_size,
            mime_type=mime_type,
            provider=MediaProvider.UPLOADTHING if api_key else MediaProvider.LOCAL,
            purpose=purpose,
            status=MediaStatus.PENDING,
            metadata={
                'upload_initiated_by': str(user.id) if user else None,
                'target_purpose': purpose,
                'target_type': target_type,
                'target_id': str(target_id) if target_id else '',
                'app_id': credentials.get('app_id'),
                'uploadthing_key': ut_key,
            }
        )

        return {
            'asset_id': str(asset.id),
            'file_key': file_key,
            'upload_url': upload_url,
            'method': method,
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
        asset = (
            MediaAsset.objects.filter(file_key=file_key).first()
            or MediaAsset.objects.filter(metadata__uploadthing_key=file_key).first()
        )
        if not asset:
            with contextlib.suppress(Exception):
                asset = MediaAsset.objects.get(id=file_key)
        if not asset:
            raise NotFound("Fichier média introuvable.")

        # If owned by user, verify permission
        if asset.user and user and asset.user_id != user.id and not (user.is_staff or is_superadmin_user(user)):
            raise ValidationError("Action non autorisée sur cette ressource.")

        asset.file_url = file_url
        if file_size:
            asset.file_size = file_size
        if metadata:
            current_meta = dict(asset.metadata or {})
            current_meta.update(metadata)
            asset.metadata = current_meta
        asset.status = MediaStatus.READY
        asset.save()

        meta = asset.metadata if isinstance(asset.metadata, dict) else {}
        target_type = (meta.get('target_type') or '').strip().lower()
        target_id = (meta.get('target_id') or '').strip()

        # Update profile avatar or banner ONLY if the upload is for the user's own profile
        if user and asset.purpose == MediaPurpose.AVATAR and target_type in ('', 'profile', 'user') and hasattr(user, 'profile'):
            user.profile.avatar_url = file_url
            user.profile.save(update_fields=['avatar_url', 'updated_at'])
        elif user and asset.purpose == MediaPurpose.BANNER and target_type in ('', 'profile', 'user') and hasattr(user, 'profile'):
            user.profile.banner_url = file_url
            user.profile.save(update_fields=['banner_url', 'updated_at'])
        elif target_type in ('event', 'hackathon', 'course', 'community') and target_id:
            cls._apply_banner_to_resource(
                user=user,
                target_type=target_type,
                target_id=target_id,
                community_slug=meta.get('community_slug', ''),
                banner_url=file_url,
            )

        return asset

    @classmethod
    def delete_asset(cls, user: User, asset_id: str) -> None:
        try:
            asset = MediaAsset.objects.get(id=asset_id)
        except MediaAsset.DoesNotExist as err:
            raise NotFound("Média introuvable.") from err

        if asset.user and user and asset.user_id != user.id and not (user.is_staff or is_superadmin_user(user)):
            raise ValidationError("Vous n'êtes pas propriétaire de ce média.")

        meta = asset.metadata if isinstance(asset.metadata, dict) else {}
        local_path = meta.get('local_storage_path')
        if local_path:
            with contextlib.suppress(Exception):
                if default_storage.exists(local_path):
                    default_storage.delete(local_path)

        asset.status = MediaStatus.DELETED
        asset.save(update_fields=['status', 'updated_at'])

    @classmethod
    def _save_to_local_storage(
        cls,
        user: Optional[User],
        clean_name: str,
        file_bytes: Optional[bytes],
        file_obj: Any,
        file_size: int,
        mime_type: str,
        purpose: str,
    ) -> dict[str, Any]:
        """
        Saves the uploaded file to Django's `default_storage` (`MEDIA_ROOT`) using chunked
        streaming when a file object is available, avoiding loading 200MB+ files in RAM.
        """
        file_key = f"kodinga/{purpose}/{uuid.uuid4().hex[:16]}_{clean_name}"
        if file_obj is not None and hasattr(file_obj, 'chunks'):
            if hasattr(file_obj, 'seek'):
                with contextlib.suppress(Exception):
                    file_obj.seek(0)
            saved_path = default_storage.save(file_key, file_obj)
        else:
            raw = file_bytes if file_bytes is not None else (file_obj.read() if hasattr(file_obj, 'read') else b'')
            saved_path = default_storage.save(file_key, ContentFile(raw, name=clean_name))

        storage_url = default_storage.url(saved_path)
        if storage_url.startswith('/'):
            backend_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8000').rstrip('/')
            file_url = f"{backend_url}{storage_url}"
        else:
            file_url = storage_url

        asset, _ = MediaAsset.objects.update_or_create(
            file_key=file_key,
            defaults={
                'user': user if user and getattr(user, 'is_authenticated', False) else None,
                'file_name': clean_name,
                'file_url': file_url,
                'file_size': file_size,
                'mime_type': mime_type,
                'provider': MediaProvider.LOCAL,
                'purpose': purpose if purpose in dict(MediaPurpose.choices) else MediaPurpose.GENERAL,
                'status': MediaStatus.READY,
                'metadata': {
                    'local_storage_path': saved_path,
                },
            },
        )
        return {
            'asset_id': str(asset.id),
            'file_url': file_url,
            'file_key': file_key,
            'file_size': file_size,
            'mime_type': mime_type,
            'provider': MediaProvider.LOCAL,
        }

    @classmethod
    def upload_file_direct(
        cls,
        user: User,
        file_name: str,
        file_bytes: Optional[bytes] = None,
        mime_type: str = 'application/octet-stream',
        purpose: str = 'general',
        file_obj: Any = None,
    ) -> dict[str, Any]:
        """
        Uploads binary or streamed file data directly to UploadThing via the v7 prepareUpload + ingest flow,
        or falls back to local `default_storage` if UploadThing credentials are not configured.
        Returns a dict containing 'file_url', 'file_key', 'file_size', and 'asset_id'.
        """
        clean_name = cls._sanitize_filename(file_name)

        if file_obj is not None and getattr(file_obj, 'size', None) is not None:
            file_size = int(file_obj.size)
        elif file_bytes is not None:
            if hasattr(file_bytes, 'read'):
                file_obj = file_bytes
                raw_data = file_obj.read()
                file_bytes = raw_data
                file_size = len(raw_data)
            else:
                file_size = len(file_bytes)
        else:
            raise ValidationError("Aucun contenu de fichier fourni.")

        cls.validate_file_constraints(
            file_name=clean_name,
            file_size=file_size,
            mime_type=mime_type,
            purpose=purpose,
        )

        credentials = cls.get_uploadthing_credentials()
        api_key = credentials.get('api_key')
        if not api_key:
            return cls._save_to_local_storage(
                user=user,
                clean_name=clean_name,
                file_bytes=file_bytes,
                file_obj=file_obj,
                file_size=file_size,
                mime_type=mime_type,
                purpose=purpose,
            )

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
                    'fileName': clean_name,
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

        # Step 2: PUT multipart binary/stream to the UploadThing ingest endpoint
        upload_stream = file_obj if file_obj is not None else file_bytes
        if hasattr(upload_stream, 'seek'):
            with contextlib.suppress(Exception):
                upload_stream.seek(0)

        try:
            put_res = requests.put(
                upload_url,
                files={'files': (clean_name, upload_stream, mime_type)},
                timeout=300,
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
                'file_name': clean_name,
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
            'provider': MediaProvider.UPLOADTHING,
        }

    # =========================================================================
    # Centralized Banner Service for Events, Hackathons, Courses (BE-15)
    # =========================================================================

    @classmethod
    def _resolve_target_resource(
        cls,
        user: User,
        target_type: str,
        target_id: str,
        community_slug: str = '',
    ):
        ttype = (target_type or '').strip().lower()
        tid = str(target_id or '').strip()
        if not ttype or not tid:
            return None, None

        if ttype == 'event':
            from apps.events.models.event import Event
            from apps.events.services.event_service import EventService

            qs = Event.objects.select_related('community')
            if community_slug:
                qs = qs.filter(community__slug=community_slug)
            event = None
            with contextlib.suppress(Exception):
                event = qs.filter(id=tid).first()
            if not event:
                event = qs.filter(slug=tid).first()
            if not event:
                raise NotFound("Événement cible introuvable.")
            if event.host_id != user.id:
                EventService.check_is_manager(user, event.community)
            return event, 'cover_image_url'

        if ttype == 'hackathon':
            from apps.hackathons.models.hackathon import Hackathon
            from apps.hackathons.services.hackathon_service import HackathonService

            qs = Hackathon.objects.select_related('community')
            if community_slug:
                qs = qs.filter(community__slug=community_slug)
            hackathon = None
            with contextlib.suppress(Exception):
                hackathon = qs.filter(id=tid).first()
            if not hackathon:
                hackathon = qs.filter(slug=tid).first()
            if not hackathon:
                raise NotFound("Hackathon cible introuvable.")
            if hackathon.organizer_id != user.id:
                HackathonService.require_manager(user, hackathon.community)
            return hackathon, 'cover_image_url'

        if ttype == 'course':
            from apps.classroom.models.course import Course
            from apps.classroom.services.classroom_service import ClassroomService

            qs = Course.objects.select_related('community')
            if community_slug:
                qs = qs.filter(community__slug=community_slug)
            course = None
            with contextlib.suppress(Exception):
                course = qs.filter(id=tid).first()
            if not course:
                course = qs.filter(slug=tid).first()
            if not course:
                raise NotFound("Formation cible introuvable.")
            ClassroomService.check_manager_permission(user, course.community)
            return course, 'thumbnail_url'

        if ttype == 'community':
            from apps.communities.models.community import Community
            from apps.memberships.permissions import check_community_permission

            qs = Community.objects.all()
            community = None
            with contextlib.suppress(Exception):
                community = qs.filter(id=tid).first()
            if not community:
                community = qs.filter(slug=tid).first()
            if not community:
                raise NotFound("Communauté cible introuvable.")
            if not is_superadmin_user(user) and community.owner_id != user.id:
                check_community_permission(user, community, 'can_edit_community', "modifier la bannière de la communauté")
            return community, 'banner_url'

        if ttype in ('profile', 'user'):
            if not hasattr(user, 'profile'):
                raise NotFound("Profil introuvable.")
            return user.profile, 'banner_url'

        raise ValidationError(
            {"target_type": "Type de ressource invalide. Valeurs supportées : event, hackathon, course, community, profile."}
        )

    @classmethod
    def _apply_banner_to_resource(
        cls,
        user: User,
        target_type: str,
        target_id: str,
        community_slug: str,
        banner_url: str,
    ) -> dict[str, Any]:
        instance, field_name = cls._resolve_target_resource(
            user=user,
            target_type=target_type,
            target_id=target_id,
            community_slug=community_slug,
        )
        if not instance or not field_name:
            return {}

        previous_url = getattr(instance, field_name, '') or ''
        if previous_url and previous_url != banner_url:
            old_assets = MediaAsset.objects.filter(
                file_url=previous_url, status=MediaStatus.READY
            )
            for old_asset in old_assets:
                with contextlib.suppress(Exception):
                    cls.delete_asset(user=old_asset.user or user, asset_id=str(old_asset.id))

        setattr(instance, field_name, banner_url)
        instance.save(update_fields=[field_name, 'updated_at'])
        return {
            'target_type': target_type,
            'target_id': str(instance.id),
            'field_updated': field_name,
            'previous_url': previous_url,
            'banner_url': banner_url,
        }

    @classmethod
    def upload_banner(
        cls,
        user: User,
        file_obj: Any,
        target_type: str = '',
        target_id: str = '',
        community_slug: str = '',
    ) -> dict[str, Any]:
        """
        Validates, uploads, and optionally links a banner image (JPEG, PNG, WebP)
        to an Event, Hackathon, Course, Community, or Profile.
        """
        if not user or not user.is_authenticated:
            raise PermissionDenied("Authentification requise.")

        if not file_obj:
            raise ValidationError({"file": "Aucun fichier d'image de bannière fourni."})

        purpose_map = {
            'event': MediaPurpose.EVENT_BANNER,
            'hackathon': MediaPurpose.HACKATHON_BANNER,
            'course': MediaPurpose.COURSE_BANNER,
            'community': MediaPurpose.COMMUNITY_BANNER,
        }
        purpose = purpose_map.get((target_type or '').strip().lower(), MediaPurpose.BANNER)

        file_name = getattr(file_obj, 'name', 'banner.jpg') or 'banner.jpg'
        mime_type = getattr(file_obj, 'content_type', '') or ''
        if not mime_type or mime_type == 'application/octet-stream':
            ext = os.path.splitext(file_name)[1].lower()
            ext_map = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
            }
            mime_type = ext_map.get(ext, mime_type or 'image/jpeg')

        # Pre-check permissions on target resource before uploading if target_type & target_id are specified
        if target_type and target_id:
            cls._resolve_target_resource(
                user=user,
                target_type=target_type,
                target_id=target_id,
                community_slug=community_slug,
            )

        upload_result = cls.upload_file_direct(
            user=user,
            file_name=file_name,
            mime_type=mime_type,
            purpose=purpose,
            file_obj=file_obj,
        )
        file_url = upload_result['file_url']

        link_info = {}
        if target_type and target_id:
            link_info = cls._apply_banner_to_resource(
                user=user,
                target_type=target_type,
                target_id=target_id,
                community_slug=community_slug,
                banner_url=file_url,
            )

        return {
            **upload_result,
            'url': file_url,
            'banner_url': file_url,
            'cover_image_url': file_url,
            'thumbnail_url': file_url,
            **link_info,
        }

    @classmethod
    def remove_banner(
        cls,
        user: User,
        target_type: str,
        target_id: str,
        community_slug: str = '',
    ) -> dict[str, Any]:
        """
        Removes the banner from an Event, Hackathon, Course, Community, or Profile
        and marks the underlying MediaAsset as deleted.
        """
        if not user or not user.is_authenticated:
            raise PermissionDenied("Authentification requise.")
        if not target_type or not target_id:
            raise ValidationError(
                "Les paramètres 'target_type' et 'target_id' sont requis pour supprimer une bannière."
            )
        return cls._apply_banner_to_resource(
            user=user,
            target_type=target_type,
            target_id=target_id,
            community_slug=community_slug,
            banner_url='',
        )
