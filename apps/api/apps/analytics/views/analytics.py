from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from common.permissions import IsPlatformAdmin
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import success_response, error_response
from apps.analytics.models.metric import PlatformMetric
from apps.analytics.serializers.analytics import (
    AnalyticsOverviewSerializer,
    EngagementAnalyticsSerializer,
    FinancialAnalyticsSerializer,
    PlatformMetricSerializer,
)
from apps.analytics.services.analytics_service import AnalyticsService


class AnalyticsOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @extend_schema(
        tags=['Analytics'],
        summary='Vue d\'ensemble analytique de la plateforme (Superadmin)',
        description='Renvoie les compteurs macroscopiques globaux (utilisateurs, communautés, posts, formations, revenus). Résultat mis en cache Redis 5 minutes.',
        parameters=[
            OpenApiParameter(name='refresh', description='Forcer le recalcul sans utiliser le cache Redis', required=False, type=bool),
        ],
        responses={
            200: OpenApiResponse(response=AnalyticsOverviewSerializer, description='Indicateurs macroscopiques'),
            401: OpenApiResponse(description='Authentification requise'),
            403: OpenApiResponse(description='Droits superadmin requis'),
        }
    )
    def get(self, request):
        force_refresh = request.query_params.get('refresh', '').lower() in ['true', '1']
        data = AnalyticsService.get_overview_metrics(force_refresh=force_refresh)
        return success_response(data=data, message="Vue d'ensemble analytique récupérée.")


class AnalyticsFinancialView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @extend_schema(
        tags=['Analytics'],
        summary='Statistiques financières et monétisation (Superadmin)',
        description='Renvoie la ventilation des revenus, volume de transactions, abonnements actifs et transactions récentes.',
        parameters=[
            OpenApiParameter(name='refresh', description='Forcer le rafraîchissement du cache', required=False, type=bool),
        ],
        responses={
            200: OpenApiResponse(response=FinancialAnalyticsSerializer, description='Statistiques financières'),
            401: OpenApiResponse(description='Authentification requise'),
            403: OpenApiResponse(description='Droits superadmin requis'),
        }
    )
    def get(self, request):
        force_refresh = request.query_params.get('refresh', '').lower() in ['true', '1']
        data = AnalyticsService.get_financial_metrics(force_refresh=force_refresh)
        return success_response(data=data, message="Métriques financières récupérées.")


class AnalyticsEngagementView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @extend_schema(
        tags=['Analytics'],
        summary='Métriques d\'engagement et d\'activité utilisateurs (Superadmin)',
        description='Renvoie le DAU, WAU, MAU, ratio DAU/MAU, activité sociale et apprenants actifs.',
        parameters=[
            OpenApiParameter(name='refresh', description='Forcer le rafraîchissement du cache', required=False, type=bool),
        ],
        responses={
            200: OpenApiResponse(response=EngagementAnalyticsSerializer, description='Métriques d\'engagement'),
            401: OpenApiResponse(description='Authentification requise'),
            403: OpenApiResponse(description='Droits superadmin requis'),
        }
    )
    def get(self, request):
        force_refresh = request.query_params.get('refresh', '').lower() in ['true', '1']
        data = AnalyticsService.get_engagement_metrics(force_refresh=force_refresh)
        return success_response(data=data, message="Métriques d'engagement récupérées.")


class AnalyticsMetricsListView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=['Analytics'],
        summary='Historique des métriques enregistrées (Superadmin)',
        description='Liste paginée des instantanés de métriques enregistrés en base avec filtrage par nom ou type.',
        parameters=[
            OpenApiParameter(name='metric_name', description='Filtrer par nom de métrique', required=False, type=str),
            OpenApiParameter(name='metric_type', description='Filtrer par type (counter, gauge, financial, engagement)', required=False, type=str),
        ],
        responses={
            200: PlatformMetricSerializer(many=True),
            401: OpenApiResponse(description='Authentification requise'),
            403: OpenApiResponse(description='Droits superadmin requis'),
        }
    )
    def get(self, request):
        qs = PlatformMetric.objects.all().order_by('-recorded_at')
        name_filter = request.query_params.get('metric_name')
        type_filter = request.query_params.get('metric_type')

        if name_filter:
            qs = qs.filter(metric_name=name_filter)
        if type_filter:
            qs = qs.filter(metric_type=type_filter)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = PlatformMetricSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=['Analytics'],
        summary='Enregistrer un instantané de métrique (Superadmin)',
        description='Enregistre une métrique manuelle ou un snapshot dans la table des métriques.',
        request=PlatformMetricSerializer,
        responses={
            201: PlatformMetricSerializer,
            400: OpenApiResponse(description='Erreur de validation'),
        }
    )
    def post(self, request):
        serializer = PlatformMetricSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        metric = serializer.save()
        return success_response(
            data=PlatformMetricSerializer(metric).data,
            message="Métrique enregistrée avec succès.",
            status_code=status.HTTP_201_CREATED
        )
