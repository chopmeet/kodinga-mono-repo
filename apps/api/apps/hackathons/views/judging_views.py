from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.hackathons.models.evaluation import HackathonEvaluation
from apps.hackathons.models.submission import HackathonSubmission
from apps.hackathons.selectors.hackathon_selector import HackathonSelector
from apps.hackathons.serializers.evaluation import (
    HackathonEvaluationSerializer,
    LeaderboardItemSerializer,
    PublishResultsRequestSerializer,
    SubmitEvaluationRequestSerializer,
)
from apps.hackathons.serializers.hackathon import HackathonDetailSerializer
from apps.hackathons.serializers.judge import (
    AssignJudgesRequestSerializer,
    HackathonJudgeSerializer,
)
from apps.hackathons.serializers.submission import HackathonSubmissionListSerializer
from apps.hackathons.services.evaluation_service import HackathonEvaluationService
from apps.hackathons.services.hackathon_service import HackathonService


class HackathonJudgeListView(APIView):
    """
    GET / POST / DELETE /api/v1/communities/<slug>/hackathons/<hackathon_slug>/judges/
    Manages assigned judges for a hackathon (Organizers only).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Lister les membres du jury",
        responses={200: HackathonJudgeSerializer(many=True)},
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        judges = hackathon.judge_assignments.select_related("user")
        return success_response(data=HackathonJudgeSerializer(judges, many=True).data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Désigner des jurés (Organisateur)",
        request=AssignJudgesRequestSerializer,
        responses={201: HackathonJudgeSerializer(many=True)},
    )
    def post(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        serializer = AssignJudgesRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_ids = [str(uid) for uid in serializer.validated_data["user_ids"]]
        assigned = HackathonService.assign_judges(request.user, hackathon, user_ids)

        return success_response(
            data=HackathonJudgeSerializer(assigned, many=True).data,
            message="Jurés assignés avec succès.",
            status_code=status.HTTP_201_CREATED,
        )

    @extend_schema(
        tags=["Hackathons"],
        summary="Retirer un juré (Organisateur)",
        responses={200: None},
    )
    def delete(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        user_id = request.query_params.get("user_id")
        if not user_id:
            return error_response("Paramètre user_id requis.", status_code=status.HTTP_400_BAD_REQUEST)

        HackathonService.remove_judge(request.user, hackathon, user_id)
        return success_response(message="Membre du jury retiré avec succès.")


class HackathonJudgingProjectsView(APIView):
    """
    GET /api/v1/communities/<slug>/hackathons/<hackathon_slug>/judging/projects/
    Lists projects available for evaluation by the authenticated judge.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Hackathons"],
        summary="Projets à évaluer (Jury)",
        responses={200: HackathonSubmissionListSerializer(many=True)},
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        if not HackathonSelector.is_hackathon_judge(request.user, hackathon):
            return error_response(
                "Vous n'êtes pas désigné comme juré pour ce hackathon.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        qs = (
            HackathonSubmission.objects.filter(hackathon=hackathon, is_final=True)
            .select_related("team", "applicant")
            .prefetch_related("technologies", "files")
            .order_by("-submitted_at")
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = HackathonSubmissionListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class HackathonSubmissionEvaluateView(APIView):
    """
    GET / POST /api/v1/communities/<slug>/hackathons/<hackathon_slug>/judging/projects/<uuid:submission_id>/evaluate/
    Views or submits an evaluation for a specific project.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Consulter mon évaluation d'un projet",
        responses={200: HackathonEvaluationSerializer},
    )
    def get(self, request, slug, hackathon_slug, submission_id):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        if not HackathonSelector.is_hackathon_judge(request.user, hackathon):
            return error_response("Accès non autorisé.", status_code=status.HTTP_403_FORBIDDEN)

        evaluation = (
            HackathonEvaluation.objects.filter(
                submission_id=submission_id, judge=request.user
            )
            .select_related("submission", "judge")
            .prefetch_related("scores__criterion")
            .first()
        )

        if not evaluation:
            return success_response(data=None)

        return success_response(data=HackathonEvaluationSerializer(evaluation).data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Soumettre ou sauvegarder une évaluation (Jury)",
        request=SubmitEvaluationRequestSerializer,
        responses={200: HackathonEvaluationSerializer},
    )
    def post(self, request, slug, hackathon_slug, submission_id):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        submission = HackathonSubmission.objects.filter(
            id=submission_id, hackathon=hackathon
        ).first()

        if not submission:
            return error_response("Projet introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = SubmitEvaluationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        evaluation = HackathonEvaluationService.evaluate_project(
            judge=request.user,
            submission=submission,
            scores_data=serializer.validated_data["scores"],
            general_feedback=serializer.validated_data.get("general_feedback", ""),
            private_notes=serializer.validated_data.get("private_notes", ""),
            is_submitted=serializer.validated_data.get("is_submitted", True),
        )

        return success_response(
            data=HackathonEvaluationSerializer(evaluation).data,
            message="Évaluation enregistrée avec succès.",
        )


class HackathonLeaderboardView(APIView):
    """
    GET /api/v1/communities/<slug>/hackathons/<hackathon_slug>/results/
    Leaderboard of projects, scores and prizes (public if published, organizers anytime).
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Hackathons"],
        summary="Consulter le classement et les résultats",
        responses={200: LeaderboardItemSerializer(many=True)},
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        leaderboard = HackathonSelector.get_hackathon_leaderboard(hackathon, request.user)
        serializer = LeaderboardItemSerializer(leaderboard, many=True)
        return success_response(data=serializer.data)


class HackathonPublishResultsView(APIView):
    """
    POST /api/v1/communities/<slug>/hackathons/<hackathon_slug>/publish-results/
    Organizers publish official results, assign prizes and announce winners.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Publier officiellement les résultats et attribuer les prix (Organisateur)",
        request=PublishResultsRequestSerializer,
        responses={200: HackathonDetailSerializer},
    )
    def post(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        serializer = PublishResultsRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        winners_data = serializer.validated_data.get("winners", [])
        updated = HackathonService.publish_results(
            actor=request.user,
            hackathon=hackathon,
            winners_mapping=winners_data,
        )

        return success_response(
            data=HackathonDetailSerializer(updated, context={"request": request}).data,
            message="Résultats et lauréats publiés avec succès !",
        )
