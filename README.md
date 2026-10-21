# MCQCampus — independent static frontend, Django API backend

`frontend/` contains physical HTML pages, a shared plain HTML component library, shared/page-specific CSS, and separate JavaScript modules. Nginx serves these files directly. Django serves JSON APIs under `/api/` and backend-generated sitemap/crawler endpoints only; it no longer has a catch-all route serving the website HTML.

The structural separation retains the existing vanilla JavaScript behavior, API contracts, auth/session/CSRF handling, database models, permissions, and public URLs. Some data-driven content and controls are still assembled by vanilla JavaScript; feature modules and reusable HTML templates are separate and editable. Continue migrating page-specific content to explicit HTML templates without breaking shared page components or API contracts.

Run `node --check frontend/js/bootstrap.js`, `node --check frontend/js/app.js`, `node scripts/check-bundled-modules.cjs`, `python manage.py check`, and `python manage.py test`.

## Oracle deployment
GitHub changes do not deploy themselves. Back up the current Nginx site configuration, include `deploy/nginx/mcqcampus-frontend-locations.conf` inside the existing HTTPS server block while preserving TLS/server_name, and replace the prior catch-all proxy. Run `sudo nginx -t` before reload, pull the reviewed commit on Oracle, run Django checks/tests, then test direct/deep routes, login/signup, authenticated APIs, favicon, robots and sitemap. This is an include snippet, not a full TLS vhost. No production deployment or Nginx reload is performed by this change.
