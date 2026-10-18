from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.communities.models.community import Community
from apps.communities.selectors.community_selector import CommunitySelector
from apps.communities.serializers.community import (
    CommunityCreateUpdateSerializer,
    CommunityDetailSerializer,
    CommunityListSerializer,
)
from apps.communities.services.community_service import CommunityService
from apps.memberships.models.member import CommunityMember, MembershipStatus
from common.utils.pagination import (
    CommunityGridPagination,
    StandardResultsSetPagination,
)
from common.utils.responses import error_response, success_response


class CommunityListCreateView(APIView):
    """
    Public directory of communities with search and creation of new spaces.
    Optimized for infinite scrolling (9 per page) and 3-column grid layouts.
    """
    pagination_class = CommunityGridPagination

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Explorer et rechercher des communautés",
        parameters=[
            OpenApiParameter(name='q', description="Recherche textuelle (nom, description, tag)", required=False, type=str),
            OpenApiParameter(name='category', description="Slug de la catégorie", required=False, type=str),
            OpenApiParameter(name='privacy', description="Type de confidentialité (public, private)", required=False, type=str),
            OpenApiParameter(name='pricing', description="Type de tarification (free, paid)", required=False, type=str),
            OpenApiParameter(name='is_featured', description="Communautés à la une (true/false)", required=False, type=bool),
            OpenApiParameter(name='page', description="Numéro de la page (Infinite Scroll)", required=False, type=int),
            OpenApiParameter(name='page_size', description="Nombre d'éléments par page (défaut: 9)", required=False, type=int),
        ],
        responses={200: CommunityListSerializer(many=True)}
    )
    def get(self, request):
        q = request.query_params.get('q')
        category = request.query_params.get('category')
        privacy = request.query_params.get('privacy')
        pricing = request.query_params.get('pricing')
        featured_param = request.query_params.get('is_featured')
        featured = featured_param.lower() in ['true', '1'] if featured_param else None

        queryset = CommunitySelector.search_communities(
            search_query=q,
            category_slug=category,
            privacy=privacy,
            pricing=pricing,
            is_featured=featured,
            user=request.user
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)

        user_memberships = None
        if request.user.is_authenticated and page:
            user_memberships = set(
                CommunityMember.objects.filter(
                    user=request.user,
                    community_id__in=[c.id for c in page],
                    status=MembershipStatus.ACTIVE
                ).values_list('community_id', flat=True)
            )

        serializer = CommunityListSerializer(
            page,
            many=True,
            context={'request': request, 'user_memberships': user_memberships}
        )
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Créer un nouvel espace communautaire",
        request=CommunityCreateUpdateSerializer,
        responses={201: CommunityDetailSerializer}
    )
    def post(self, request):
        serializer = CommunityCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        rules_data = serializer.validated_data.pop('rules', None)
        settings_data = serializer.validated_data.pop('settings', None)

        community = CommunityService.create_community(
            owner=request.user,
            data=serializer.validated_data,
            rules_data=rules_data,
            settings_data=settings_data
        )

        return success_response(
            data=CommunityDetailSerializer(community, context={'request': request}).data,
            message="Espace communautaire créé avec succès !",
            status_code=status.HTTP_201_CREATED
        )


class CommunityDetailView(APIView):
    """
    Get, update, or archive a specific community by slug.
    """
    def get_permissions(self):
        if self.request.method in ['PATCH', 'PUT', 'DELETE']:
            return [IsAuthenticated()]
        return [AllowAny()]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Consulter les détails d'une communauté par son slug",
        responses={200: CommunityDetailSerializer}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Community.DoesNotExist:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = CommunityDetailSerializer(community, context={'request': request})
        return success_response(data=serializer.data)

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Mettre à jour les informations d'une communauté",
        request=CommunityCreateUpdateSerializer,
        responses={200: CommunityDetailSerializer}
    )
    def patch(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Community.DoesNotExist:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = CommunityCreateUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated = CommunityService.update_community(community, request.user, serializer.validated_data)
        return success_response(
            data=CommunityDetailSerializer(updated, context={'request': request}).data,
            message="Communauté mise à jour."
        )

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Archiver / Supprimer une communauté (Propriétaire uniquement)",
        responses={200: None}
    )
    def delete(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Community.DoesNotExist:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        CommunityService.delete_community(community, request.user)
        return success_response(message="Communauté archivée avec succès.")


class MyCommunitiesListView(APIView):
    """
    List of communities the authenticated user owns or participates in.
    """
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Lister mes espaces communautaires",
        responses={200: CommunityListSerializer(many=True)}
    )
    def get(self, request):
        queryset = CommunitySelector.get_user_communities(request.user)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = CommunityListSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

