import contextlib
import os
from datetime import timedelta
from typing import Any, Optional

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.communities.models.settings import PostPermissionType
from apps.media.models.media_asset import MediaAsset, MediaStatus
from apps.media.models.video_asset import VideoAsset, VideoStatus
from apps.memberships.models.member import (
    CommunityMember,
    MembershipStatus,
)
from apps.memberships.permissions import (
    check_community_membership,
)
from apps.posts.models.category import PostCategory
from apps.posts.models.comment import Comment
from apps.posts.models.poll import Poll, PollOption, PollVote
from apps.posts.models.post import Post, PostType
from apps.posts.models.reaction import (
    CommentReaction,
    PostReaction,
)
from common.permissions.base import is_superadmin_user


class PostService:
    """
    Handles lifecycle and interaction logic for community posts, polls, comments, and reactions.
    """

    @classmethod
    def _verify_post_permission(
        cls,
        user: User,
        community: Community,
        category: Optional[PostCategory] = None,
    ) -> Optional[CommunityMember]:
        if is_superadmin_user(user):
            return None

        check_community_membership(user, community, "publier dans cette communauté")

        membership = CommunityMember.objects.filter(
            community=community,
            user=user,
            status=MembershipStatus.ACTIVE,
        ).first()

        # Check read-only mode: only owner and moderators/admins can post
        comm_settings = getattr(community, "settings", None)
        if comm_settings and comm_settings.is_read_only:
            is_owner = community.owner_id == user.id
            is_moderator = membership and membership.is_moderator
            if not (is_owner or is_moderator):
                raise PermissionDenied(
                    "Cette communauté est en mode lecture seule. Seuls les administrateurs peuvent publier."
                )

        # Check community-wide posting permission
        if comm_settings:
            if (
                comm_settings.default_post_permission == PostPermissionType.ADMINS_ONLY
                and not membership.is_admin
            ):
                raise PermissionDenied(
                    "Seuls les administrateurs peuvent publier dans cette communauté."
                )
            if (
                comm_settings.default_post_permission
                == PostPermissionType.MODERATORS_ONLY
                and not membership.is_moderator
            ):
                raise PermissionDenied(
                    "Seuls les modérateurs peuvent publier dans cette communauté."
                )

        # Check restricted category / channel
        if category and category.is_restricted and not membership.is_moderator:
            raise PermissionDenied(
                f"Le canal #{category.slug} est réservé aux modérateurs."
            )

        return membership

    @classmethod
    def upload_and_extract_multipart_files(
        cls,
        user: User,
        files_dict: Any,
    ) -> tuple[list[str], list[str]]:
        """
        Allows direct multipart attachment of images, documents, and videos when creating
        or updating a Feed post or comment (e.g., fields: 'image', 'images', 'file', 'files',
        'document', 'documents', 'video', 'videos').
        Uploads images/documents via UploadThing and videos via UploadThing + Mux,
        returning (media_ids, video_ids).
        """
        if not files_dict:
            return [], []

        from apps.media.services.mux_service import MuxVideoService
        from apps.media.services.uploadthing_service import UploadThingService

        extracted_media_ids: list[str] = []
        extracted_video_ids: list[str] = []

        file_keys = (
            "image",
            "images",
            "document",
            "documents",
            "file",
            "files",
            "attachment",
            "attachments",
            "video",
            "videos",
        )
        collected_files: list[tuple[str, Any]] = []
        for key in file_keys:
            if hasattr(files_dict, "getlist"):
                for f_obj in files_dict.getlist(key):
                    if f_obj:
                        collected_files.append((key, f_obj))
            elif key in files_dict and files_dict[key]:
                collected_files.append((key, files_dict[key]))

        max_total = int(getattr(settings, "POST_MAX_TOTAL_ATTACHMENTS", 10))
        if len(collected_files) > max_total:
            raise ValidationError(
                f"Une publication ne peut pas contenir plus de {max_total} pièces jointes au total."
            )

        for key, f_obj in collected_files:
            f_name = getattr(f_obj, "name", "upload.bin") or "upload.bin"
            f_mime = (
                getattr(f_obj, "content_type", "application/octet-stream")
                or "application/octet-stream"
            )
            f_size = getattr(f_obj, "size", None)
            ext = os.path.splitext(f_name)[1].lower()
            norm_mime = f_mime.split(";")[0].strip().lower()

            is_video = (
                key in ("video", "videos")
                or norm_mime.startswith("video/")
                or ext in UploadThingService.POST_VIDEO_EXTENSIONS
            )
            is_image = (
                key in ("image", "images")
                or norm_mime.startswith("image/")
                or ext in UploadThingService.POST_IMAGE_EXTENSIONS
            )

            if is_video:
                MuxVideoService.validate_video_constraints(
                    file_name=f_name,
                    file_size=f_size,
                    mime_type=f_mime,
                    purpose="post_video",
                )
                ut_res = UploadThingService.upload_file_direct(
                    user=user,
                    file_name=f_name,
                    mime_type=f_mime,
                    purpose="post_video",
                    file_obj=f_obj,
                )
                video_asset = MuxVideoService.create_asset_from_url(
                    user=user,
                    input_url=ut_res["file_url"],
                    title=f_name,
                )
                asset_meta = (
                    video_asset.metadata
                    if isinstance(video_asset.metadata, dict)
                    else {}
                )
                if asset_meta.get("mux_fallback"):
                    video_asset.provider = "uploadthing"
                    video_asset.status = VideoStatus.READY

                v_meta = dict(video_asset.metadata or {})
                v_meta.update(
                    {
                        "media_asset_id": ut_res.get("asset_id"),
                        "file_key": ut_res.get("file_key"),
                        "file_name": f_name,
                        "file_size": ut_res.get("file_size"),
                        "mime_type": f_mime,
                        "source_url": ut_res["file_url"],
                        "file_url": ut_res["file_url"],
                        "source_provider": "uploadthing",
                    }
                )
                video_asset.metadata = v_meta
                video_asset.save(
                    update_fields=["provider", "status", "metadata", "updated_at"]
                )
                extracted_video_ids.append(str(video_asset.id))
            else:
                purpose = "post_image" if is_image else "post_document"
                ut_res = UploadThingService.upload_file_direct(
                    user=user,
                    file_name=f_name,
                    mime_type=f_mime,
                    purpose=purpose,
                    file_obj=f_obj,
                )
                extracted_media_ids.append(str(ut_res["asset_id"]))

        return extracted_media_ids, extracted_video_ids

    @classmethod
    def _validate_and_resolve_post_attachments(
        cls,
        user: User,
        media_ids: Optional[list[Any]] = None,
        video_ids: Optional[list[Any]] = None,
    ) -> tuple[list[MediaAsset], list[VideoAsset]]:
        """
        Resolves and validates MediaAsset (images, documents) and VideoAsset (Mux videos) IDs:
        - Checks ownership (anti-IDOR: user must own each attachment unless superadmin)
        - Checks that no attachment is deleted
        - Enforces centralized quotas:
          * Max 10 images (POST_MAX_IMAGES)
          * Max 3 videos (POST_MAX_VIDEOS)
          * Max 10 documents (POST_MAX_DOCUMENTS)
          * Max 10 total attachments per post (POST_MAX_TOTAL_ATTACHMENTS)
        - Preserves attachment display order in metadata['post_order'].
        """
        raw_media_ids = [str(mid) for mid in (media_ids or [])]
        raw_video_ids = [str(vid) for vid in (video_ids or [])]

        ordered_tokens: list[tuple[str, str]] = []
        seen: set[str] = set()
        for mid in raw_media_ids:
            if mid not in seen:
                seen.add(mid)
                ordered_tokens.append(("auto", mid))
        for vid in raw_video_ids:
            if vid not in seen:
                seen.add(vid)
                ordered_tokens.append(("video", vid))

        if not ordered_tokens:
            return [], []

        max_total = int(getattr(settings, "POST_MAX_TOTAL_ATTACHMENTS", 10))
        max_images = int(getattr(settings, "POST_MAX_IMAGES", 10))
        max_videos = int(getattr(settings, "POST_MAX_VIDEOS", 3))
        max_documents = int(getattr(settings, "POST_MAX_DOCUMENTS", 10))

        all_uuids = [uid for _, uid in ordered_tokens]
        media_map = {str(a.id): a for a in MediaAsset.objects.filter(id__in=all_uuids)}
        video_map = {str(v.id): v for v in VideoAsset.objects.filter(id__in=all_uuids)}

        resolved_media: list[MediaAsset] = []
        resolved_videos: list[VideoAsset] = []
        images_count = 0
        videos_count = 0
        documents_count = 0
        is_super = is_superadmin_user(user)

        for idx, (hint, uid) in enumerate(ordered_tokens):
            if hint == "video" or (uid in video_map and uid not in media_map):
                video = video_map.get(uid)
                if not video or video.status == VideoStatus.DELETED:
                    raise ValidationError(
                        f"La vidéo '{uid}' est introuvable ou supprimée."
                    )
                if not is_super and video.user_id and video.user_id != user.id:
                    raise PermissionDenied(
                        "Vous ne pouvez pas joindre une vidéo appartenant à un autre utilisateur."
                    )
                videos_count += 1
                meta = dict(video.metadata) if isinstance(video.metadata, dict) else {}
                meta["post_order"] = idx
                video.metadata = meta
                video.save(update_fields=["metadata", "updated_at"])
                resolved_videos.append(video)
            elif uid in media_map:
                asset = media_map[uid]
                if asset.status == MediaStatus.DELETED:
                    raise ValidationError(f"Le média '{uid}' a été supprimé.")
                if not is_super and asset.user_id and asset.user_id != user.id:
                    raise PermissionDenied(
                        "Vous ne pouvez pas joindre un fichier appartenant à un autre utilisateur."
                    )

                linked_video_id = (
                    (asset.metadata or {}).get("video_asset_id")
                    if isinstance(asset.metadata, dict)
                    else None
                )
                if asset.media_category == "VIDEO" and linked_video_id:
                    linked_video = (
                        VideoAsset.objects.filter(id=linked_video_id)
                        .exclude(status=VideoStatus.DELETED)
                        .first()
                    )
                    if linked_video:
                        videos_count += 1
                        v_meta = (
                            dict(linked_video.metadata)
                            if isinstance(linked_video.metadata, dict)
                            else {}
                        )
                        v_meta["post_order"] = idx
                        linked_video.metadata = v_meta
                        linked_video.save(update_fields=["metadata", "updated_at"])
                        resolved_videos.append(linked_video)
                        continue

                cat = asset.media_category
                if cat == "IMAGE":
                    images_count += 1
                elif cat == "VIDEO":
                    videos_count += 1
                else:
                    documents_count += 1

                meta = dict(asset.metadata) if isinstance(asset.metadata, dict) else {}
                meta["post_order"] = idx
                asset.metadata = meta
                asset.save(update_fields=["metadata", "updated_at"])
                resolved_media.append(asset)
            else:
                raise ValidationError(f"Pièce jointe '{uid}' introuvable.")

        if images_count > max_images:
            raise ValidationError(
                f"Limite dépassée : maximum {max_images} images autorisées par publication (reçu : {images_count})."
            )
        if videos_count > max_videos:
            raise ValidationError(
                f"Limite dépassée : maximum {max_videos} vidéos autorisées par publication (reçu : {videos_count})."
            )
        if documents_count > max_documents:
            raise ValidationError(
                f"Limite dépassée : maximum {max_documents} documents autorisés par publication (reçu : {documents_count})."
            )
        if (images_count + videos_count + documents_count) > max_total:
            raise ValidationError(
                f"Limite globale dépassée : maximum {max_total} pièces jointes par publication."
            )

        return resolved_media, resolved_videos

    @classmethod
    def create_post(
        cls,
        author: User,
        community: Community,
        data: dict[str, Any],
        poll_data: Optional[dict[str, Any]] = None,
        media_ids: Optional[list[str]] = None,
        video_ids: Optional[list[str]] = None,
    ) -> Post:
        category = None
        category_id = data.pop("category_id", None)
        if category_id:
            try:
                category = PostCategory.objects.get(id=category_id, community=community)
                data["category"] = category
            except PostCategory.DoesNotExist as err:
                raise ValidationError(
                    {"category_id": "Catégorie / Canal introuvable."}
                ) from err

        cls._verify_post_permission(author, community, category)

        resolved_media, resolved_videos = cls._validate_and_resolve_post_attachments(
            user=author,
            media_ids=media_ids,
            video_ids=video_ids,
        )

        # Mandatory pre-publication content moderation
        from apps.ai.services.moderation_service import ModerationService

        text_to_moderate = f"{data.get('title', '')}\n{data.get('content', '')}".strip()
        ModerationService.enforce_pre_publication(
            text_to_moderate, community=community, author=author
        )

        with transaction.atomic():
            post = Post.objects.create(
                author=author,
                community=community,
                **data,
            )

            if resolved_media:
                post.media_attachments.set(resolved_media)
            if resolved_videos:
                post.video_attachments.set(resolved_videos)

            # Create embedded poll if specified
            if poll_data:
                options = poll_data.get("options", [])
                if len(options) < 2:
                    raise ValidationError(
                        {"poll": "Un sondage doit comporter au moins 2 options."}
                    )

                duration_days = poll_data.get("duration_days", 7)
                expires_at = (
                    timezone.now() + timedelta(days=duration_days)
                    if duration_days
                    else None
                )

                poll = Poll.objects.create(
                    post=post,
                    question=poll_data.get("question", post.title or "Sondage"),
                    is_multiple_choice=poll_data.get("is_multiple_choice", False),
                    expires_at=expires_at,
                )

                for idx, opt_text in enumerate(options):
                    PollOption.objects.create(
                        poll=poll,
                        text=opt_text.strip(),
                        order=idx,
                    )

                post.post_type = PostType.POLL
                post.save(update_fields=["post_type", "updated_at"])

            Community.objects.filter(id=community.id).update(
                posts_count=F("posts_count") + 1
            )
            from apps.gamification.services.gamification_service import (
                GamificationService,
            )

            GamificationService.award_post_created(user=author, post=post)
            from realtime.broadcast import broadcast_post_created

            broadcast_post_created(post)
            return post

    @classmethod
    def update_post(
        cls,
        user: User,
        post: Post,
        data: dict[str, Any],
        media_ids: Optional[list[str]] = None,
        video_ids: Optional[list[str]] = None,
    ) -> Post:
        if not is_superadmin_user(user) and post.author_id != user.id:
            raise PermissionDenied("Vous n'êtes pas l'auteur de cette publication.")

        category_id = data.pop("category_id", None)
        if category_id is not None:
            if category_id:
                try:
                    data["category"] = PostCategory.objects.get(
                        id=category_id, community=post.community
                    )
                except PostCategory.DoesNotExist as err:
                    raise ValidationError(
                        {"category_id": "Catégorie introuvable."}
                    ) from err
            else:
                data["category"] = None

        resolved_media = None
        resolved_videos = None
        if media_ids is not None or video_ids is not None:
            effective_media_ids = (
                media_ids
                if media_ids is not None
                else [
                    str(a.id)
                    for a in post.media_attachments.exclude(status=MediaStatus.DELETED)
                ]
            )
            effective_video_ids = (
                video_ids
                if video_ids is not None
                else [
                    str(v.id)
                    for v in post.video_attachments.exclude(status=VideoStatus.DELETED)
                ]
            )
            resolved_media, resolved_videos = (
                cls._validate_and_resolve_post_attachments(
                    user=user,
                    media_ids=effective_media_ids,
                    video_ids=effective_video_ids,
                )
            )

        with transaction.atomic():
            for key, value in data.items():
                setattr(post, key, value)
            post.save()

            if resolved_media is not None:
                post.media_attachments.set(resolved_media)
            if resolved_videos is not None:
                post.video_attachments.set(resolved_videos)

            from realtime.broadcast import broadcast_post_updated

            broadcast_post_updated(post)
            return post

    @classmethod
    def remove_post_media(cls, user: User, post: Post, media_id: str) -> None:
        """
        Detaches a specific media (MediaAsset or VideoAsset) from a post and deletes
        the underlying storage asset if it is no longer attached to any other post.
        """
        if (
            not is_superadmin_user(user)
            and post.author_id != user.id
            and post.community.owner_id != user.id
        ):
            membership = CommunityMember.objects.filter(
                community=post.community,
                user=user,
                status=MembershipStatus.ACTIVE,
            ).first()
            if not membership or not membership.is_moderator:
                raise PermissionDenied(
                    "Vous n'avez pas la permission de supprimer ce média."
                )

        media_asset = post.media_attachments.filter(id=media_id).first()
        video_asset = post.video_attachments.filter(id=media_id).first()

        if not media_asset and not video_asset:
            raise NotFound("Média introuvable sur cette publication.")

        with transaction.atomic():
            if media_asset:
                post.media_attachments.remove(media_asset)
                if not media_asset.attached_posts.exists():
                    with contextlib.suppress(Exception):
                        from apps.media.services.uploadthing_service import (
                            UploadThingService,
                        )

                        UploadThingService.delete_asset(
                            user=media_asset.user or user, asset_id=str(media_asset.id)
                        )

            if video_asset:
                post.video_attachments.remove(video_asset)
                if not video_asset.attached_posts.exists():
                    with contextlib.suppress(Exception):
                        from apps.media.services.mux_service import MuxVideoService

                        MuxVideoService.delete_video(
                            user=video_asset.user or user, video_id=str(video_asset.id)
                        )

            from realtime.broadcast import broadcast_post_updated

            broadcast_post_updated(post)

    @classmethod
    def delete_post(cls, user: User, post: Post) -> None:
        if (
            not is_superadmin_user(user)
            and post.author_id != user.id
            and post.community.owner_id != user.id
        ):
            membership = CommunityMember.objects.filter(
                community=post.community,
                user=user,
                status=MembershipStatus.ACTIVE,
            ).first()
            if not membership or not membership.is_moderator:
                raise PermissionDenied(
                    "Droits de modération requis pour supprimer ce post."
                )

        attached_media = list(post.media_attachments.all())
        attached_videos = list(post.video_attachments.all())

        with transaction.atomic():
            community_id = post.community_id
            post_id = post.id
            post.media_attachments.clear()
            post.video_attachments.clear()
            post.delete()
            Community.objects.filter(id=community_id, posts_count__gt=0).update(
                posts_count=F("posts_count") - 1
            )

            for m_asset in attached_media:
                if not m_asset.attached_posts.exists():
                    with contextlib.suppress(Exception):
                        from apps.media.services.uploadthing_service import (
                            UploadThingService,
                        )

                        UploadThingService.delete_asset(
                            user=m_asset.user or user, asset_id=str(m_asset.id)
                        )

            for v_asset in attached_videos:
                if not v_asset.attached_posts.exists():
                    with contextlib.suppress(Exception):
                        from apps.media.services.mux_service import MuxVideoService

                        MuxVideoService.delete_video(
                            user=v_asset.user or user, video_id=str(v_asset.id)
                        )

            from realtime.broadcast import broadcast_post_deleted

            broadcast_post_deleted(community_id, post_id)

    @classmethod
    def toggle_post_pin(cls, user: User, post: Post) -> bool:
        if not is_superadmin_user(user) and post.community.owner_id != user.id:
            membership = CommunityMember.objects.filter(
                community=post.community,
                user=user,
                status=MembershipStatus.ACTIVE,
            ).first()
            if not membership or not membership.is_moderator:
                raise PermissionDenied(
                    "Seul le propriétaire ou un modérateur peut épingler une publication."
                )

        post.is_pinned = not post.is_pinned
        post.save(update_fields=["is_pinned", "updated_at"])
        from realtime.broadcast import broadcast_post_pinned

        broadcast_post_pinned(post.community_id, post.id, post.is_pinned)
        return post.is_pinned

    @classmethod
    def toggle_post_lock(cls, user: User, post: Post) -> bool:
        if not is_superadmin_user(user) and post.community.owner_id != user.id:
            membership = CommunityMember.objects.filter(
                community=post.community,
                user=user,
                status=MembershipStatus.ACTIVE,
            ).first()
            if not membership or not membership.is_moderator:
                raise PermissionDenied("Droits de modération requis.")

        post.is_locked = not post.is_locked
        post.save(update_fields=["is_locked", "updated_at"])
        from realtime.broadcast import broadcast_post_locked

        broadcast_post_locked(post.community_id, post.id, post.is_locked)
        return post.is_locked

    # --- Comments ---

    @classmethod
    def create_comment(
        cls,
        author: User,
        post: Post,
        content: str,
        parent_id: Optional[str] = None,
        media_ids: Optional[list[str]] = None,
    ) -> Comment:
        if post.is_locked and not is_superadmin_user(author):
            raise ValidationError(
                "Les commentaires sont verrouillés sur cette publication."
            )

        if not is_superadmin_user(author):
            check_community_membership(
                author, post.community, "commenter cette publication"
            )

            membership = CommunityMember.objects.filter(
                community=post.community,
                user=author,
                status=MembershipStatus.ACTIVE,
            ).first()

            comm_settings = getattr(post.community, "settings", None)
            if comm_settings and comm_settings.is_read_only:
                is_owner = post.community.owner_id == author.id
                is_moderator = membership.is_moderator if membership else False
                if not (is_owner or is_moderator):
                    raise PermissionDenied(
                        "Cette communauté est en mode lecture seule. Seul le propriétaire ou un modérateur peut commenter."
                    )

        parent = None
        if parent_id:
            try:
                parent = Comment.objects.get(id=parent_id, post=post)
            except Comment.DoesNotExist as err:
                raise ValidationError(
                    {"parent_id": "Commentaire parent introuvable."}
                ) from err

        # Mandatory pre-publication content moderation
        from apps.ai.services.moderation_service import ModerationService

        ModerationService.enforce_pre_publication(
            content, community=post.community, author=author
        )

        with transaction.atomic():
            comment = Comment.objects.create(
                post=post,
                author=author,
                content=content,
                parent=parent,
            )
            if media_ids:
                comment.media_attachments.set(media_ids)

            Post.objects.filter(id=post.id).update(
                comments_count=F("comments_count") + 1
            )
            post.refresh_from_db(fields=["comments_count"])
            comment.post = post
            from apps.gamification.services.gamification_service import (
                GamificationService,
            )

            GamificationService.award_comment_created(user=author, comment=comment)

            from realtime.broadcast import broadcast_comment_created

            broadcast_comment_created(comment)
            return comment

    @classmethod
    def delete_comment(cls, user: User, comment: Comment) -> None:
        if not is_superadmin_user(user) and comment.author_id != user.id:
            membership = CommunityMember.objects.filter(
                community=comment.post.community,
                user=user,
                status=MembershipStatus.ACTIVE,
            ).first()
            if not membership or not membership.is_moderator:
                raise PermissionDenied("Droits de modération requis.")

        with transaction.atomic():
            post_id = comment.post_id
            comment_id = comment.id
            community_id = (
                comment.post.community_id if getattr(comment, "post", None) else None
            )
            comment.delete()
            Post.objects.filter(id=post_id, comments_count__gt=0).update(
                comments_count=F("comments_count") - 1
            )
            updated_post = Post.objects.filter(id=post_id).first()
            new_count = updated_post.comments_count if updated_post else 0

            from realtime.broadcast import broadcast_comment_deleted

            broadcast_comment_deleted(
                post_id,
                comment_id,
                community_id=community_id,
                new_comments_count=new_count,
            )

    @classmethod
    def mark_accepted_answer(cls, user: User, comment: Comment) -> Comment:
        post = comment.post
        if not is_superadmin_user(user) and post.author_id != user.id:
            raise PermissionDenied(
                "Seul l'auteur de la question peut valider la réponse acceptée."
            )

        with transaction.atomic():
            Comment.objects.filter(post=post, is_accepted_answer=True).update(
                is_accepted_answer=False
            )
            comment.is_accepted_answer = True
            comment.save(update_fields=["is_accepted_answer", "updated_at"])

            post.is_resolved = True
            post.save(update_fields=["is_resolved", "updated_at"])

            CommunityMember.objects.filter(
                community=post.community,
                user=comment.author,
            ).update(reputation_score=F("reputation_score") + 15)

            from apps.gamification.services.gamification_service import (
                GamificationService,
            )

            GamificationService.award_accepted_answer(
                user=comment.author, comment=comment
            )
            from realtime.broadcast import broadcast_comment_accepted

            broadcast_comment_accepted(post.id, comment.id, True)
            return comment

    # --- Reactions ---

    @classmethod
    def toggle_post_reaction(cls, user: User, post: Post, reaction_type: str) -> bool:
        check_community_membership(user, post.community, "réagir à cette publication")

        from apps.posts.serializers.reaction import (
            REACTION_ALIASES,
            is_valid_emoji_or_reaction,
        )

        normalized_reaction = REACTION_ALIASES.get(
            (reaction_type or "").strip(), (reaction_type or "").strip()
        )
        if not is_valid_emoji_or_reaction(normalized_reaction):
            raise ValidationError("Type de réaction ou emoji invalide.")
        reaction_type = normalized_reaction

        with transaction.atomic():
            existing = PostReaction.objects.filter(
                post=post, user=user, reaction_type=reaction_type
            ).first()
            from realtime.broadcast import broadcast_post_reaction

            if existing:
                existing.delete()
                Post.objects.filter(id=post.id, reactions_count__gt=0).update(
                    reactions_count=F("reactions_count") - 1
                )
                post.refresh_from_db(fields=["reactions_count"])
                broadcast_post_reaction(
                    post.community_id,
                    post.id,
                    reaction_type,
                    post.reactions_count,
                    user.id,
                    "removed",
                )
                return False
            else:
                PostReaction.objects.create(
                    post=post, user=user, reaction_type=reaction_type
                )
                Post.objects.filter(id=post.id).update(
                    reactions_count=F("reactions_count") + 1
                )
                post.refresh_from_db(fields=["reactions_count"])
                broadcast_post_reaction(
                    post.community_id,
                    post.id,
                    reaction_type,
                    post.reactions_count,
                    user.id,
                    "added",
                )
                return True

    @classmethod
    def toggle_comment_reaction(
        cls, user: User, comment: Comment, reaction_type: str
    ) -> bool:
        check_community_membership(
            user, comment.post.community, "réagir à ce commentaire"
        )

        from apps.posts.serializers.reaction import (
            REACTION_ALIASES,
            is_valid_emoji_or_reaction,
        )

        normalized_reaction = REACTION_ALIASES.get(
            (reaction_type or "").strip(), (reaction_type or "").strip()
        )
        if not is_valid_emoji_or_reaction(normalized_reaction):
            raise ValidationError("Type de réaction ou emoji invalide.")
        reaction_type = normalized_reaction

        with transaction.atomic():
            existing = CommentReaction.objects.filter(
                comment=comment, user=user, reaction_type=reaction_type
            ).first()
            from realtime.broadcast import broadcast_comment_reaction

            if existing:
                existing.delete()
                Comment.objects.filter(id=comment.id, reactions_count__gt=0).update(
                    reactions_count=F("reactions_count") - 1
                )
                comment.refresh_from_db(fields=["reactions_count"])
                broadcast_comment_reaction(
                    comment.post_id,
                    comment.id,
                    reaction_type,
                    comment.reactions_count,
                    user.id,
                    "removed",
                )
                return False
            else:
                CommentReaction.objects.create(
                    comment=comment, user=user, reaction_type=reaction_type
                )
                Comment.objects.filter(id=comment.id).update(
                    reactions_count=F("reactions_count") + 1
                )
                comment.refresh_from_db(fields=["reactions_count"])
                broadcast_comment_reaction(
                    comment.post_id,
                    comment.id,
                    reaction_type,
                    comment.reactions_count,
                    user.id,
                    "added",
                )
                return True

    # --- Polls ---

    @classmethod
    def vote_poll(cls, user: User, poll: Poll, option_ids: list[str]) -> Poll:
        check_community_membership(user, poll.post.community, "voter dans ce sondage")

        if poll.is_expired:
            raise ValidationError("Ce sondage est clôturé.")

        if not poll.is_multiple_choice and len(option_ids) > 1:
            raise ValidationError("Ce sondage n'autorise qu'un seul choix.")

        with transaction.atomic():
            previous_votes = PollVote.objects.filter(option__poll=poll, user=user)
            for prev_vote in previous_votes:
                PollOption.objects.filter(
                    id=prev_vote.option_id, votes_count__gt=0
                ).update(votes_count=F("votes_count") - 1)
                Poll.objects.filter(id=poll.id, total_votes__gt=0).update(
                    total_votes=F("total_votes") - 1
                )
            previous_votes.delete()

            for opt_id in option_ids:
                try:
                    option = PollOption.objects.get(id=opt_id, poll=poll)
                    PollVote.objects.create(option=option, user=user)
                    PollOption.objects.filter(id=option.id).update(
                        votes_count=F("votes_count") + 1
                    )
                    Poll.objects.filter(id=poll.id).update(
                        total_votes=F("total_votes") + 1
                    )
                except PollOption.DoesNotExist as err:
                    raise NotFound("Option de sondage introuvable.") from err

            poll.refresh_from_db()
            return poll

    # --- Bookmarks / Sauvegarde de post ---

    @classmethod
    def toggle_bookmark(cls, user: User, post: Post) -> tuple[bool, int]:
        """
        Enregistrer ou retirer des favoris (bookmark) un post.
        Retourne (is_bookmarked, total_bookmarks_count).
        """
        from apps.posts.models.bookmark import PostBookmark

        bookmark = PostBookmark.objects.filter(user=user, post=post).first()
        if bookmark:
            bookmark.delete()
            is_bookmarked = False
        else:
            PostBookmark.objects.create(user=user, post=post)
            is_bookmarked = True

        total_bookmarks = PostBookmark.objects.filter(post=post).count()
        return is_bookmarked, total_bookmarks
