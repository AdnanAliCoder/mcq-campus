# MCQCampus — clean project package

MCQCampus is the existing Django website. This package keeps the current HTML/CSS/JavaScript frontend and Django/PostgreSQL backend without changing public URLs, API routes, database settings, authentication, SEO endpoints, or Oracle Cloud entry points.

## Project structure

```text
mcq-campus-clean/
├── frontend/
│   ├── index.html       # One shared semantic HTML shell and SEO fallback
│   ├── style.css        # Combined first-party stylesheet
│   ├── app.js           # Combined first-party vanilla JavaScript runtime
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

## Important frontend behavior

The public frontend has exactly three first-party entry files: `frontend/index.html`, `frontend/style.css`, and `frontend/app.js`. The HTML file is the shared semantic document shell; route-specific interactive content is rendered by the existing JavaScript runtime. This keeps the existing login/session/CSRF behavior, API integration, country selection, MCQ flows, past-paper hierarchy, admin tools and public URLs intact. The original CSS and JavaScript source modules/build tools are not included in this clean package, so edit `frontend/style.css` and `frontend/app.js` directly.

The existing icons and favicon files remain in `frontend/assets/` with the filenames/public URLs used by the application. They have not been renamed or recompressed.

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
