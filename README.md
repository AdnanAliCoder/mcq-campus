# MCQCampus

MCQCampus is a Django-based MCQ, past-paper, organization, PDF, and exam-preparation website.

## Required application architecture

- Frontend: HTML/Django templates, CSS, Tailwind CSS utility styling when needed, and vanilla JavaScript.
- Backend: Python and Django views, services, authentication, and APIs.
- Data: Django ORM with PostgreSQL in production; SQLite can be used for local development when DATABASE_URL is empty.
- Web serving: Gunicorn behind the configured Oracle Cloud Ubuntu web-server/reverse-proxy setup.
- Static assets: local files under frontend/assets, served through Django/WhiteNoise and versioned URLs.

Keep this architecture. Do not migrate the application to React, Vue, Angular, Next.js, Express, NestJS, or a separate Node.js backend. Do not introduce TypeScript, PHP, Go, or another application language/framework. If Tailwind CSS is used, compile the resulting CSS to static assets served by Django; do not make a production page depend on a development CDN. The existing JavaScript regression checks are test tooling only and do not run the website backend.

## Local development

Use Python 3.11 or another Python version supported by the installed Django dependencies.

Windows CMD:

    py -m venv .venv
    .venv\Scripts\activate
    python -m pip install -r requirements.txt
    python manage.py check
    python manage.py runserver

Linux/macOS:

    python3 -m venv .venv
    source .venv/bin/activate
    python -m pip install -r requirements.txt
    python manage.py check
    python manage.py runserver

For local development, leave DATABASE_URL unset to use the local SQLite database. Never run database reset, seed, or destructive initialization commands against production data. The repository's JavaScript regression checks can be run separately with npm test when Node.js is available; Node.js is not the website's server runtime.

## Configuration

Copy .env.example to .env for local configuration. Never commit .env or real credentials.

Important environment variables:

- SECRET_KEY: strong, private Django secret.
- DEBUG: keep false on the public server.
- ALLOWED_HOSTS: include mcqcampus.com and www.mcqcampus.com.
- CSRF_TRUSTED_ORIGINS: include the HTTPS origins serving the site.
- DATABASE_URL: production PostgreSQL URL. Leave empty locally if you want SQLite.
- REDIS_URL: optional shared cache URL, such as redis://127.0.0.1:6379/1 on the Oracle VM.
- PUBLIC_CANONICAL_HOST: normally www.mcqcampus.com.
- EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS, DEFAULT_FROM_EMAIL: configure email verification and password-reset delivery.
- MCQCAMPUS_GEOLOOKUP_ENABLED: optional fallback visitor-country lookup control.

The sample environment file contains placeholders only. Do not replace production credentials or service settings with the example values.

## Production deployment — Oracle Cloud

The production application runs on the Oracle Cloud Ubuntu VM as the Django/Gunicorn systemd service mcqcampus.service. The project directory is /home/ubuntu/mcq-campus.

After reviewing and merging an approved code change, the normal deployment sequence on the VM is:

    cd /home/ubuntu/mcq-campus
    git pull origin main
    source .venv/bin/activate
    python -m pip install -r requirements.txt
    python manage.py check
    python manage.py migrate
    python manage.py collectstatic --noinput
    sudo systemctl restart mcqcampus
    sudo systemctl status mcqcampus --no-pager

Only run migrations when appropriate for the reviewed change. Back up the production database before any schema or data migration. Do not run these commands against production from a developer laptop unless that is explicitly intended.

The application is served by Django/Gunicorn and the Oracle VM web-server configuration. Keep environment secrets on the server in its protected environment file, not in the repository. This repository should not contain hosting-provider deployment configuration files for other platforms.

## Cache and performance

Redis is optional. When REDIS_URL is configured, the application uses Django's Redis cache backend; otherwise, it uses local-memory cache. Cache failures should not prevent ordinary database-backed requests from working. Public catalog/count caches use short TTLs and version invalidation; private account/session responses must not be shared-cache responses.

For short-term diagnostics, set PERFORMANCE_LOGGING=true in the server environment and restart the service. Logs should contain safe endpoint timing/query/response-size information only, never passwords, cookies, session/CSRF tokens, submitted form values, or database credentials. Disable diagnostics when they are no longer needed.

Static URLs use content-derived version tokens, so browser caching can remain long-lived while changed assets receive new URLs. Keep local images optimized, defer non-critical scripts, and lazy-load below-the-fold images without changing public URL structures or exam content.

## Public country routing

Visitor country detection first checks supported Cloudflare or CloudFront country headers. If no trusted country header is present, the application can use the configured short-timeout IP lookup fallback. Only a country code is cached under a one-way hash of the visitor IP; the raw IP is not stored as the cache value. If detection fails or the detected country is disabled, the configured site country and then Pakistan are safe fallbacks.

## Data and account safety

The existing database remains the source of truth for users, MCQs, organizations/boards/agencies, past papers, years, PDFs, blogs, settings, and permissions. Do not add demo accounts, replace production records, reset the database, or run destructive import commands as part of normal deployment. The ensure_superadmin maintenance command can create/update an owner or reset that account's password; only run it deliberately.

## Verification

Before merging code changes, run the Django system check and regression tests:

    python manage.py check
    python manage.py test

Where Node.js is available, also run:

    npm test

Review the GitHub Actions result on the pull request. Passing automated checks is not a substitute for verifying login/signup, country selection, MCQs, past papers, admin actions, PDFs, and static assets on the intended Oracle-hosted environment before production release.
