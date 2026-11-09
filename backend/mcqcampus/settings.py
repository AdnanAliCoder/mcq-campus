import os
import hashlib
import logging
from pathlib import Path
import dj_database_url

BASE_DIR = Path(__file__).resolve().parents[2]


def _static_asset_version():
    """Fingerprint served entry assets without walking the full static directory on cold start."""
    digest = hashlib.sha256()
    relative_paths = (
        'frontend/style.css', 'frontend/script.js', 'frontend/index.html',
        'frontend/assets/favicon.svg', 'frontend/assets/genfavicon-16.png',
        'frontend/assets/genfavicon-32.png', 'frontend/assets/genfavicon-48.png',
        'frontend/site.webmanifest', 'frontend/sw.js',
    )
    found = 0
    for relative in relative_paths:
        path = BASE_DIR / relative
        if not path.is_file():
            continue
        try:
            digest.update(relative.encode('utf-8'))
            digest.update(b'\0')
            with path.open('rb') as asset_file:
                for chunk in iter(lambda: asset_file.read(131072), b''):
                    digest.update(chunk)
            digest.update(b'\0')
            found += 1
        except OSError:
            continue
    return digest.hexdigest()[:16] if found else 'static-v1'


STATIC_ASSET_VERSION = _static_asset_version()
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-only-change-me')
DEBUG = os.getenv('DEBUG', 'false').lower() in {'1', 'true', 'yes', 'on'}

# AUDIT: fail loudly in prod if SECRET_KEY missing
if not DEBUG and SECRET_KEY == 'dev-only-change-me':
    raise RuntimeError(
        'SECRET_KEY must be set via environment variable in production. '
        'Refusing to start with the development default.'
    )

PERFORMANCE_LOGGING = os.getenv('PERFORMANCE_LOGGING', 'false').lower() in {'1', 'true', 'yes', 'on'}
REDIS_URL = os.getenv('REDIS_URL', '').strip()
PUBLIC_CANONICAL_HOST = os.getenv('PUBLIC_CANONICAL_HOST', 'www.mcqcampus.com').strip().lower()
PUBLIC_CANONICAL_ORIGIN = 'https://' + PUBLIC_CANONICAL_HOST
ALLOWED_HOSTS = [x.strip() for x in os.getenv('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',') if x.strip()]

# AUDIT: auto-add canonical origin so AJAX POSTs from the public site don't 403 on CSRF
CSRF_TRUSTED_ORIGINS = [x.strip() for x in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if x.strip()]
if not DEBUG and PUBLIC_CANONICAL_ORIGIN not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(PUBLIC_CANONICAL_ORIGIN)

INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'core',
]

# AUDIT: WhiteNoise docs -> place immediately after SecurityMiddleware
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'core.middleware.CanonicalHostRedirectMiddleware',
    'core.middleware.PerformanceTimingMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.LoginWallMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'mcqcampus.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    # AUDIT: keep templates separate from static so index.html is NOT publicly served
    'DIRS': [BASE_DIR / 'frontend'],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
        'core.context_processors.mcqcampus_asset_version',
    ]},
}]
WSGI_APPLICATION = 'mcqcampus.wsgi.application'
ASGI_APPLICATION = 'mcqcampus.asgi.application'


def _db():
    url = os.getenv('DATABASE_URL', '').strip()
    if not url:
        # AUDIT: silent SQLite fallback in prod is dangerous (ephemeral storage => data loss)
        if not DEBUG:
            raise RuntimeError(
                'DATABASE_URL is required in production. Refusing to fall back to SQLite.'
            )
        return {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}
    cfg = dj_database_url.parse(url, conn_max_age=0, ssl_require=True)
    cfg.setdefault('OPTIONS', {})['prepare_threshold'] = None
    return cfg


DATABASES = {'default': _db()}

if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
            'TIMEOUT': 300,
            'KEY_PREFIX': 'mcqcampus',
            'OPTIONS': {
                'socket_connect_timeout': 0.2,
                'socket_timeout': 0.2,
                'health_check_interval': 30,
            },
        },
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'mcqcampus-local-cache',
            'TIMEOUT': 300,
            'OPTIONS': {'MAX_ENTRIES': 1000},
        },
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Karachi'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/assets/'
STATICFILES_DIRS = [BASE_DIR / 'frontend' / 'assets', BASE_DIR / 'frontend']
STATIC_ROOT = BASE_DIR / 'staticfiles'
WHITENOISE_MAX_AGE = 31536000
# AUDIT: use manifest storage so admin/third-party statics also get content-hashed URLs
STORAGES = {'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'}}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# AUDIT: removed MIGRATION_MODULES={'core': None}. Run `makemigrations core` and commit
# the migration files, then apply with `migrate core --fake-initial` on the existing prod DB.

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = False if DEBUG else True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 0 if DEBUG else 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
# AUDIT: preload is aggressive for a new site -- enable manually once stable
SECURE_HSTS_PRELOAD = False
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
SESSION_COOKIE_AGE = 60 * 60 * 2

if os.getenv('EMAIL_HOST'):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.getenv('EMAIL_HOST')
    EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
    EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'true').lower() in {'1', 'true', 'yes', 'on'}
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@mcqcampus.local')

EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES = int(os.getenv('EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES', '10'))
EMAIL_VERIFICATION_RESEND_SECONDS = int(os.getenv('EMAIL_VERIFICATION_RESEND_SECONDS', '60'))
EMAIL_VERIFICATION_MAX_ATTEMPTS = int(os.getenv('EMAIL_VERIFICATION_MAX_ATTEMPTS', '5'))
PASSWORD_RESET_CODE_EXPIRY_MINUTES = int(os.getenv('PASSWORD_RESET_CODE_EXPIRY_MINUTES', '10'))
PASSWORD_RESET_MAX_ATTEMPTS = int(os.getenv('PASSWORD_RESET_MAX_ATTEMPTS', '5'))
AUTH_RATE_LIMIT_ENABLED = os.getenv('AUTH_RATE_LIMIT_ENABLED', 'true').lower() in {'1', 'true', 'yes', 'on'}

# AUDIT: no logging config meant 500 errors disappeared into stderr in prod
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name} {process:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'core': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
