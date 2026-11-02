from apps.administration.views.admin_views import (
    AdminAuditLogListView,
    AdminDashboardView,
    AdminSystemHealthView,
    AdminSystemSettingsView,
    AdminUserToggleAdminView,
    AdminUserToggleStatusView,
    PublicSystemSettingsView,
)
from django.urls import path

app_name = 'administration'

urlpatterns = [
    path('admin/dashboard/', AdminDashboardView.as_view(), name='admin_dashboard'),
    path('admin/audit-logs/', AdminAuditLogListView.as_view(), name='admin_audit_logs'),
    path('admin/system/health/', AdminSystemHealthView.as_view(), name='admin_system_health'),
    path('admin/settings/', AdminSystemSettingsView.as_view(), name='admin_settings'),
    path('system/settings/public/', PublicSystemSettingsView.as_view(), name='public_system_settings'),
    path('admin/users/<uuid:user_id>/toggle-status/', AdminUserToggleStatusView.as_view(), name='admin_toggle_user_status'),
    path('admin/users/<uuid:user_id>/toggle-admin/', AdminUserToggleAdminView.as_view(), name='admin_toggle_user_admin'),
]
