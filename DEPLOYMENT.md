# MCQ Campus deployment review

Reviewed GitHub main at `3c4c0993fd9b9528ac9c5863df49ec01f3c15214` on 20 September 2026.
This branch prepares the current Django repository for Render. It does not deploy a
service, connect to the live Supabase database, or restore the older complete frontend.
The current frontend is a small login/dashboard starter.

## Free hosting choice

Use **Render Free web service + the existing Supabase Free PostgreSQL project** for
testing. The Blueprint explicitly requests `plan: free` and creates no paid database.
Check the provider's final plan summary before creating the service. Account/card
verification requirements must be checked in the signed-in account; this review
does not guarantee that Render will waive them. Do not select a paid plan to bypass
verification.

- [Render Free](https://render.com/docs/free): services sleep after 15 minutes idle,
  may take about a minute to wake, and share 750 free instance hours per workspace
  per month. Files written locally are temporary. Free Render PostgreSQL expires
  after 30 days, so keep Supabase. SMTP ports 25, 465 and 587 are blocked.
- [Supabase pricing](https://supabase.com/pricing): Free includes a 500 MB database
  and projects can pause after one week of inactivity. This is a starting tier,
  not a promise that 300,000 MCQs plus accounts, indexes and history will fit.
- [Vercel Hobby](https://vercel.com/docs/plans/hobby) is an alternative for personal,
  noncommercial tests only. [Django is now supported](https://vercel.com/docs/frameworks/full-stack/django),
  but serverless/database connection configuration would need a separate tested
  setup. This branch configures Render only. Do not use Hobby for a monetized site.

## Before a public launch

The current application has concrete launch blockers outside this deployment patch:

1. `core/services.py:snapshot` returns global statistics, MCQs of every status,
   and draft posts to signed-in accounts. Normal admins also receive global activity.
   Scope private data by authenticated ownership/role before onboarding other accounts.
2. `command` checks the broad admin role for several mutations without enforcing
   per-object ownership and the permissions catalog. Test Admin A vs Admin B through
   the actual API, including manually changed IDs, before public access.
3. The complete learner MCQ pages, slider and administration UI are absent from
   the current frontend. The current dashboard message alone does not prove a
   Supabase connection or completion of the earlier feature requests.
4. Email falls back to console output. Verification/reset messages are not delivered
   in that mode. Configure and test an email provider compatible with the host;
   signup and password-reset abuse controls also need review.
5. Core migrations are explicitly disabled in the existing project. `--run-syncdb`
   creates missing tables on an empty database; it does not update existing table
   columns. Inspect/back up an existing database and reconcile its schema before
   deployment. Introduce versioned core migrations as a separate audited change.
6. Verify Supabase API exposure: Django tables containing account/session/token data
   must not be readable through Supabase's public Data API. Inspect actual schema
   grants/RLS or keep backend tables in an unexposed schema. The live DB was not accessible
   for this review. See [Supabase database access](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Render setup after the launch blockers are resolved

1. In Render, use **New > Blueprint** and select `AdnanAliCoder/mcq-campus` and the
   reviewed branch/commit. The repository root contains `render.yaml`. Confirm
   the instance type is **Free**. If a service already exists, update it rather
   than creating a duplicate; verify its environment and plan manually.
2. Set secret values in Render's environment form, never in GitHub or chat:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Supabase Connect > Session pooler URI, using port 5432 and the actual database password |
   | `SECRET_KEY` | Strong random Django key of at least 50 characters; keep it stable across redeploys |
   | `SUPERADMIN_EMAIL` | Owner email for first account creation |
   | `SUPERADMIN_PASSWORD` | Unique password of at least 12 characters for first creation |
   | `SUPERADMIN_NAME` | Owner display name |
   | `DEBUG` | `false` (already in Blueprint) |

   To generate a Django secret locally after installing dependencies, use
   `python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'`
   and paste it directly into Render. The Blueprint asks for this value because
   Render's default generated secret is shorter than Django's 50-character check.

   Copy the complete [Session pooler URI from Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).
   The username includes the project reference. Percent-encode reserved characters
   in the password. Do not use the public project URL, anon key, service-role key,
   or transaction pooler port 6543 as a substitute. Database SSL is required.
3. For the Render URL, Django automatically trusts `RENDER_EXTERNAL_HOSTNAME` and
   its HTTPS origin. For a custom domain, also set comma-separated `ALLOWED_HOSTS`
   and `CSRF_TRUSTED_ORIGINS` with the exact hostnames and HTTPS origins.
4. Build command is `bash build.sh`; start command and `$PORT` binding are in the
   Blueprint. The build checks deployment settings, collects static files, runs
   the existing schema initialization, optionally imports the existing bundled
   seed if present, and initializes the owner once. No seed file exists in this
   revision, so no MCQ data will be imported automatically.
5. Owner initialization preserves an existing active owner's changed password and
   profile. An email conflict with a non-owner fails without promoting that account.
   After confirming owner login, remove `SUPERADMIN_PASSWORD` from the service's
   environment; later builds skip owner initialization when credentials are absent.
6. Verify HTTPS `/healthz` returns `200` and `{"status":"ok"}`, static files load,
   login/logout works, and data persists after a redeploy. The health check reads a
   core table and returns generic `503` on a database failure; it does not certify
   every table/column, role permission or email workflow.

Builds currently write schema/initial owner data because that is the repository's
existing deployment approach. Do not point preview builds at the production database.
No schema changes or live database writes were made by this review.

## Local verification

Use an isolated virtual environment. The app reads process environment variables;
it does not automatically load `.env` files.

```bash
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
DEBUG=true DATABASE_URL= .venv/bin/python manage.py test core.test_deployment
```

Tests use Django's disposable local SQLite test database and mock a database outage.
They cover readiness/HTTPS proxy behavior, production configuration failures,
and owner creation/redeployment conflicts. These tests do not establish PostgreSQL
connectivity, fix data isolation, or constitute acceptance tests for the earlier UI
and SEO requests. Run the live checks above after provider access is available.
