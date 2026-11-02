from common.utils.responses import success_response
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.hackathons.selectors.hackathon_selector import HackathonSelector
from apps.hackathons.serializers.prize import HackathonPrizeSerializer
from apps.hackathons.services.hackathon_service import HackathonService


class CommunityHackathonPrizesView(APIView):
    """
    GET / POST /api/v1/communities/<slug>/hackathons/<hackathon_slug>/prizes/
    List or add prizes for a hackathon.
    """

    serializer_class = HackathonPrizeSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Hackathons"],
        summary="Lister les prix d'un hackathon",
        description="Renvoie la liste des prix, récompenses financières et lots prévus pour le hackathon.",
        responses={200: HackathonPrizeSerializer(many=True)},
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        prizes = hackathon.prizes.all()
        return success_response(data=HackathonPrizeSerializer(prizes, many=True).data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Ajouter un prix au hackathon (Organisateur)",
        description="Ajoute une récompense (financière ou matérielle) associée à un rang (1er, 2ème, 3ème prix).",
        request=HackathonPrizeSerializer,
        responses={
            201: HackathonPrizeSerializer,
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
        serializer = HackathonPrizeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        prize = HackathonService.add_prize(
            actor=request.user,
            hackathon=hackathon,
            data=serializer.validated_data,
        )
        return success_response(
            data=HackathonPrizeSerializer(prize).data,
            message="Prix ajouté avec succès.",
            status_code=status.HTTP_201_CREATED,
        )


class CommunityHackathonPrizeDetailView(APIView):
    """
    PATCH / DELETE /api/v1/communities/<slug>/hackathons/<hackathon_slug>/prizes/<uuid:prize_id>/
    Update or delete a hackathon prize.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = HackathonPrizeSerializer

    @extend_schema(
        tags=["Hackathons"],
        summary="Modifier un prix du hackathon (Organisateur)",
        description="Met à jour le titre, la récompense ou l'attribution d'un prix existant.",
        parameters=[
            OpenApiParameter(name="prize_id", type=str, location=OpenApiParameter.PATH, description="UUID du prix"),
        ],
        request=HackathonPrizeSerializer,
        responses={
            200: HackathonPrizeSerializer,
            400: OpenApiResponse(description="Erreur de validation"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Accès réservé aux organisateurs"),
            404: OpenApiResponse(description="Prix introuvable"),
        },
    )
    def patch(self, request, slug, hackathon_slug, prize_id):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        serializer = HackathonPrizeSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated = HackathonService.update_prize(
            actor=request.user,
            hackathon=hackathon,
            prize_id=str(prize_id),
            data=serializer.validated_data,
        )
        return success_response(
            data=HackathonPrizeSerializer(updated).data,
            message="Prix mis à jour avec succès.",
        )

    @extend_schema(
        tags=["Hackathons"],
        summary="Supprimer un prix du hackathon (Organisateur)",
        description="Supprime définitivement un prix du hackathon.",
        parameters=[
            OpenApiParameter(name="prize_id", type=str, location=OpenApiParameter.PATH, description="UUID du prix"),
        ],
        responses={
            200: OpenApiResponse(description="Prix supprimé avec succès"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Accès réservé aux organisateurs"),
            404: OpenApiResponse(description="Prix introuvable"),
        },
    )
    def delete(self, request, slug, hackathon_slug, prize_id):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        HackathonService.delete_prize(
            actor=request.user,
            hackathon=hackathon,
            prize_id=str(prize_id),
        )
        return success_response(message="Prix supprimé avec succès.")
