"""
Django settings for Kodinga Backend API.
Centralized production-ready configuration using django-environ.
"""

from datetime import timedelta
from pathlib import Path
import sys
import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Add BASE_DIR to sys.path to easily import apps and common
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ['*']),
    CSRF_TRUSTED_ORIGINS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, ['http://localhost:3000', 'http://127.0.0.1:3000']),
    CORS_ALLOW_ALL_ORIGINS=(bool, True),
)

# Load .env file if present
environ.Env.read_env(BASE_DIR / '.env')

# Core Security Settings
SECRET_KEY = env('SECRET_KEY', default='django-insecure-kodinga-dev-secret-key-replace-in-prod')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env('ALLOWED_HOSTS')
CSRF_TRUSTED_ORIGINS = env('CSRF_TRUSTED_ORIGINS')

# Behind the VPS nginx (TLS terminated there): trust its X-Forwarded-Proto so Django knows
# the request was HTTPS (secure cookies, https:// absolute URLs). The api port is only
# published on 127.0.0.1, so this header cannot be forged from outside.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party packages
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'drf_spectacular',

    # Internal applications & common core
    'common',
    'apps.accounts.apps.AccountsConfig',
    'api',
]

AUTH_USER_MODEL = 'accounts.User'

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# Database configuration (Neon PostgreSQL or local SQLite fallback)
DATABASE_URL_VAL = env.str('DATABASE_URL', default='').strip()
if DATABASE_URL_VAL:
    DATABASES = {
        'default': env.db_url_config(DATABASE_URL_VAL)
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 8,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'common.utils.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'EXCEPTION_HANDLER': 'common.exceptions.handler.custom_exception_handler',
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# SimpleJWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=env.int('JWT_ACCESS_MINUTES', default=15)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=env.int('JWT_REFRESH_DAYS', default=7)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'JTI_CLAIM': 'jti',
}

# drf-spectacular OpenAPI & Swagger UI Settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'Kodinga Platform API',
    'DESCRIPTION': (
        'High-performance, multi-tenant developer community SaaS backend API.\n\n'
        '### 🔐 Guide d\'Authentification sur Swagger\n'
        '1. Exécutez `POST /api/v1/auth/login/` ou `POST /api/v1/auth/register/`.\n'
        '2. Copiez la valeur du champ `access` (ex: `eyJhbGciOi...`).\n'
        '3. Cliquez sur le bouton vert **Authorize** en haut à droite.\n'
        '4. Collez votre token (ou `Bearer <token>`) et cliquez sur **Authorize**.\n'
        '5. Vous pouvez désormais tester tous les endpoints protégés (`GET /api/v1/users/me/`, etc.).'
    ),
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SCHEMA_PATH_PREFIX': r'/api/v[0-9]',
    'COMPONENT_SPLIT_REQUEST': True,
    'SECURITY': [{'jwtAuth': []}],
    'APPEND_COMPONENTS': {
        'securitySchemes': {
            'jwtAuth': {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'JWT',
            }
        }
    },
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'persistAuthorization': True,
        'displayOperationId': False,
        'filter': True,
        'docExpansion': 'list',
        'defaultModelsExpandDepth': 3,
        'defaultModelExpandDepth': 3,
    },
    'TAGS': [
        {'name': 'Authentication', 'description': 'User registration, login, JWT refresh, logout, password recovery.'},
        {'name': 'Sessions', 'description': 'Active devices, session audit, and token revocations.'},
        {'name': 'OAuth', 'description': 'Third-party single sign-on (Google, GitHub).'},
        {'name': 'Users', 'description': 'Authenticated user profiles and legal consents.'},
    ],
}

# CORS Configuration
CORS_ALLOWED_ORIGINS = env('CORS_ALLOWED_ORIGINS')
CORS_ALLOW_ALL_ORIGINS = env('CORS_ALLOW_ALL_ORIGINS')
CORS_ALLOW_CREDENTIALS = True

# App & Frontend URLs
APP_NAME = env('APP_NAME', default='Kodinga')
FRONTEND_URL = env('FRONTEND_URL', default='http://localhost:3000')
BACKEND_URL = env('BACKEND_URL', default='http://localhost:8000')
SUPPORT_EMAIL = env('SUPPORT_EMAIL', default='support@kodinga.com')

# Email (SMTP) Configuration
EMAIL_BACKEND = env('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend' if not DEBUG else 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = env('EMAIL_HOST', default='smtp.sendgrid.net')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
EMAIL_USE_SSL = env.bool('EMAIL_USE_SSL', default=False)
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='Kodinga <no-reply@kodinga.com>')
EMAIL_TIMEOUT = env.int('EMAIL_TIMEOUT', default=20)

# Celery & Redis Configuration
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache' if DEBUG else 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': env('REDIS_CACHE_URL', default='redis://127.0.0.1:6379/1'),
    }
}

# External OAuth Credentials
GOOGLE_CLIENT_ID = env('GOOGLE_CLIENT_ID', default='')
GOOGLE_CLIENT_SECRET = env('GOOGLE_CLIENT_SECRET', default='')
GITHUB_CLIENT_ID = env('GITHUB_CLIENT_ID', default='')
GITHUB_CLIENT_SECRET = env('GITHUB_CLIENT_SECRET', default='')
