from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from common.utils.responses import error_response, success_response
from apps.memberships.permissions import check_community_read_permission
from apps.posts.models.post import Post
from apps.posts.selectors.post_selector import PostSelector
from apps.posts.serializers.poll import PollSerializer, VotePollRequestSerializer
from apps.posts.serializers.post import (
    PostCreateUpdateSerializer,
    PostDetailSerializer,
)
from apps.posts.serializers.reaction import ToggleReactionRequestSerializer
from apps.posts.services.post_service import PostService


class PostDetailView(APIView):
    """
    Retrieve, update or delete a single post.
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=['Feed & Posts'],
        summary="Détails complets d'une publication",
        responses={200: PostDetailSerializer}
    )
    def get(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response("Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        check_community_read_permission(request.user, post.community)

        # Increment view counter asynchronously / atomic
        Post.objects.filter(id=post.id).update(views_count=post.views_count + 1)
        post.views_count += 1

        serializer = PostDetailSerializer(post, context={'request': request})
        return success_response(data=serializer.data)

    @extend_schema(
        tags=['Feed & Posts'],
        summary="Modifier une publication existante",
        request=PostCreateUpdateSerializer,
        responses={200: PostDetailSerializer}
    )
    def patch(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response("Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = PostCreateUpdateSerializer(post, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        media_ids = serializer.validated_data.pop('media_ids', None)
        serializer.validated_data.pop('poll', None)  # Polls cannot be altered post-creation

        updated_post = PostService.update_post(
            user=request.user,
            post=post,
            data=serializer.validated_data,
            media_ids=media_ids
        )

        return success_response(
            data=PostDetailSerializer(updated_post, context={'request': request}).data,
            message="Publication mise à jour avec succès."
        )

    @extend_schema(
        tags=['Feed & Posts'],
        summary="Supprimer une publication (Auteur ou Modérateur)",
        responses={200: dict}
    )
    def delete(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response("Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        PostService.delete_post(user=request.user, post=post)
        return success_response(message="Publication supprimée avec succès.")


class TogglePostPinView(APIView):
    """
    Pin or unpin a post within the community feed (Moderators only).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Feed & Posts'],
        summary="Épingler ou désépingler une publication (Modérateurs)",
        request=None,
        responses={200: dict}
    )
    def post(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response("Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        is_pinned = PostService.toggle_post_pin(user=request.user, post=post)
        return success_response(
            data={'is_pinned': is_pinned},
            message="Publication épinglée." if is_pinned else "Publication désépinglée."
        )


class TogglePostLockView(APIView):
    """
    Lock or unlock comments on a post (Moderators only).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Feed & Posts'],
        summary="Verrouiller ou déverrouiller les commentaires (Modérateurs)",
        request=None,
        responses={200: dict}
    )
    def post(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response("Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        is_locked = PostService.toggle_post_lock(user=request.user, post=post)
        return success_response(
            data={'is_locked': is_locked},
            message="Commentaires verrouillés." if is_locked else "Commentaires déverrouillés."
        )


class TogglePostReactionView(APIView):
    """
    Add or remove an emoji reaction to a post.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Feed & Posts'],
        summary="Ajouter ou retirer une réaction emoji sur un post",
        request=ToggleReactionRequestSerializer,
        responses={200: dict}
    )
    def post(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response("Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = ToggleReactionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reacted = PostService.toggle_post_reaction(
            user=request.user,
            post=post,
            reaction_type=serializer.validated_data['reaction_type']
        )

        return success_response(
            data={'reacted': reacted},
            message="Réaction ajoutée." if reacted else "Réaction retirée."
        )


class VotePollView(APIView):
    """
    Vote for one or more options in an embedded poll.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Feed & Posts'],
        summary="Voter à un sondage interactif",
        request=VotePollRequestSerializer,
        responses={200: PollSerializer}
    )
    def post(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response("Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        poll = getattr(post, 'poll', None)
        if not poll:
            return error_response("Cette publication ne contient aucun sondage.", status_code=status.HTTP_400_BAD_REQUEST)

        serializer = VotePollRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_poll = PostService.vote_poll(
            user=request.user,
            poll=poll,
            option_ids=[str(opt) for opt in serializer.validated_data['option_ids']]
        )

        return success_response(
            data=PollSerializer(updated_poll, context={'request': request}).data,
            message="Votre vote a été enregistré avec succès !"
        )
