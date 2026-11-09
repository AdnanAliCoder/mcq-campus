# MCQCampus — single-document frontend, Django API backend

## Frontend structure

- `frontend/index.html` is the single HTML entry document. It includes the reusable header/footer/layout component templates and hard-coded page shells for home, MCQs, categories, past papers, tests, PDFs, blog, jobs, authentication, learner dashboard, admin, super-admin, about and contact.
- `frontend/style.css` is the one first-party stylesheet for the site.
- `frontend/script.js` is the unified browser runtime. It preserves the existing vanilla-JavaScript routes and interactions, calls Django APIs for data and account operations, and uses the HTML templates in `index.html` for reusable markup. API-backed lists and some route content are still populated by the runtime; the HTML shells are not a server-side Django template system.
- `frontend/assets/` contains images, icons and the web assets that are not the main CSS/JavaScript entry files.

Django remains separate: it serves JSON endpoints under `/api/` and crawler endpoints such as robots and sitemap. It does not serve the frontend HTML routes. The database models, authentication/session and CSRF handling, permissions and API contracts remain in the backend.

## Checks

Run these from the repository root:

```sh
node --check frontend/script.js
node scripts/check-static-frontend.cjs
node scripts/check-bundled-modules.cjs
python manage.py check
python manage.py test
```

The validation workflow runs the same checks. It intentionally validates the current unified files rather than looking for deleted per-page JavaScript/CSS files.

## Oracle deployment

GitHub changes do not deploy themselves. Before deployment, back up the current Nginx site configuration and review `deploy/nginx/mcqcampus-frontend-locations.conf`. This file is an include snippet, not a full TLS virtual host: include it inside the existing HTTPS server block while preserving TLS and `server_name`. It maps `/assets/style.css` and `/assets/script.js` to the unified entry files, maps other `/assets/` requests to `frontend/assets/`, and proxies `/api/` to Django.

After a reviewed change is pulled on Oracle, run Django checks/tests, run `sudo nginx -t`, and test direct/deep routes, login/signup, authenticated APIs, CSS/JavaScript, favicon, robots and sitemap before reloading Nginx. No production deployment or Nginx reload is performed by these repository checks.
