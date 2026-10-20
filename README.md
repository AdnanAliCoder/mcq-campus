# MCQCampus — clean project package

MCQCampus is the existing Django website. This package keeps the current HTML/CSS/JavaScript frontend and Django/PostgreSQL backend without changing public URLs, API routes, database settings, authentication, SEO endpoints, or Oracle Cloud entry points.

## Project structure

```text
mcq-campus-clean/
├── frontend/
│   ├── index.html       # Standalone HTML shell + reusable HTML templates; no Django template syntax
│   ├── style.css        # Frontend styling; independent of Django
│   ├── app.js           # Vanilla JavaScript UI, routing, and API client
│   └── assets/          # Existing favicon/logo/icon assets and public assets
├── backend/
│   ├── core/            # Django models, APIs, services, middleware and tests
│   ├── mcqcampus/       # Django settings, URL routing, WSGI and ASGI
│   ├── manage.py
│   └── requirements.txt
├── core/                # Root compatibility namespace for the existing app path
├── mcqcampus/           # Root compatibility namespace for the existing project path
├── .env.example         # Placeholder configuration only; no real secrets
├── .github/workflows/   # Django CI checks
├── manage.py            # Existing root command used by local and production setup
├── requirements.txt     # Root dependency entry point
└── sw.js                # Existing service-worker endpoint
```

## Frontend and backend boundary

The frontend has three first-party entry files: `frontend/index.html`, `frontend/style.css`, and `frontend/app.js`.

- `index.html` is plain HTML and contains reusable `<template>` structures for the shared site layout, navigation, page families, MCQ cards, authentication screens, learner dashboard, and admin workspace. It contains no Django template tags.
- `style.css` is responsible for all presentation and responsive styling.
- `app.js` is the vanilla-JavaScript frontend. It handles navigation, page data binding, form interactions, login/signup screens, and calls the Django JSON APIs.
- Django does not render the page through its template engine or inject SEO/meta values into HTML. The SPA fallback serves the same `frontend/index.html` bytes on each route; Django remains responsible for API endpoints, database access, sessions, CSRF, authentication, permissions, legacy/canonical redirects, and HTTP route status.

The browser updates page-specific title, description, canonical metadata, and JSON-LD through the JavaScript SEO module after the route data loads. This is the trade-off of a fully standalone SPA shell: page-specific SEO metadata is not present in the initial HTML response for crawlers or clients that do not execute JavaScript. The canonical/legacy redirect logic and sitemap endpoints remain on the backend.

The existing icons and favicon files remain in `frontend/assets/` with the filenames/public URLs used by the application. The CSS, JavaScript, and HTML release query token in `frontend/index.html` should be updated when frontend assets are changed, to avoid browsers reusing cached files.

## Local run (Windows CMD)

```bat
py -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
python manage.py check
python manage.py runserver
```

For Linux/Oracle Cloud, activate the project's existing virtual environment and use the root `manage.py` entry point. Set the real environment variables in the server's protected environment file. Do not copy production secrets into `.env.example` or commit them.

## Oracle Cloud deployment

The existing deployment layout is preserved: project directory `/home/ubuntu/mcq-campus`, Django/Gunicorn systemd service `mcqcampus.service`, and the same root management/dependency entry points. A reviewed deployment normally runs:

```bash
cd /home/ubuntu/mcq-campus
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py check
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart mcqcampus
sudo systemctl status mcqcampus --no-pager
```

Only run migrations when needed for a reviewed schema change. Back up the production database before a migration. This ZIP has not been deployed and does not contain production environment secrets or a database dump.

## Verification

```bash
node --check frontend/app.js
python manage.py check
python manage.py test
```

The Django backend deliberately remains split into its required modules. Models, views, services, URL routing, settings and management commands cannot safely be collapsed into one or two files without risking the current database/API and production behavior.
