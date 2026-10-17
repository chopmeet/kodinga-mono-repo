from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.hackathons.models.criterion import HackathonCriterion
from apps.hackathons.selectors.hackathon_selector import HackathonSelector
from apps.hackathons.serializers.criterion import HackathonCriterionSerializer
from apps.hackathons.services.hackathon_service import HackathonService
from common.utils.responses import error_response, success_response


class CommunityHackathonCriteriaView(APIView):
    """
    GET / POST /api/v1/communities/<slug>/hackathons/<hackathon_slug>/criteria/
    List or add judging criteria for a hackathon.
    """

    serializer_class = HackathonCriterionSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Hackathons"],
        summary="Lister les critères d'évaluation d'un hackathon",
        description="Renvoie la liste des critères de notation (innovation, faisabilité, etc.) avec leurs barèmes et coefficients.",
        responses={200: HackathonCriterionSerializer(many=True)},
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        criteria = hackathon.criteria.all()
        return success_response(data=HackathonCriterionSerializer(criteria, many=True).data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Ajouter un critère d'évaluation (Organisateur)",
        description="Crée un critère de notation pour le hackathon avec intitulé, barème (min_score, max_score) et pondération.",
        request=HackathonCriterionSerializer,
        responses={
            201: HackathonCriterionSerializer,
            400: OpenApiResponse(description="Erreur de validation"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Accès réservé aux organisateurs"),
        },
    )
    def post(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        serializer = HackathonCriterionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        criterion = HackathonService.add_criterion(
            actor=request.user,
            hackathon=hackathon,
            data=serializer.validated_data,
        )
        return success_response(
            data=HackathonCriterionSerializer(criterion).data,
            message="Critère d'évaluation ajouté avec succès.",
            status_code=status.HTTP_201_CREATED,
        )


class CommunityHackathonCriterionDetailView(APIView):
    """
    PATCH / DELETE /api/v1/communities/<slug>/hackathons/<hackathon_slug>/criteria/<uuid:criterion_id>/
    Update or delete a judging criterion.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = HackathonCriterionSerializer

    @extend_schema(
        tags=["Hackathons"],
        summary="Modifier un critère d'évaluation (Organisateur)",
        description="Met à jour les informations, le barème ou le coefficient d'un critère existant.",
        parameters=[
            OpenApiParameter(name="criterion_id", type=str, location=OpenApiParameter.PATH, description="UUID du critère"),
        ],
        request=HackathonCriterionSerializer,
        responses={
            200: HackathonCriterionSerializer,
            400: OpenApiResponse(description="Erreur de validation"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Accès réservé aux organisateurs"),
            404: OpenApiResponse(description="Critère introuvable"),
        },
    )
    def patch(self, request, slug, hackathon_slug, criterion_id):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        serializer = HackathonCriterionSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated = HackathonService.update_criterion(
            actor=request.user,
            hackathon=hackathon,
            criterion_id=str(criterion_id),
            data=serializer.validated_data,
        )
        return success_response(
            data=HackathonCriterionSerializer(updated).data,
            message="Critère d'évaluation mis à jour avec succès.",
        )

    @extend_schema(
        tags=["Hackathons"],
        summary="Supprimer un critère d'évaluation (Organisateur)",
        description="Supprime définitivement un critère d'évaluation du hackathon.",
        parameters=[
            OpenApiParameter(name="criterion_id", type=str, location=OpenApiParameter.PATH, description="UUID du critère"),
        ],
        responses={
            200: OpenApiResponse(description="Critère supprimé avec succès"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Accès réservé aux organisateurs"),
            404: OpenApiResponse(description="Critère introuvable"),
        },
    )
    def delete(self, request, slug, hackathon_slug, criterion_id):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        HackathonService.delete_criterion(
            actor=request.user,
            hackathon=hackathon,
            criterion_id=str(criterion_id),
        )
        return success_response(message="Critère supprimé avec succès.")
