from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from api.views import health

urlpatterns = [
    # Administration
    path('admin/', admin.site.urls),

    # Health Check
    path('api/v1/health/', health, name='health_check'),

    # API v1 Domain Modules
    path('api/v1/', include('apps.accounts.urls', namespace='accounts')),

    # OpenAPI / Swagger Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
