from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService
from apps.profiles.models.follow import UserFollow
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response

User = get_user_model()


class FollowToggleView(APIView):
    """
    Toggle follow/unfollow a developer.
    POST /api/v1/profiles/<username>/follow/
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Developer Profiles'],
        summary="Suivre ou ne plus suivre un développeur",
        responses={200: dict}
    )
    def post(self, request, username):
        target_user = get_object_or_404(User, username=username)

        if target_user.id == request.user.id:
            return error_response(
                "Vous ne pouvez pas vous suivre vous-même.",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            follow_rel = UserFollow.objects.filter(
                follower=request.user,
                following=target_user
            ).first()

            if follow_rel:
                follow_rel.delete()
                is_following = False
            else:
                UserFollow.objects.create(
                    follower=request.user,
                    following=target_user
                )
                is_following = True

                NotificationService.create_notification(
                    recipient=target_user,
                    actor=request.user,
                    title=f"{request.user.username} s'est abonné à votre profil",
                    body=f"{request.user.get_full_name() or request.user.username} vous suit désormais sur Kodinga.",
                    notification_type=NotificationType.SYSTEM,
                    action_url=f"/profiles/{request.user.username}",
                    target_type="user_follow",
                    target_id=str(request.user.id),
                )

        followers_count = UserFollow.objects.filter(following=target_user).count()
        following_count = UserFollow.objects.filter(follower=target_user).count()

        return success_response(
            data={
                "is_following": is_following,
                "followers_count": followers_count,
                "following_count": following_count,
            },
            message="Abonnement mis à jour avec succès."
        )


class FollowersListView(APIView):
    """
    List followers of a user.
    GET /api/v1/profiles/<username>/followers/
    """
    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=['Developer Profiles'],
        summary="Liste des abonnés d'un profil",
        responses={200: dict}
    )
    def get(self, request, username):
        target_user = get_object_or_404(User, username=username)
        follows_qs = (
            UserFollow.objects.filter(following=target_user)
            .select_related('follower', 'follower__profile')
            .order_by('-created_at')
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(follows_qs, request)

        viewer = request.user if request.user.is_authenticated else None
        viewer_following_ids = set()
        if viewer:
            viewer_following_ids = set(
                UserFollow.objects.filter(follower=viewer).values_list('following_id', flat=True)
            )

        data = []
        for f in page:
            u = f.follower
            profile = getattr(u, 'profile', None)
            data.append({
                "id": str(u.id),
                "username": u.username,
                "display_name": u.get_full_name() or u.username,
                "avatar_url": getattr(profile, "avatar_url", "") if profile else "",
                "headline": getattr(profile, "headline", "") if profile else "",
                "is_following": u.id in viewer_following_ids,
                "followed_at": f.created_at,
            })

        return paginator.get_paginated_response(data)


class FollowingListView(APIView):
    """
    List users followed by a user.
    GET /api/v1/profiles/<username>/following/
    """
    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=['Developer Profiles'],
        summary="Liste des abonnements d'un profil",
        responses={200: dict}
    )
    def get(self, request, username):
        target_user = get_object_or_404(User, username=username)
        follows_qs = (
            UserFollow.objects.filter(follower=target_user)
            .select_related('following', 'following__profile')
            .order_by('-created_at')
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(follows_qs, request)

        viewer = request.user if request.user.is_authenticated else None
        viewer_following_ids = set()
        if viewer:
            viewer_following_ids = set(
                UserFollow.objects.filter(follower=viewer).values_list('following_id', flat=True)
            )

        data = []
        for f in page:
            u = f.following
            profile = getattr(u, 'profile', None)
            data.append({
                "id": str(u.id),
                "username": u.username,
                "display_name": u.get_full_name() or u.username,
                "avatar_url": getattr(profile, "avatar_url", "") if profile else "",
                "headline": getattr(profile, "headline", "") if profile else "",
                "is_following": u.id in viewer_following_ids,
                "followed_at": f.created_at,
            })

        return paginator.get_paginated_response(data)

