from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.memberships.permissions import check_community_read_permission
from apps.posts.models.comment import Comment
from apps.posts.models.post import Post
from apps.posts.selectors.post_selector import PostSelector
from apps.posts.serializers.comment import (
    CommentSerializer,
    CreateCommentRequestSerializer,
)
from apps.posts.serializers.reaction import ToggleReactionRequestSerializer
from apps.posts.services.post_service import PostService
from common.utils.responses import error_response, success_response


class PostCommentsView(APIView):
    """
    List threaded comments or post a new comment/reply on a publication.
    """

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Lister les commentaires hiérarchiques d'un post",
        responses={200: CommentSerializer(many=True)},
    )
    def get(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response(
                "Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        check_community_read_permission(request.user, post.community)

        since_param = request.query_params.get("since")
        since = None
        if since_param:
            try:
                from django.utils.dateparse import parse_datetime

                since = parse_datetime(since_param)
            except Exception:
                pass

        comments = PostSelector.get_post_comments(post, user=request.user, since=since)
        serializer = CommentSerializer(
            comments, many=True, context={"request": request}
        )
        return success_response(data=serializer.data)

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Ajouter un commentaire ou une réponse",
        request=CreateCommentRequestSerializer,
        responses={201: CommentSerializer},
    )
    def post(self, request, post_id):
        try:
            post = PostSelector.get_post_by_id(post_id, user=request.user)
        except Post.DoesNotExist:
            return error_response(
                "Publication introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        serializer = CreateCommentRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        media_ids = serializer.validated_data.get("media_ids", None)
        if request.FILES:
            uploaded_m_ids, _ = PostService.upload_and_extract_multipart_files(
                user=request.user,
                files_dict=request.FILES,
            )
            if uploaded_m_ids:
                media_ids = list(media_ids or []) + uploaded_m_ids
        parent_id = (
            str(serializer.validated_data.get("parent_id"))
            if serializer.validated_data.get("parent_id")
            else None
        )

        comment = PostService.create_comment(
            author=request.user,
            post=post,
            content=serializer.validated_data["content"],
            parent_id=parent_id,
            media_ids=media_ids,
        )

        return success_response(
            data=CommentSerializer(comment, context={"request": request}).data,
            message="Commentaire publié avec succès !",
            status_code=status.HTTP_201_CREATED,
        )


class CommentDetailView(APIView):
    """
    Delete a specific comment (author or moderator).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Feed & Posts"], summary="Supprimer un commentaire", responses={200: dict}
    )
    def delete(self, request, comment_id):
        try:
            comment = Comment.objects.select_related("post", "post__community").get(
                id=comment_id
            )
        except Comment.DoesNotExist:
            return error_response(
                "Commentaire introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        PostService.delete_comment(user=request.user, comment=comment)
        return success_response(message="Commentaire supprimé avec succès.")


class ToggleCommentReactionView(APIView):
    """
    Add or remove an emoji reaction to a comment.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Ajouter ou retirer une réaction emoji sur un commentaire",
        request=ToggleReactionRequestSerializer,
        responses={200: dict},
    )
    def post(self, request, comment_id):
        try:
            comment = Comment.objects.get(id=comment_id)
        except Comment.DoesNotExist:
            return error_response(
                "Commentaire introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        serializer = ToggleReactionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reacted = PostService.toggle_comment_reaction(
            user=request.user,
            comment=comment,
            reaction_type=serializer.validated_data["reaction_type"],
        )

        return success_response(
            data={"reacted": reacted},
            message="Réaction ajoutée." if reacted else "Réaction retirée.",
        )


class AcceptAnswerView(APIView):
    """
    Mark a comment as the accepted answer for a question post.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Feed & Posts"],
        summary="Accepter une réponse comme solution validée",
        request=None,
        responses={200: CommentSerializer},
    )
    def post(self, request, comment_id):
        try:
            comment = Comment.objects.select_related(
                "post", "post__community", "author"
            ).get(id=comment_id)
        except Comment.DoesNotExist:
            return error_response(
                "Commentaire introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        updated_comment = PostService.mark_accepted_answer(
            user=request.user, comment=comment
        )
        return success_response(
            data=CommentSerializer(updated_comment, context={"request": request}).data,
            message="Réponse acceptée et validée avec succès !",
        )
