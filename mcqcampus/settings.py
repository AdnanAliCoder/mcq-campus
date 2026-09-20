import os
from pathlib import Path
import dj_database_url
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.getenv('DEBUG', 'false').lower() in {'1','true','yes','on'}
SECRET_KEY = os.getenv('SECRET_KEY', '').strip()
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured('Set SECRET_KEY before starting with DEBUG=false.')
    SECRET_KEY = 'dev-only-change-me'
if not DEBUG and (len(SECRET_KEY) < 50 or SECRET_KEY.startswith(('dev-only-', 'change-me-'))):
    raise ImproperlyConfigured('Production SECRET_KEY must be a strong random value of at least 50 characters.')
ALLOWED_HOSTS = [x.strip() for x in os.getenv('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',') if x.strip()]
render_host = os.getenv('RENDER_EXTERNAL_HOSTNAME')
if render_host and render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_host)
CSRF_TRUSTED_ORIGINS = [x.strip() for x in os.getenv('CSRF_TRUSTED_ORIGINS','').split(',') if x.strip()]
if render_host:
    CSRF_TRUSTED_ORIGINS.append(f'https://{render_host}')

INSTALLED_APPS = [
    'django.contrib.admin','django.contrib.auth','django.contrib.contenttypes',
    'django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles','core',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF='mcqcampus.urls'
TEMPLATES=[{
    'BACKEND':'django.template.backends.django.DjangoTemplates',
    'DIRS':[BASE_DIR/'templates'],
    'APP_DIRS':True,
    'OPTIONS':{'context_processors':[
        'django.template.context_processors.request','django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION='mcqcampus.wsgi.application'
ASGI_APPLICATION='mcqcampus.asgi.application'

def _db():
    url=os.getenv('DATABASE_URL','').strip()
    if not url:
        if not DEBUG:
            raise ImproperlyConfigured('Set DATABASE_URL to PostgreSQL; production cannot use temporary SQLite storage.')
        return {'ENGINE':'django.db.backends.sqlite3','NAME':BASE_DIR/'db.sqlite3'}
    config = dj_database_url.parse(url, conn_max_age=60, conn_health_checks=True, ssl_require=True)
    if not DEBUG and config['ENGINE'] != 'django.db.backends.postgresql':
        raise ImproperlyConfigured('Production DATABASE_URL must use PostgreSQL.')
    if config['ENGINE'] == 'django.db.backends.postgresql':
        config.setdefault('OPTIONS', {})['connect_timeout'] = 10
    return config
DATABASES={'default':_db()}

AUTH_PASSWORD_VALIDATORS=[
    {'NAME':'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator','OPTIONS':{'min_length':8}},
    {'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME':'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
LANGUAGE_CODE='en-us'
TIME_ZONE='Asia/Karachi'
USE_I18N=True
USE_TZ=True
STATIC_URL='/assets/'
STATICFILES_DIRS=[BASE_DIR/'frontend'/'assets']
STATIC_ROOT=BASE_DIR/'staticfiles'
STORAGES={'staticfiles':{'BACKEND':'whitenoise.storage.CompressedStaticFilesStorage'}}
DEFAULT_AUTO_FIELD='django.db.models.BigAutoField'
MIGRATION_MODULES={'core': None}

SESSION_COOKIE_HTTPONLY=True
SESSION_COOKIE_SAMESITE='Lax'
SESSION_COOKIE_SECURE=not DEBUG
CSRF_COOKIE_SAMESITE='Lax'
CSRF_COOKIE_SECURE=not DEBUG
SECURE_SSL_REDIRECT=False if DEBUG else True
SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO','https')
SECURE_HSTS_SECONDS=0 if DEBUG else 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=not DEBUG
SECURE_HSTS_PRELOAD=not DEBUG
X_FRAME_OPTIONS='DENY'
SECURE_REFERRER_POLICY='strict-origin-when-cross-origin'
SESSION_COOKIE_AGE=60*60*2

if os.getenv('EMAIL_HOST'):
    EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST=os.getenv('EMAIL_HOST')
    EMAIL_PORT=int(os.getenv('EMAIL_PORT','587'))
    EMAIL_HOST_USER=os.getenv('EMAIL_HOST_USER','')
    EMAIL_HOST_PASSWORD=os.getenv('EMAIL_HOST_PASSWORD','')
    EMAIL_USE_TLS=os.getenv('EMAIL_USE_TLS','true').lower() in {'1','true','yes','on'}
else:
    EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL=os.getenv('DEFAULT_FROM_EMAIL','noreply@mcqcampus.local')
