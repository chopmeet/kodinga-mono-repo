from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.serializers import PingMentorsSerializer
from apps.ai.services.help_assistance_service import HelpAssistanceService
from apps.posts.models.post import Post


class PostHelpAssistanceView(APIView):
    """
    Retrieves or generates automated AI help assistance for technical posts:
    key concepts summary, preliminary solution suggestions, and expert mentor discovery.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, post_id: str):
        post = get_object_or_404(Post.objects.select_related("community", "author"), id=post_id)
        assistance = HelpAssistanceService.get_or_create_assistance(post=post)
        return Response(assistance, status=status.HTTP_200_OK)

    def post(self, request, post_id: str):
        post = get_object_or_404(Post.objects.select_related("community", "author"), id=post_id)
        assistance = HelpAssistanceService.get_or_create_assistance(post=post)
        return Response(assistance, status=status.HTTP_200_OK)


class PingMentorsView(APIView):
    """
    Notifies identified expert community mentors to jump in and assist on a technical question.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id: str):
        post = get_object_or_404(Post.objects.select_related("community", "author"), id=post_id)
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

        return Response(
            {
                "message": f"{notified_count} mentors notifiés avec succès.",
                "notified_count": notified_count,
            },
            status=status.HTTP_200_OK,
        )
