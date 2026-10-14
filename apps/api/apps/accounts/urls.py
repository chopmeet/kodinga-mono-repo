from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.views.auth import (
    ChangePasswordView,
    EmailVerificationView,
    LoginView,
    LogoutAllView,
    LogoutView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    ResendVerificationView,
)
from apps.accounts.views.oauth import OAuthCallbackView, OAuthStartView
from apps.accounts.views.session import UserSessionDetailView, UserSessionListView
from apps.accounts.views.user import (
    UserConsentView,
    UserDetailAdminView,
    UserListView,
    UserProfileMeView,
)

app_name = 'accounts'

urlpatterns = [
    # Auth endpoints
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/logout-all/', LogoutAllView.as_view(), name='logout_all'),
    path('auth/verify-email/', EmailVerificationView.as_view(), name='verify_email'),
    path('auth/resend-verification/', ResendVerificationView.as_view(), name='resend_verification'),
    path('auth/password/reset/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('auth/password/reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('auth/password/change/', ChangePasswordView.as_view(), name='password_change'),
    
    # Active sessions
    path('auth/sessions/', UserSessionListView.as_view(), name='session_list'),
    path('auth/sessions/<uuid:session_id>/', UserSessionDetailView.as_view(), name='session_detail'),
    
    # OAuth
    path('auth/<str:provider>/start/', OAuthStartView.as_view(), name='oauth_start'),
    path('auth/<str:provider>/callback/', OAuthCallbackView.as_view(), name='oauth_callback'),
    
    # Users & Profiles
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/me/', UserProfileMeView.as_view(), name='user_me'),
    path('users/me/consents/', UserConsentView.as_view(), name='user_consents'),
    path('users/<uuid:user_id>/', UserDetailAdminView.as_view(), name='user_detail_admin'),
]
