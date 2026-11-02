from apps.administration.models.audit import PlatformAuditLog
from apps.administration.models.setting import SystemSetting
from common.permissions.base import is_superadmin_user
from django.contrib import admin


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    """
    Interface Django Admin permettant au Superadmin de manipuler les variables globales
    de la plateforme (notamment `pro_monthly_price` et `community_creation_allowed_for`).
    """
    list_display = ('key', 'value', 'is_public', 'description', 'updated_by', 'updated_at')
    list_editable = ('value', 'is_public')
    list_filter = ('is_public',)
    search_fields = ('key', 'description')
    readonly_fields = ('id', 'updated_by', 'created_at', 'updated_at')

    def has_module_permission(self, request):
        return bool(request.user and request.user.is_authenticated and (request.user.is_superuser or request.user.is_staff or is_superadmin_user(request.user)))

    def has_change_permission(self, request, obj=None):
        return bool(request.user and request.user.is_authenticated and (request.user.is_superuser or is_superadmin_user(request.user)))

    def has_add_permission(self, request):
        return bool(request.user and request.user.is_authenticated and (request.user.is_superuser or is_superadmin_user(request.user)))

    def save_model(self, request, obj, form, change):
        if request.user and request.user.is_authenticated:
            obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(PlatformAuditLog)
class PlatformAuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'actor', 'target_type', 'target_id', 'ip_address', 'created_at')
    list_filter = ('action', 'target_type', 'created_at')
    search_fields = ('action', 'actor__username', 'actor__email', 'target_id')
    readonly_fields = ('id', 'actor', 'action', 'target_type', 'target_id', 'details', 'ip_address', 'user_agent', 'created_at', 'updated_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

