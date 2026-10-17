from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from common.permissions import IsPlatformAdmin
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import success_response, error_response
from apps.accounts.models.user import User
from apps.accounts.serializers.user import UserSerializer
from apps.administration.models.audit import PlatformAuditLog
from apps.administration.models.setting import SystemSetting
from apps.administration.serializers.audit import (
    AdminDashboardSummarySerializer,
    PlatformAuditLogSerializer,
    SystemHealthSerializer,
    SystemSettingSerializer,
    UserToggleAdminSerializer,
    UserToggleStatusSerializer,
)
from apps.administration.services.admin_service import AdministrationService


class AdminDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @extend_schema(
        tags=['Administration & Analytics'],
        summary='Tableau de bord Superadmin consolidé',
        description='Renvoie les indicateurs globaux majeurs de la plateforme ainsi que les 10 dernières actions d\'audit de gouvernance.',
        responses={
            200: OpenApiResponse(response=AdminDashboardSummarySerializer, description='Dashboard superadmin consolidé'),
            401: OpenApiResponse(description='Authentification requise'),
            403: OpenApiResponse(description='Droits superadmin requis'),
        }
    )
    def get(self, request):
        summary = AdministrationService.get_dashboard_summary()
        return success_response(data=summary, message="Tableau de bord superadmin chargé.")


class AdminAuditLogListView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=['Administration & Analytics'],
        summary='Journal d\'audit de la gouvernance plateforme',
        description='Consulte l\'historique paginé des actions administratives (suspensions, promotions, changements de settings).',
        parameters=[
            OpenApiParameter(name='action', description='Filtrer par action (ex: user.suspend, user.promote_superadmin)', required=False, type=str),
            OpenApiParameter(name='target_type', description='Filtrer par type de cible (user, community, etc.)', required=False, type=str),
            OpenApiParameter(name='target_id', description='Filtrer par identifiant cible', required=False, type=str),
        ],
        responses={
            200: PlatformAuditLogSerializer(many=True),
            401: OpenApiResponse(description='Authentification requise'),
            403: OpenApiResponse(description='Droits superadmin requis'),
        }
    )
    def get(self, request):
        qs = PlatformAuditLog.objects.select_related('actor').order_by('-created_at')
        action_param = request.query_params.get('action')
        target_type_param = request.query_params.get('target_type')
        target_id_param = request.query_params.get('target_id')

        if action_param:
            qs = qs.filter(action=action_param)
        if target_type_param:
            qs = qs.filter(target_type=target_type_param)
        if target_id_param:
            qs = qs.filter(target_id=target_id_param)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = PlatformAuditLogSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminSystemHealthView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @extend_schema(
        tags=['Administration & Analytics'],
        summary='Vérification de l\'état de santé système (PostgreSQL, Redis, Storage)',
        description='Teste en temps réel la connectivité et latence de la base de données, du cache Redis et du stockage média.',
        responses={
            200: OpenApiResponse(response=SystemHealthSerializer, description='Rapport de santé système'),
            401: OpenApiResponse(description='Authentification requise'),
            403: OpenApiResponse(description='Droits superadmin requis'),
        }
    )
    def get(self, request):
        report = AdministrationService.check_system_health()
        return success_response(data=report, message="Bilan de santé système effectué.")


class AdminSystemSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @extend_schema(
        tags=['Administration & Analytics'],
        summary='Lister les paramètres système globaux',
        description='Consulte l\'ensemble des feature flags et paramètres d\'administration.',
        responses={200: SystemSettingSerializer(many=True)}
    )
    def get(self, request):
        settings_qs = SystemSetting.objects.all().order_by('key')
        return success_response(data=SystemSettingSerializer(settings_qs, many=True).data)

    @extend_schema(
        tags=['Administration & Analytics'],
        summary='Créer ou mettre à jour un paramètre système',
        description='Définit ou met à jour la valeur JSON d\'un paramètre système global.',
        request=SystemSettingSerializer,
        responses={200: SystemSettingSerializer}
    )
    def patch(self, request):
        key = request.data.get('key')
        value = request.data.get('value')
        if not key:
            return error_response("La clé du paramètre 'key' est obligatoire.", status_code=status.HTTP_400_BAD_REQUEST)

        description = request.data.get('description', '')
        is_public = request.data.get('is_public', False)

        setting = AdministrationService.set_setting(
            key=key,
            value=value,
            description=description,
            is_public=is_public,
            actor=request.user
        )
        return success_response(
            data=SystemSettingSerializer(setting).data,
            message=f"Paramètre '{key}' mis à jour avec succès."
        )


class PublicSystemSettingsView(APIView):
    """
    Public platform settings (community creation permissions, public feature flags).
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Administration & Analytics'],
        summary='Consulter les paramètres système publics',
        description='Renvoie la configuration publique de la plateforme (création de communauté autorisée pour Hobby/Pro, etc.).',
        responses={200: SystemSettingSerializer(many=True)}
    )
    def get(self, request):
        public_qs = SystemSetting.objects.filter(is_public=True).order_by('key')
        return success_response(data=SystemSettingSerializer(public_qs, many=True).data)



class AdminUserToggleStatusView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @extend_schema(
        tags=['Administration & Analytics'],
        summary='Activer ou suspendre un utilisateur (Gouvernance)',
        description='Bannit ou réactive un compte utilisateur à l\'échelle de la plateforme, avec traçabilité complète dans le journal d\'audit.',
        request=UserToggleStatusSerializer,
        responses={
            200: UserSerializer,
            404: OpenApiResponse(description='Utilisateur introuvable'),
        }
    )
    def post(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return error_response("Utilisateur introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = UserToggleStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        is_active = serializer.validated_data['is_active']
        reason = serializer.validated_data.get('reason', '')
        ip = request.META.get('REMOTE_ADDR')

        updated_user = AdministrationService.toggle_user_status(
            target_user=target_user,
            is_active=is_active,
            actor=request.user,
            reason=reason,
            ip_address=ip
        )
        action_str = "activé" if is_active else "suspendu"
        return success_response(
            data=UserSerializer(updated_user).data,
            message=f"Le compte {updated_user.email} a été {action_str} avec succès."
        )


class AdminUserToggleAdminView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @extend_schema(
        tags=['Administration & Analytics'],
        summary='Promouvoir ou révoquer le statut superadmin d\'un utilisateur',
        description='Accorde ou révoque les privilèges de super-administration plateforme.',
        request=UserToggleAdminSerializer,
        responses={
            200: UserSerializer,
            404: OpenApiResponse(description='Utilisateur introuvable'),
        }
    )
    def post(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return error_response("Utilisateur introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = UserToggleAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        is_superadmin = serializer.validated_data['is_superadmin']
        ip = request.META.get('REMOTE_ADDR')

        updated_user = AdministrationService.toggle_superadmin(
            target_user=target_user,
            is_superadmin=is_superadmin,
            actor=request.user,
            ip_address=ip
        )
        status_msg = "promu superadmin" if is_superadmin else "rétrogradé de son rôle superadmin"
        return success_response(
            data=UserSerializer(updated_user).data,
            message=f"L'utilisateur {updated_user.email} a été {status_msg}."
        )
