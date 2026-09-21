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
