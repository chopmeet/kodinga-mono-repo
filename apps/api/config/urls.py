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
    path('api/v1/', include('apps.profiles.urls', namespace='profiles')),
    path('api/v1/', include('apps.media.urls', namespace='media')),
    path('api/v1/', include('apps.communities.urls', namespace='communities')),
    path('api/v1/', include('apps.memberships.urls', namespace='memberships')),
    path('api/v1/', include('apps.posts.urls', namespace='posts')),
    path('api/v1/', include('apps.billing.urls', namespace='billing')),
    path('api/v1/', include('apps.classroom.urls', namespace='classroom')),

    # OpenAPI / Swagger Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

