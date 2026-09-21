# MCQ Campus — Django, Supabase and Vercel ready

This project combines the complete MCQ Campus frontend with the existing Django authentication/API layer and Supabase PostgreSQL database connection.

## Included

- Complete responsive MCQ Campus frontend supplied as the reference version
- Public home, categories, papers, jobs, job years, MCQs, search, posts and guides
- Protected learner, admin and super-admin workspaces
- Django session authentication, CSRF protection and server-enforced permissions
- Existing Supabase PostgreSQL data through `DATABASE_URL`
- Learner progress, bookmarks, saved papers and reports
- Admin MCQ, taxonomy, paper/job/year, user and content management
- Vercel-compatible Django project structure
- Render configuration retained as an optional alternative

## Environment variables

Set these in Vercel Project Settings → Environment Variables:

- `DATABASE_URL` — Supabase session-pooler PostgreSQL URL
- `SECRET_KEY` — long random Django secret
- `DEBUG` — `false`
- `SUPERADMIN_EMAIL` — existing owner email (used only by the management command)
- `SUPERADMIN_PASSWORD` — owner password (used only by the management command)
- `SUPERADMIN_NAME` — optional display name
- `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` — only needed for a custom domain; Vercel-provided domains are detected automatically

Never place the Supabase service-role key or database password in frontend JavaScript. This frontend uses same-origin Django endpoints; the database connection remains server-side.

## Vercel deployment

Push the project root to the connected GitHub repository. Vercel detects `manage.py`, reads `requirements.txt`, resolves the Django WSGI application and deploys it with the Python runtime. Do not use a frontend-only output directory and do not add a base64 restoration step.

For an already-populated Supabase database, deployment does not delete or replace records. If the database schema has never been initialized, run the documented Django setup commands once from a trusted environment before public use.

## Current Jobs schema rollout

The existing `core` app predates Django migration files, so this feature deliberately does **not** add a partial initial migration that could put an already-populated production database into an unsafe migration state.

The Current Jobs schema is initialized automatically on the first authorized Job save. If you prefer to create it explicitly before editors begin using the feature, run:

```bash
python manage.py ensure_job_openings_schema
```

The command and first-save initializer only create missing Current Jobs tables and relationship tables. They do not reset, delete, rename, or rewrite existing MCQs, categories, papers, past-paper jobs, guides, Blog posts, users, or admin data. The command is safe to run again; when the schema already exists it makes no changes.

## Local verification

```bash
python -m pip install -r requirements.txt
python manage.py check
python manage.py migrate --run-syncdb
python manage.py import_seed
npm test
python manage.py runserver
```

Open `http://127.0.0.1:8000/`. Public pages work without signing in. Learner, admin and super-admin routes require an authenticated account with the matching database role.

## Data protection

- No database tables or records are deleted during frontend integration.
- Public API responses contain only approved MCQs and published content.
- Pending/rejected MCQs, users, logs and administrative data remain role-protected.
- Demo and super-admin credentials remain in the database/environment and are not embedded in frontend files.
