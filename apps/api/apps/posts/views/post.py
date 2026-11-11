from django.db.models import F
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.memberships.permissions import check_community_read_permission
from apps.posts.models.post import Post
from apps.posts.selectors.post_selector import PostSelector
from apps.posts.serializers.poll import PollSerializer, VotePollRequestSerializer
from apps.posts.serializers.post import (
    PostCreateUpdateSerializer,
    PostDetailSerializer,
    PostListSerializer,
)
from apps.posts.serializers.reaction import ToggleReactionRequestSerializer
from apps.posts.services.post_service import PostService
from common.utils.responses import error_response, success_response


class PostDetailView(APIView):
    """
    Retrieve, update or delete a single post.
    """

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Détails complets d'une publication",
        responses={200: PostDetailSerializer},
    )
    def get(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response(
                "Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        check_community_read_permission(request.user, post.community)

        Post.objects.filter(id=post.id).update(views_count=F("views_count") + 1)
        post.views_count += 1

        serializer = PostDetailSerializer(post, context={"request": request})
        return success_response(data=serializer.data)

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Modifier une publication existante",
        request=PostCreateUpdateSerializer,
        responses={200: PostDetailSerializer},
    )
    def patch(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response(
                "Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        serializer = PostCreateUpdateSerializer(post, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        media_ids = serializer.validated_data.pop("media_ids", None)
        video_ids = serializer.validated_data.pop("video_ids", None)
        serializer.validated_data.pop(
            "poll", None
        )  # Polls cannot be altered post-creation

        if request.FILES:
            uploaded_m_ids, uploaded_v_ids = (
                PostService.upload_and_extract_multipart_files(
                    user=request.user,
                    files_dict=request.FILES,
                )
            )
            if uploaded_m_ids:
                media_ids = list(media_ids or []) + uploaded_m_ids
            if uploaded_v_ids:
                video_ids = list(video_ids or []) + uploaded_v_ids

        updated_post = PostService.update_post(
            user=request.user,
            post=post,
            data=serializer.validated_data,
            media_ids=media_ids,
            video_ids=video_ids,
        )

        return success_response(
            data=PostDetailSerializer(updated_post, context={"request": request}).data,
            message="Publication mise à jour avec succès.",
        )

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Supprimer une publication (Auteur ou Modérateur)",
        responses={200: dict},
    )
    def delete(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response(
                "Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        PostService.delete_post(user=request.user, post=post)
        return success_response(message="Publication supprimée avec succès.")


class PostMediaDeleteView(APIView):
    """
    DELETE /api/v1/posts/<uuid:post_id>/media/<uuid:media_id>/
    Detaches and deletes a specific media attachment (image, document, or video) from a post.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Supprimer une pièce jointe (image, document ou vidéo) d'une publication",
        responses={200: dict},
    )
    def delete(self, request, post_id, media_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response(
                "Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        PostService.remove_post_media(
            user=request.user, post=post, media_id=str(media_id)
        )
        return success_response(message="Média retiré et supprimé avec succès.")


class TogglePostPinView(APIView):
    """
    Pin or unpin a post within the community feed (Moderators only).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Épingler ou désépingler une publication (Modérateurs)",
        request=None,
        responses={200: dict},
    )
    def post(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response(
                "Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        is_pinned = PostService.toggle_post_pin(user=request.user, post=post)
        return success_response(
            data={"is_pinned": is_pinned},
            message="Publication épinglée."
            if is_pinned
            else "Publication désépinglée.",
        )


class TogglePostLockView(APIView):
    """
    Lock or unlock comments on a post (Moderators only).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Verrouiller ou déverrouiller les commentaires (Modérateurs)",
        request=None,
        responses={200: dict},
    )
    def post(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response(
                "Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        is_locked = PostService.toggle_post_lock(user=request.user, post=post)
        return success_response(
            data={"is_locked": is_locked},
            message="Commentaires verrouillés."
            if is_locked
            else "Commentaires déverrouillés.",
        )


class TogglePostReactionView(APIView):
    """
    Add or remove an emoji reaction to a post.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Ajouter ou retirer une réaction emoji sur un post",
        request=ToggleReactionRequestSerializer,
        responses={200: dict},
    )
    def post(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response(
                "Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        serializer = ToggleReactionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reacted = PostService.toggle_post_reaction(
            user=request.user,
            post=post,
            reaction_type=serializer.validated_data["reaction_type"],
        )

        return success_response(
            data={"reacted": reacted},
            message="Réaction ajoutée." if reacted else "Réaction retirée.",
        )


class VotePollView(APIView):
    """
    Vote for one or more options in an embedded poll.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Voter à un sondage interactif",
        request=VotePollRequestSerializer,
        responses={200: PollSerializer},
    )
    def post(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response(
                "Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        poll = getattr(post, "poll", None)
        if not poll:
            return error_response(
                "Cette publication ne contient aucun sondage.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        serializer = VotePollRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_poll = PostService.vote_poll(
            user=request.user,
            poll=poll,
            option_ids=[str(opt) for opt in serializer.validated_data["option_ids"]],
        )

        return success_response(
            data=PollSerializer(updated_poll, context={"request": request}).data,
            message="Votre vote a été enregistré avec succès !",
        )


class ToggleBookmarkView(APIView):
    """
    Enregistrer (sauvegarder) ou retirer des favoris une publication.
    POST /api/v1/posts/<post_id>/bookmark/
    DELETE /api/v1/posts/<post_id>/bookmark/
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Sauvegarder ou retirer des favoris un post",
        responses={200: dict},
    )
    def post(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response(
                "Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        check_community_read_permission(request.user, post.community)

        is_bookmarked, total = PostService.toggle_bookmark(request.user, post)
        return success_response(
            data={
                "post_id": str(post.id),
                "is_bookmarked": is_bookmarked,
                "bookmarks_count": total,
            },
            message="Publication enregistrée."
            if is_bookmarked
            else "Publication retirée des favoris.",
        )

    def delete(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response(
                "Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        from apps.posts.models.bookmark import PostBookmark

        PostBookmark.objects.filter(user=request.user, post=post).delete()
        total = PostBookmark.objects.filter(post=post).count()
        return success_response(
            data={
                "post_id": str(post.id),
                "is_bookmarked": False,
                "bookmarks_count": total,
            },
            message="Publication retirée des favoris.",
        )


class BookmarkedPostsView(APIView):
    """
    Lister l'ensemble des publications enregistrées par l'utilisateur connecté.
    GET /api/v1/posts/bookmarks/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from common.utils.pagination import StandardResultsSetPagination

        posts = PostSelector.get_bookmarked_posts(user=request.user)
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(posts, request)
        serializer = PostListSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)
