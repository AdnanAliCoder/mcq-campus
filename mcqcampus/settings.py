import os
from pathlib import Path
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-only-change-me')
DEBUG = os.getenv('DEBUG', 'false').lower() in {'1','true','yes','on'}
PERFORMANCE_LOGGING = os.getenv('PERFORMANCE_LOGGING', 'false').lower() in {'1','true','yes','on'}
PUBLIC_CANONICAL_HOST = os.getenv('PUBLIC_CANONICAL_HOST','mcqcampus.com').strip().lower()
PUBLIC_CANONICAL_ORIGIN = 'https://' + PUBLIC_CANONICAL_HOST
VERCEL_DEFAULT_HOST = os.getenv('VERCEL_DEFAULT_HOST','mcq-campus.vercel.app').strip().lower()
ALLOWED_HOSTS = [x.strip() for x in os.getenv('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',') if x.strip()]
vercel_hosts = [os.getenv(name,'').strip() for name in ('VERCEL_URL','VERCEL_BRANCH_URL','VERCEL_PROJECT_PRODUCTION_URL')]
for host in vercel_hosts:
    if host and host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(host)
CSRF_TRUSTED_ORIGINS = [x.strip() for x in os.getenv('CSRF_TRUSTED_ORIGINS','').split(',') if x.strip()]
for host in vercel_hosts:
    origin=f'https://{host}' if host else ''
    if origin and origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(origin)

INSTALLED_APPS = [
    'django.contrib.admin','django.contrib.auth','django.contrib.contenttypes',
    'django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles','core',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'core.middleware.CanonicalHostRedirectMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'core.middleware.PerformanceTimingMiddleware',
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
        return {'ENGINE':'django.db.backends.sqlite3','NAME':BASE_DIR/'db.sqlite3'}
    # Vercel is serverless: keep Django persistent connections disabled. For Supabase,
    # use the Transaction Pooler connection string (port 6543) in DATABASE_URL.
    cfg=dj_database_url.parse(url, conn_max_age=0, ssl_require=True)
    cfg.setdefault('OPTIONS',{})['prepare_threshold']=None
    return cfg
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

EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES=int(os.getenv('EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES','10'))
EMAIL_VERIFICATION_RESEND_SECONDS=int(os.getenv('EMAIL_VERIFICATION_RESEND_SECONDS','60'))
EMAIL_VERIFICATION_MAX_ATTEMPTS=int(os.getenv('EMAIL_VERIFICATION_MAX_ATTEMPTS','5'))
PASSWORD_RESET_CODE_EXPIRY_MINUTES=int(os.getenv('PASSWORD_RESET_CODE_EXPIRY_MINUTES','10'))
PASSWORD_RESET_MAX_ATTEMPTS=int(os.getenv('PASSWORD_RESET_MAX_ATTEMPTS','5'))
AUTH_RATE_LIMIT_ENABLED=os.getenv('AUTH_RATE_LIMIT_ENABLED','true').lower() in {'1','true','yes','on'}
