from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.communities.selectors.community_selector import CommunitySelector
from apps.memberships.permissions import check_community_read_permission
from apps.posts.models.category import PostCategory
from apps.posts.selectors.post_selector import PostSelector
from apps.posts.serializers.category import PostCategorySerializer
from apps.posts.serializers.post import (
    PostCreateUpdateSerializer,
    PostDetailSerializer,
    PostListSerializer,
)
from apps.posts.services.post_service import PostService
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response


class CommunityFeedView(APIView):
    """
    List feed posts or create a new post in a community.
    """
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    @extend_schema(
        tags=['Feed & Posts'],
        summary="Explorer le flux de publications d'une communauté",
        parameters=[
            OpenApiParameter(name='category', description="Slug du canal (#general, #help...)", required=False, type=str),
            OpenApiParameter(name='type', description="Type de post (discussion, question, project_showcase, poll, announcement)", required=False, type=str),
            OpenApiParameter(name='q', description="Recherche par mot-clé", required=False, type=str),
            OpenApiParameter(name='pinned', description="Filtrer les posts épinglés (true/false)", required=False, type=bool),
        ],
        responses={200: PostListSerializer(many=True)}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        check_community_read_permission(request.user, community)

        category = request.query_params.get('category')
        post_type = request.query_params.get('type')
        q = request.query_params.get('q')
        pinned_param = request.query_params.get('pinned')
        is_pinned = pinned_param.lower() in ['true', '1'] if pinned_param else None

        since_param = request.query_params.get('since')
        since = None
        if since_param:
            try:
                from django.utils.dateparse import parse_datetime

                since = parse_datetime(since_param)
            except Exception:
                pass

        queryset = PostSelector.get_community_feed(
            community=community,
            category_slug=category,
            post_type=post_type,
            search=q,
            is_pinned=is_pinned,
            user=request.user,
            since=since,
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = PostListSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=['Feed & Posts'],
        summary="Publier un nouveau post dans la communauté",
        request=PostCreateUpdateSerializer,
        responses={201: PostDetailSerializer}
    )
    def post(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = PostCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        media_ids = serializer.validated_data.pop('media_ids', None)
        poll_data = serializer.validated_data.pop('poll', None)

        post = PostService.create_post(
            author=request.user,
            community=community,
            data=serializer.validated_data,
            poll_data=poll_data,
            media_ids=media_ids
        )

        return success_response(
            data=PostDetailSerializer(post, context={'request': request}).data,
            message="Publication partagée avec succès !",
            status_code=status.HTTP_201_CREATED
        )


class CommunityPostCategoriesView(APIView):
    """
    List or create post categories / channels in a community.
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    @extend_schema(
        tags=['Feed & Posts'],
        summary="Lister les canaux / catégories de publications",
        operation_id="community_post_channels_list",
        responses={200: PostCategorySerializer(many=True)}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        check_community_read_permission(request.user, community)

        categories = PostSelector.get_categories(community)
        return success_response(data=PostCategorySerializer(categories, many=True).data)

    @extend_schema(
        tags=['Feed & Posts'],
        summary="Créer un nouveau canal de discussion (#canal)",
        operation_id="community_post_channels_create",
        request=PostCategorySerializer,
        responses={201: PostCategorySerializer}
    )
    def post(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = PostCategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cat = PostCategory.objects.create(
            community=community,
            **serializer.validated_data
        )
        return success_response(
            data=PostCategorySerializer(cat).data,
            message="Canal créé avec succès.",
            status_code=status.HTTP_201_CREATED
        )
