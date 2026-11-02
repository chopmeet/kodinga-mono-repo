from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.communities.models.category import CommunityCategory
from apps.communities.selectors.community_selector import CommunitySelector
from apps.communities.serializers.category import (
    CommunityCategoryCreateUpdateSerializer,
    CommunityCategorySerializer,
)
from apps.communities.services.category_service import CategoryService
from common.utils.responses import error_response, success_response


class CategoryListCreateView(APIView):
    """
    List active community categories or create a new category.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    @extend_schema(
        tags=["Communities & Memberships"],
        summary="Lister les catégories thématiques",
        parameters=[
            OpenApiParameter(
                name="include_inactive",
                description="Inclure les catégories inactives (true/false)",
                required=False,
                type=bool,
            ),
        ],
        responses={200: CommunityCategorySerializer(many=True)},
    )
    def get(self, request):
        include_inactive_param = request.query_params.get("include_inactive")
        include_inactive = (
            include_inactive_param.lower() in ["true", "1"]
            if include_inactive_param
            else False
        )
        cats = CommunitySelector.get_categories(include_inactive=include_inactive)
        return success_response(
            data=CommunityCategorySerializer(cats, many=True).data
        )

    @extend_schema(
        tags=["Communities & Memberships"],
        summary="Créer une nouvelle catégorie thématique",
        request=CommunityCategoryCreateUpdateSerializer,
        responses={201: CommunityCategorySerializer},
    )
    def post(self, request):
        serializer = CommunityCategoryCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        category = CategoryService.create_category(serializer.validated_data)
        return success_response(
            data=CommunityCategorySerializer(category).data,
            message="Catégorie créée avec succès !",
            status_code=status.HTTP_201_CREATED,
        )


class CategoryDetailView(APIView):
    """
    Get, update, or deactivate a specific community category by slug.
    """

    def get_permissions(self):
        if self.request.method in ["PATCH", "PUT", "DELETE"]:
            return [IsAuthenticated()]
        return [AllowAny()]

    @extend_schema(
        tags=["Communities & Memberships"],
        summary="Consulter les détails d'une catégorie par son slug",
        responses={200: CommunityCategorySerializer},
    )
    def get(self, request, slug):
        try:
            category = CommunitySelector.get_category_by_slug(slug)
        except CommunityCategory.DoesNotExist:
            return error_response(
                "Catégorie introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        return success_response(data=CommunityCategorySerializer(category).data)

    @extend_schema(
        tags=["Communities & Memberships"],
        summary="Mettre à jour une catégorie thématique",
        request=CommunityCategoryCreateUpdateSerializer,
        responses={200: CommunityCategorySerializer},
    )
    def patch(self, request, slug):
        try:
            category = CommunitySelector.get_category_by_slug(slug)
        except CommunityCategory.DoesNotExist:
            return error_response(
                "Catégorie introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        serializer = CommunityCategoryCreateUpdateSerializer(
            category, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)

        updated = CategoryService.update_category(
            category, serializer.validated_data
        )
        return success_response(
            data=CommunityCategorySerializer(updated).data,
            message="Catégorie mise à jour avec succès.",
        )

    @extend_schema(
        tags=["Communities & Memberships"],
        summary="Supprimer / Désactiver une catégorie thématique",
        parameters=[
            OpenApiParameter(
                name="hard_delete",
                description="Suppression définitive en base (true/false)",
                required=False,
                type=bool,
            ),
        ],
        responses={200: None},
    )
    def delete(self, request, slug):
        try:
            category = CommunitySelector.get_category_by_slug(slug)
        except CommunityCategory.DoesNotExist:
            return error_response(
                "Catégorie introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        hard_delete_param = request.query_params.get("hard_delete")
        hard_delete = (
            hard_delete_param.lower() in ["true", "1"]
            if hard_delete_param
            else False
        )
        CategoryService.delete_category(category, hard_delete=hard_delete)
        return success_response(message="Catégorie supprimée avec succès.")
