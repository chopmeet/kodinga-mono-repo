from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from common.serializers.base import EmptySerializer
from common.utils.responses import success_response
from apps.accounts.serializers.auth import (
    ChangePasswordSerializer,
    EmailVerificationSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
)
from apps.accounts.serializers.user import UserSerializer
from apps.accounts.services.authentication import AuthenticationService
from apps.accounts.services.password import PasswordChangeService, PasswordResetService
from apps.accounts.services.registration import RegistrationService
from apps.accounts.services.session import SessionService
from apps.accounts.services.verification import EmailVerificationService


class RegisterView(APIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    @extend_schema(
        tags=['Authentication'],
        summary='Register a new developer account',
        description='Creates a new user account, stores legal consents, and sends an email verification link.',
        request=RegisterSerializer,
        responses={
            201: OpenApiResponse(response=UserSerializer, description='Account successfully registered'),
            400: OpenApiResponse(description='Validation error or duplicate credentials'),
        }
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = RegistrationService.register_user(
            email=serializer.validated_data['email'],
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password'],
            first_name=serializer.validated_data.get('first_name', ''),
            last_name=serializer.validated_data.get('last_name', ''),
            preferred_language=serializer.validated_data.get('preferred_language', 'fr'),
            timezone_name=serializer.validated_data.get('timezone', 'UTC'),
            terms_accepted=serializer.validated_data.get('terms_accepted', True),
            request=request
        )
        user_data = UserSerializer(user).data
        return success_response(
            data=user_data,
            message="Account successfully created. A verification email has been sent.",
            status_code=status.HTTP_201_CREATED
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    @extend_schema(
        tags=['Authentication'],
        summary='Authenticate user and issue JWT tokens',
        description='Validates user credentials, creates a new session record, and returns Access & Refresh JWTs.',
        request=LoginSerializer,
        responses={
            200: OpenApiResponse(description='Successful login with JWT credentials and user payload'),
            401: OpenApiResponse(description='Invalid email or password'),
            403: OpenApiResponse(description='Account is disabled'),
        }
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = AuthenticationService.login_user(
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
            request=request,
            device_name=serializer.validated_data.get('device_name', '')
        )
        user_data = UserSerializer(result['user']).data
        return success_response(
            data={
                'access': result['access'],
                'refresh': result['refresh'],
                'token': result['access'],
                'is_superadmin': getattr(result['user'], 'is_superadmin', False),
                'status': user_data.get('status', 'active'),
                'session_id': result['session_id'],
                'user': user_data,
            },
            message="Login successful."
        )


class EmailVerificationView(APIView):
    permission_classes = [AllowAny]
    serializer_class = EmailVerificationSerializer

    @extend_schema(
        tags=['Authentication'],
        summary='Verify account email address',
        description='Validates a single-use token and marks the associated user email as verified (via GET query param or POST payload).',
        request=EmailVerificationSerializer,
        responses={
            200: OpenApiResponse(response=UserSerializer, description='Email verified successfully'),
            400: OpenApiResponse(description='Invalid or expired verification token'),
        }
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = EmailVerificationService.verify_email(
            token_str=serializer.validated_data['token'],
            request=request
        )
        return success_response(
            data=UserSerializer(user).data,
            message="Email address verified successfully."
        )

    def get(self, request):
        token_str = request.query_params.get('token', '').strip()
        if not token_str:
            serializer = self.serializer_class(data=request.query_params)
            serializer.is_valid(raise_exception=True)
            token_str = serializer.validated_data['token']

        user = EmailVerificationService.verify_email(
            token_str=token_str,
            request=request
        )
        return success_response(
            data=UserSerializer(user).data,
            message="Email address verified successfully."
        )


class ResendVerificationView(APIView):
    permission_classes = [AllowAny]
    serializer_class = ResendVerificationSerializer

    @extend_schema(
        tags=['Authentication'],
        summary='Resend email verification link',
        description='Dispatches a new verification token to the specified email if unverified. Always returns 200 to prevent user enumeration.',
        request=ResendVerificationSerializer,
        responses={
            200: OpenApiResponse(description='Generic confirmation response'),
        }
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        EmailVerificationService.resend_verification_email(
            email=serializer.validated_data['email'],
            request=request
        )
        return success_response(
            message="If an unverified account with this email exists, a verification link has been sent."
        )


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    serializer_class = PasswordResetRequestSerializer

    @extend_schema(
        tags=['Authentication'],
        summary='Request password reset instructions',
        description='Sends a single-use password reset link to the email. Returns 200 regardless of existence to prevent enumeration.',
        request=PasswordResetRequestSerializer,
        responses={
            200: OpenApiResponse(description='Instructions sent successfully if account exists'),
        }
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = PasswordResetService.request_password_reset(
            email=serializer.validated_data['email'],
            request=request
        )
        from django.conf import settings
        debug_data = result if getattr(settings, 'DEBUG', False) else None
        return success_response(
            data=debug_data,
            message="If an account with this email exists, password reset instructions have been sent."
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    serializer_class = PasswordResetConfirmSerializer

    @extend_schema(
        tags=['Authentication'],
        summary='Confirm password reset with token',
        description='Validates the reset token, updates password, and revokes all active sessions.',
        request=PasswordResetConfirmSerializer,
        responses={
            200: OpenApiResponse(response=UserSerializer, description='Password reset successfully'),
            400: OpenApiResponse(description='Invalid or expired reset token'),
        }
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = PasswordResetService.confirm_password_reset(
            token_str=serializer.validated_data['token'],
            new_password=serializer.validated_data['new_password'],
            request=request
        )
        return success_response(
            data=UserSerializer(user).data,
            message="Password has been reset successfully. You can now log in."
        )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    @extend_schema(
        tags=['Authentication'],
        summary='Change password for authenticated user',
        description='Validates current password and sets a new password for the currently logged-in user.',
        request=ChangePasswordSerializer,
        responses={
            200: OpenApiResponse(description='Password updated successfully'),
            400: OpenApiResponse(description='Validation or current password error'),
            401: OpenApiResponse(description='Authentication required'),
        }
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        PasswordChangeService.change_password(
            user=request.user,
            new_password=serializer.validated_data['new_password'],
            request=request
        )
        return success_response(message="Password updated successfully.")


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EmptySerializer

    @extend_schema(
        tags=['Authentication'],
        summary='Log out current session',
        description='Blacklists the provided refresh token and invalidates current device session.',
        request=EmptySerializer,
        responses={
            200: OpenApiResponse(description='Successfully logged out'),
            401: OpenApiResponse(description='Authentication required'),
        }
    )
    def post(self, request):
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass
        return success_response(message="Logged out successfully.")


class LogoutAllView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EmptySerializer

    @extend_schema(
        tags=['Authentication'],
        summary='Log out from all devices / revoke all sessions',
        description='Revokes all active sessions and blacklists all outstanding refresh tokens for the user.',
        request=EmptySerializer,
        responses={
            200: OpenApiResponse(description='All sessions successfully revoked'),
            401: OpenApiResponse(description='Authentication required'),
        }
    )
    def post(self, request):
        revoked_count = SessionService.revoke_all_sessions(request.user)
        return success_response(
            message=f"All active sessions ({revoked_count}) have been revoked."
        )
