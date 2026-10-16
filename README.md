# MCQCampus — Vercel + Supabase Deployment Package

This package combines the final animated MCQCampus frontend with the existing Django backend. It is prepared for **Vercel** deployment and the existing **Supabase PostgreSQL** database.

## What is included

- Final HTML/CSS/JavaScript frontend with animations and transitions.
- Django API, authentication, admin permissions and existing database models.
- Supabase/PostgreSQL connection through `DATABASE_URL`.
- Vercel Django configuration in `vercel.json` (no Render build file is included).
- Same-origin session authentication for Learner, Admin and Super Admin accounts stored in the database.
- Asset-free CSS loading UI: compact button spinners for normal writes and a minimal blocking overlay only for session verification / bulk import.
- Server-backed settings for footer, social links, legal pages, PDFs, Latest Jobs, ads/analytics and profile preferences without requiring a new database schema.

## Intentionally removed

- Previous/obsolete frontend files.
- Demo accounts, demo adapters and demo seed data.
- Seed-import tooling and bundled sample-data folders.
- Render deployment configuration.
- Private `.env` credentials.

The package does **not** delete or replace any records already stored in Supabase. Existing database users, including an existing Super Admin, remain the source of truth for login.

## Environment variables on Vercel

Set these in **Vercel Project → Settings → Environment Variables**. Never commit the real values to Git.

```text
SECRET_KEY=<long random Django secret>
DEBUG=false
DATABASE_URL=<your Supabase Transaction Pooler connection string, port 6543>
ALLOWED_HOSTS=<your custom domain if used>
CSRF_TRUSTED_ORIGINS=https://<your-custom-domain>
```

Vercel's runtime host variables are also accepted automatically by `mcqcampus/settings.py`, so preview and production `*.vercel.app` hosts can be recognized without adding Render-specific settings.

For Vercel, use Supabase **Connect → Transaction pooler** (`:6543`) rather than the direct IPv6 database URL. Django persistent connections are disabled and psycopg prepared statements are disabled for transaction-pooler compatibility.

For email-based verification/password reset, configure the optional email variables shown in `.env.example`.


## Redis cache on a persistent server

On an Oracle Ubuntu VM where Redis is installed and bound to localhost, set `REDIS_URL=redis://127.0.0.1:6379/1` in the environment used by the Django service, then restart the application service. Install dependencies from `requirements.txt` after pulling the code. The app uses Django's built-in Redis cache backend when `REDIS_URL` is present and local-memory cache otherwise. Cache reads/writes are best-effort; Redis being temporarily unavailable should fall back to uncached database results. Public data/count caches use short TTLs and version invalidation after recognized successful writes. Authentication/session/private account responses are not placed in these shared cache groups.

## Public country homepage and login/signup country selection

The public homepage resolves the visitor country before loading country-scoped MCQ totals, organizations, categories and past-paper data. It prefers country codes provided by hosting/CDN proxies, including Cloudflare's CF-IPCountry header, Vercel's country header, and CloudFront's viewer-country header. When no trusted country header is present, it can perform a short-timeout IP geolocation lookup. Only the resulting country code is cached, under a one-way hash of the IP address; the raw IP is not written to application logs or stored as the cache value.

The fallback provider can be changed with MCQCAMPUS_GEOLOCATION_URL (a URL template containing {ip}), or disabled with MCQCAMPUS_GEOLOOKUP_ENABLED=false. When lookup cannot identify a country or the country is not enabled in Country Management, the app uses the configured site country, then Pakistan as a safe fallback.

The homepage and public exam/PDF routes are available without an account. The country chooser is used when a visitor opens Login or Sign up without an active country choice. Anonymous route data is served through /api/public/bootstrap, which returns active country-scoped catalogs and totals without sending a full, unpaginated MCQ dataset.

## Performance diagnostics

For temporary performance investigation, set `PERFORMANCE_LOGGING=true` in the relevant Vercel environment and redeploy. The application then logs only endpoint names, elapsed milliseconds, query counts when Django exposes them, response byte sizes, and safe login phase durations. It does **not** log passwords, cookies, CSRF/session tokens, request form values, `DATABASE_URL`, or database credentials.

A Super Admin can use `GET /api/health/performance` while diagnostics are enabled to measure a simple `SELECT 1` round trip. Its response exposes only app/database milliseconds plus a coarse database backend/connection classification such as `postgresql / pooler / 6543`; it never exposes the database hostname, username, password, or connection URL.

Use Supabase **Transaction Pooler** for Vercel serverless and verify the production `DATABASE_URL` in Vercel uses the pooler connection (normally port **6543**). The repository intentionally does not read or print the secret value. Keep `conn_max_age=0` and `prepare_threshold=None` for transaction-pooler compatibility.

When diagnosing latency, compare the first request after inactivity with two immediate warm requests for `/api/auth/session`, login, role switch, logout, `form:entity`, bootstrap, and the paginated MCQ endpoint. This separates Vercel cold-start latency from persistent database/network latency.

## Existing Super Admin login

The login form authenticates against Django's database-backed user table using the account email as the username. **No demo account is created by this package.** If your Supabase database already contains the Super Admin account and its password hash, use those existing credentials.

`python manage.py ensure_superadmin` remains available only as an explicit maintenance command. It can create/update an owner from `SUPERADMIN_*` environment variables and can reset that account's password, so do not run it during routine deployment unless you intentionally want that behavior.

## Local verification

```sh
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py check
npm test
python manage.py runserver
```

If `DATABASE_URL` is omitted locally, Django uses SQLite for development/testing. Do not run database initialization commands against the existing Supabase production database unless you know a schema change is required.

## Vercel deployment

Deploy the **project root** — the folder containing `manage.py` and `vercel.json`. With Git integration, push this folder to the repository/branch connected to Vercel. Keep the Supabase connection string and Django secret only in Vercel Environment Variables.

The current deployment configuration is `vercel.json`; no Render/Railway application-server configuration is required.
