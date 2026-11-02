from apps.notifications.selectors.notification_selector import (
    NotificationSelector,
)
from apps.notifications.serializers.notification_serializer import (
    NotificationSerializer,
    UnreadCountResponseSerializer,
)
from apps.notifications.services.notification_service import (
    NotificationService,
)
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView


class NotificationListView(APIView):
    """
    List developer in-app notifications with pagination and unread filter.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Messaging & Notifications"],
        summary="Lister les notifications de l'utilisateur",
        parameters=[
            OpenApiParameter(
                name="unread",
                description="Filtrer uniquement les non lues (true/false)",
                required=False,
                type=bool,
            ),
            OpenApiParameter(
                name="all",
                description="Retourner tout sans pagination (true/false)",
                required=False,
                type=bool,
            ),
        ],
        responses={200: NotificationSerializer(many=True)},
    )
    def get(self, request):
        unread_only = request.query_params.get("unread", "").lower() in [
            "true",
            "1",
        ]
        notifications = NotificationSelector.get_user_notifications(
            user=request.user, unread_only=unread_only
        )

        if request.query_params.get("all", "").lower() in ["true", "1"]:
            serializer = NotificationSerializer(notifications, many=True)
            return success_response(data=serializer.data)

        paginator = self.pagination_class()
        paginated_notifications = paginator.paginate_queryset(
            notifications, request
        )
        serializer = NotificationSerializer(
            paginated_notifications, many=True
        )
        return paginator.get_paginated_response(serializer.data)


class NotificationUnreadCountView(APIView):
    """
    Retrieve real-time unread notification count for badge display in the web UI header.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Messaging & Notifications"],
        summary="Compteur de notifications non lues",
        responses={200: UnreadCountResponseSerializer},
    )
    def get(self, request):
        count = NotificationSelector.get_unread_count(user=request.user)
        return success_response(
            data={"unread_count": count}, status_code=status.HTTP_200_OK
        )


class NotificationMarkReadView(APIView):
    """
    Mark a single notification as read.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Messaging & Notifications"],
        summary="Marquer une notification comme lue",
        responses={200: None},
    )
    def post(self, request, notification_id):
        updated = NotificationService.mark_as_read(
            notification_id=notification_id, user=request.user
        )
        if not updated:
            return error_response(
                "Notification introuvable ou déjà lue.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return success_response(
            message="Notification marquée comme lue.",
            status_code=status.HTTP_200_OK,
        )


class NotificationMarkAllReadView(APIView):
    """
    Mark all unread notifications as read.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Messaging & Notifications"],
        summary="Marquer toutes les notifications comme lues",
        responses={200: None},
    )
    def post(self, request):
        count = NotificationService.mark_all_as_read(user=request.user)
        return success_response(
            data={"marked_read_count": count},
            message=f"{count} notifications marquées comme lues.",
            status_code=status.HTTP_200_OK,
        )


class NotificationDetailView(APIView):
    """
    Delete an individual notification.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Messaging & Notifications"],
        summary="Supprimer une notification",
        responses={200: None},
    )
    def delete(self, request, notification_id):
        deleted = NotificationService.delete_notification(
            notification_id=notification_id, user=request.user
        )
        if not deleted:
            return error_response(
                "Notification introuvable.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return success_response(
            message="Notification supprimée avec succès.",
            status_code=status.HTTP_200_OK,
        )
