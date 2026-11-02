import csv

from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response
from django.db.models import Q
from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.hackathons.models.application import HackathonApplication
from apps.hackathons.selectors.hackathon_selector import HackathonSelector
from apps.hackathons.serializers.application import (
    ApplicationReviewRequestSerializer,
    HackathonApplicationSerializer,
    HackathonApplyRequestSerializer,
)
from apps.hackathons.services.application_service import HackathonApplicationService


class HackathonApplyView(APIView):
    """
    POST /api/v1/communities/<slug>/hackathons/<hackathon_slug>/apply/
    Registers a participant or team intention for the hackathon.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Candidater à un hackathon",
        request=HackathonApplyRequestSerializer,
        responses={201: HackathonApplicationSerializer},
    )
    def post(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        serializer = HackathonApplyRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        application = HackathonApplicationService.apply(
            applicant=request.user,
            hackathon=hackathon,
            participation_mode=serializer.validated_data.get("participation_mode"),
            answers=serializer.validated_data.get("answers"),
            team_name=serializer.validated_data.get("team_name", ""),
        )

        return success_response(
            data=HackathonApplicationSerializer(application).data,
            message="Candidature enregistrée avec succès.",
            status_code=status.HTTP_201_CREATED,
        )


class HackathonMyApplicationView(APIView):
    """
    GET / DELETE /api/v1/communities/<slug>/hackathons/<hackathon_slug>/my-application/
    Views or withdraws the authenticated user's application.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Consulter le statut de ma candidature",
        responses={200: HackathonApplicationSerializer},
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        application = HackathonSelector.get_user_application(hackathon, request.user)
        if not application:
            return error_response(
                "Vous n'avez pas encore candidaté à ce hackathon.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        return success_response(data=HackathonApplicationSerializer(application).data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Retirer ma candidature",
        responses={200: None},
    )
    def delete(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        HackathonApplicationService.withdraw_application(request.user, hackathon)
        return success_response(message="Votre candidature a été retirée.")


class HackathonApplicationListView(APIView):
    """
    GET /api/v1/communities/<slug>/hackathons/<hackathon_slug>/applications/
    Organizer view of all participant applications with search and filters.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Hackathons"],
        summary="Lister toutes les candidatures (Organisateur)",
        parameters=[
            OpenApiParameter(name="status", type=str, required=False, description="Filtrer par statut (pending, accepted, rejected, waitlisted)"),
            OpenApiParameter(name="mode", type=str, required=False, description="Filtrer par mode (individual, team)"),
            OpenApiParameter(name="search", type=str, required=False, description="Rechercher par username, email, prénom, nom ou équipe"),
        ],
        responses={200: HackathonApplicationSerializer(many=True)},
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        if (
            hackathon.organizer_id != request.user.id
            and not HackathonSelector.is_community_manager(request.user, hackathon.community)
        ):
            return error_response(
                "Action réservée aux organisateurs.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        qs = (
            HackathonApplication.objects.filter(hackathon=hackathon)
            .select_related("applicant", "applicant__profile", "hackathon")
            .order_by("-created_at")
        )

        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        mode_param = request.query_params.get("mode")
        if mode_param:
            qs = qs.filter(participation_mode=mode_param)

        search_param = request.query_params.get("search", "").strip()
        if search_param:
            qs = qs.filter(
                Q(applicant__username__icontains=search_param)
                | Q(applicant__email__icontains=search_param)
                | Q(applicant__first_name__icontains=search_param)
                | Q(applicant__last_name__icontains=search_param)
                | Q(team_name__icontains=search_param)
            )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = HackathonApplicationSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class HackathonApplicationReviewView(APIView):
    """
    PATCH /api/v1/communities/<slug>/hackathons/<hackathon_slug>/applications/<uuid:app_id>/
    Reviews an application (accept, reject, waitlist).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Examiner une candidature (Organisateur)",
        request=ApplicationReviewRequestSerializer,
        responses={200: HackathonApplicationSerializer},
    )
    def patch(self, request, slug, hackathon_slug, app_id):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        application = (
            HackathonApplication.objects.filter(id=app_id, hackathon=hackathon)
            .select_related("applicant", "applicant__profile", "hackathon")
            .first()
        )

        if not application:
            return error_response("Candidature introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = ApplicationReviewRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = HackathonApplicationService.review_application(
            actor=request.user,
            application=application,
            new_status=serializer.validated_data["status"],
            reason=serializer.validated_data.get("reason", ""),
        )

        return success_response(
            data=HackathonApplicationSerializer(updated).data,
            message="Décision enregistrée avec succès.",
        )


class CommunityHackathonApplicationsExportView(APIView):
    """
    GET /api/v1/communities/<slug>/hackathons/<hackathon_slug>/applications/export/
    Exports all hackathon applications to a downloadable CSV file (organizers only).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Exporter les candidatures en CSV (Organisateur)",
        description="Génère et télécharge un fichier CSV contenant la liste complète des candidatures avec statut et détails.",
        parameters=[
            OpenApiParameter(name="status", type=str, required=False, description="Filtrer par statut (pending, accepted, rejected, waitlisted)"),
        ],
        responses={
            (200, "text/csv"): OpenApiResponse(description="Fichier CSV des candidatures"),
        },
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        if (
            hackathon.organizer_id != request.user.id
            and not HackathonSelector.is_community_manager(request.user, hackathon.community)
        ):
            return error_response(
                "Action réservée aux organisateurs.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        qs = (
            HackathonApplication.objects.filter(hackathon=hackathon)
            .select_related("applicant")
            .order_by("-created_at")
        )

        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{hackathon.slug}_applications.csv"'

        writer = csv.writer(response)
        writer.writerow([
            "ID",
            "Username",
            "Email",
            "First Name",
            "Last Name",
            "Participation Mode",
            "Team Name",
            "Status",
            "Submitted At",
            "Reviewed At",
        ])

        for app in qs:
            writer.writerow([
                str(app.id),
                app.applicant.username,
                app.applicant.email,
                app.applicant.first_name,
                app.applicant.last_name,
                app.participation_mode,
                app.team_name or "",
                app.status,
                app.created_at.isoformat() if app.created_at else "",
                app.reviewed_at.isoformat() if app.reviewed_at else "",
            ])

        return response
