from collections import Counter
from datetime import datetime
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from common.utils.responses import success_response

User = get_user_model()


class DeveloperActivityHeatmapView(APIView):
    """
    Returns aggregated contribution counts per calendar day for a developer.
    Powers the GitHub-style contribution heatmap on the developer profile.
    GET /api/v1/profiles/<username>/activity/?year=YYYY
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Developer Profiles'],
        summary="Heatmap des contributions annuelles d'un développeur",
        parameters=[
            OpenApiParameter(name='year', description="Année (défaut: année en cours)", required=False, type=int),
        ],
        responses={200: dict}
    )
    def get(self, request, username):
        target_user = get_object_or_404(User, username=username)

        year_param = request.query_params.get('year')
        current_year = timezone.now().year
        try:
            year = int(year_param) if year_param else current_year
        except ValueError:
            year = current_year

        counts = Counter()

        # 1. Posts authored by user
        from apps.posts.models.post import Post
        post_dates = (
            Post.objects.filter(author=target_user, created_at__year=year)
            .values_list('created_at', flat=True)
        )
        for dt in post_dates:
            counts[dt.strftime('%Y-%m-%d')] += 1

        # 2. Comments created by user
        from apps.posts.models.comment import Comment
        comment_dates = (
            Comment.objects.filter(author=target_user, created_at__year=year)
            .values_list('created_at', flat=True)
        )
        for dt in comment_dates:
            counts[dt.strftime('%Y-%m-%d')] += 1

        # 3. Completed lessons
        from apps.classroom.models.progress import LessonProgress
        lesson_dates = (
            LessonProgress.objects.filter(
                user=target_user,
                is_completed=True,
                completed_at__year=year
            ).values_list('completed_at', flat=True)
        )
        for dt in lesson_dates:
            if dt:
                counts[dt.strftime('%Y-%m-%d')] += 1

        # 4. Post reactions given
        from apps.posts.models.reaction import PostReaction
        reaction_dates = (
            PostReaction.objects.filter(user=target_user, created_at__year=year)
            .values_list('created_at', flat=True)
        )
        for dt in reaction_dates:
            counts[dt.strftime('%Y-%m-%d')] += 1

        # 5. Reputation / gamification points earned
        from apps.gamification.models.reputation import ReputationTransaction
        rep_dates = (
            ReputationTransaction.objects.filter(user=target_user, created_at__year=year)
            .values_list('created_at', flat=True)
        )
        for dt in rep_dates:
            counts[dt.strftime('%Y-%m-%d')] += 1

        total_contributions = sum(counts.values())

        return success_response(
            data={
                "username": target_user.username,
                "year": year,
                "total_contributions": total_contributions,
                "counts": dict(counts),
            }
        )

