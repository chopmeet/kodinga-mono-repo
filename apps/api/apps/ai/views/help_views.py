from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView

from apps.ai.serializers import PingMentorsSerializer
from apps.ai.services.help_assistance_service import HelpAssistanceService
from apps.ai.views.base import ai_success_response
from apps.communities.models.community import CommunityPrivacy
from apps.memberships.models.member import CommunityMember, MembershipStatus
from apps.posts.models.post import Post
from common.permissions.base import is_superadmin_user


class PostHelpAssistanceView(APIView):
    """
    Retrieves or generates automated AI help assistance for technical posts:
    key concepts summary, preliminary solution suggestions, and expert mentor discovery.
    """

    permission_classes = [permissions.IsAuthenticated]

    def _check_access(self, request, post: Post):
        if post.community.privacy_type in [CommunityPrivacy.PRIVATE, CommunityPrivacy.SECRET]:
            is_member = CommunityMember.objects.filter(
                community=post.community,
                user=request.user,
                status=MembershipStatus.ACTIVE,
            ).exists() or is_superadmin_user(request.user) or post.community.owner_id == request.user.id
            if not is_member:
                raise PermissionDenied("Cette publication appartient à une communauté privée.")

    def get(self, request, post_id: str):
        post = get_object_or_404(Post.objects.select_related("community", "author"), id=post_id)
        self._check_access(request, post)
        assistance = HelpAssistanceService.get_or_create_assistance(post=post)
        return ai_success_response(assistance, status_code=status.HTTP_200_OK)

    def post(self, request, post_id: str):
        post = get_object_or_404(Post.objects.select_related("community", "author"), id=post_id)
        self._check_access(request, post)
        assistance = HelpAssistanceService.get_or_create_assistance(post=post)
        return ai_success_response(assistance, status_code=status.HTTP_200_OK)


class PingMentorsView(APIView):
    """
    Notifies identified expert community mentors to jump in and assist on a technical question.
    Restricted to post author or community moderators/admins.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id: str):
        post = get_object_or_404(Post.objects.select_related("community", "author"), id=post_id)

        # 1. Ensure user is active member of this community (or superadmin)
        membership = CommunityMember.objects.filter(
            community=post.community,
            user=request.user,
            status=MembershipStatus.ACTIVE,
        ).first()

        is_owner = post.community.owner_id == request.user.id
        is_author = post.author_id == request.user.id
        is_mod_or_admin = membership and (membership.is_moderator or membership.is_admin)

        if not (is_author or is_mod_or_admin or is_owner or is_superadmin_user(request.user)):
            raise PermissionDenied("Seul l'auteur de la publication ou un modérateur peut solliciter des mentors.")

        serializer = PingMentorsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        mentor_ids = serializer.validated_data.get("mentor_ids", [])
        custom_message = serializer.validated_data.get("custom_message", "")

        notified_count = HelpAssistanceService.ping_mentors(
            author=request.user,
            post=post,
            mentor_ids=mentor_ids,
            custom_message=custom_message,
        )

        resp_data = {
            "message": f"{notified_count} mentors notifiés avec succès.",
            "notified_count": notified_count,
        }
        return ai_success_response(
            resp_data,
            message=f"{notified_count} mentors notifiés avec succès.",
            status_code=status.HTTP_200_OK,
        )
