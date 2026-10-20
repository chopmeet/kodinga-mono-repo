from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.messaging.models.conversation import ConversationType
from apps.messaging.models.message import Message
from apps.messaging.selectors.messaging_selector import MessagingSelector
from apps.messaging.serializers.messaging_serializers import (
    ConversationListSerializer,
    CreateGroupConversationSerializer,
    MessageSerializer,
    SendMessageSerializer,
    StartDirectConversationSerializer,
)
from apps.messaging.services.messaging_service import MessagingService


@extend_schema(tags=["Messaging & Notifications"])
class ConversationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        conversations = MessagingSelector.get_user_conversations(request.user)
        serializer = ConversationListSerializer(
            conversations, many=True, context={"request": request}
        )
        return Response(serializer.data)

    def post(self, request):
        """
        Create a direct conversation with ?type=direct (or default),
        or create a group conversation with ?type=group.
        """
        conv_type = request.data.get("conversation_type", ConversationType.DIRECT)

        if conv_type == ConversationType.GROUP:
            serializer = CreateGroupConversationSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            title = serializer.validated_data["title"]
            participant_ids = serializer.validated_data.get("participant_ids", [])
            community_id = serializer.validated_data.get("community_id")

            participants = list(User.objects.filter(id__in=participant_ids))
            community = Community.objects.filter(id=community_id).first() if community_id else None

            conversation = MessagingService.create_group_conversation(
                creator=request.user,
                title=title,
                participants_users=participants,
                community=community,
            )
            return Response(
                ConversationListSerializer(conversation, context={"request": request}).data,
                status=status.HTTP_201_CREATED,
            )
        else:
            serializer = StartDirectConversationSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            recipient_id = serializer.validated_data["recipient_id"]
            recipient = User.objects.filter(id=recipient_id).first()
            if not recipient:
                return Response(
                    {"detail": "Destinataire introuvable."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            conversation, created = MessagingService.start_direct_conversation(
                user1=request.user, user2=recipient
            )
            code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
            return Response(
                ConversationListSerializer(conversation, context={"request": request}).data,
                status=code,
            )


@extend_schema(tags=["Messaging & Notifications"])
class ConversationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, conversation_id):
        conversation = MessagingSelector.get_conversation_detail(conversation_id, request.user)
        if not conversation:
            return Response({"detail": "Conversation introuvable."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ConversationListSerializer(conversation, context={"request": request}).data)


@extend_schema(tags=["Messaging & Notifications"])
class ConversationMessagesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, conversation_id):
        conversation = MessagingSelector.get_conversation_detail(conversation_id, request.user)
        if not conversation:
            return Response({"detail": "Conversation introuvable."}, status=status.HTTP_404_NOT_FOUND)

        since_param = request.query_params.get("since")
        since = None
        if since_param:
            try:
                from django.utils.dateparse import parse_datetime

                since = parse_datetime(since_param)
            except Exception:
                pass

        messages = MessagingSelector.get_conversation_messages(
            conversation, request.user, since=since
        )
        return Response(MessageSerializer(messages, many=True).data)

    def post(self, request, conversation_id):
        conversation = MessagingSelector.get_conversation_detail(conversation_id, request.user)
        if not conversation:
            return Response({"detail": "Conversation introuvable."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data.get("content", "")
        attachments = serializer.validated_data.get("attachments", [])

        message = MessagingService.send_message(
            conversation=conversation,
            sender=request.user,
            content=content,
            attachments_data=attachments,
        )
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Messaging & Notifications"])
class ConversationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, conversation_id):
        conversation = MessagingSelector.get_conversation_detail(conversation_id, request.user)
        if not conversation:
            return Response({"detail": "Conversation introuvable."}, status=status.HTTP_404_NOT_FOUND)

        MessagingService.mark_as_read(conversation, request.user)
        return Response({"status": "read"})


@extend_schema(tags=["Messaging & Notifications"])
class MessageDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, message_id):
        message = Message.objects.filter(id=message_id).first()
        if not message:
            return Response({"detail": "Message introuvable."}, status=status.HTTP_404_NOT_FOUND)

        new_content = request.data.get("content", "").strip()
        updated_msg = MessagingService.edit_message(message, request.user, new_content)
        return Response(MessageSerializer(updated_msg).data)

    def delete(self, request, message_id):
        message = Message.objects.filter(id=message_id).first()
        if not message:
            return Response({"detail": "Message introuvable."}, status=status.HTTP_404_NOT_FOUND)

        MessagingService.delete_message(message, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Messaging & Notifications"])
class ToggleMessagePinView(APIView):
    """
    Pin or unpin a message within a conversation (Owner or Moderator only).
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="Épingler ou désépingler un message (Propriétaire / Modérateur)",
        responses={200: dict}
    )
    def post(self, request, message_id):
        message = Message.objects.filter(id=message_id).first()
        if not message:
            return Response({"detail": "Message introuvable."}, status=status.HTTP_404_NOT_FOUND)

        is_pinned = MessagingService.toggle_message_pin(message, request.user)
        return Response({
            "status": "success",
            "data": {"is_pinned": is_pinned},
            "message": "Message épinglé." if is_pinned else "Message désépinglé."
        })
