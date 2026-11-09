# MCQCampus — static frontend, Django API backend

## Repository layout

- `frontend/` is a standalone static frontend. Nginx serves `index.html`, CSS, JavaScript, images, the web manifest and service worker directly.
- `backend/manage.py` is the only Django management entry point.
- `backend/config/` contains Django settings, URL configuration, ASGI and WSGI entry points.
- `backend/apps/core/` contains the existing Django app; its test modules live in `backend/apps/core/tests/`.
- `deploy/nginx/mcqcampus-frontend-locations.conf` is the Nginx include for static frontend routes and Django API/admin/crawler endpoints.

Public frontend routes do not pass through Django and are not rendered with Django templates. Nginx serves the existing static SPA and falls back to `frontend/index.html` for application routes. Django remains responsible for JSON APIs under `/api/`, the Django admin under `/admin/`, and crawler endpoints such as robots.txt and sitemap.xml. Browser-native HTML `<template>` fragments remain part of the frontend; they are not Django templates.

## Checks

Run these from the repository root:

```sh
node --check frontend/script.js
node scripts/check-static-frontend.cjs
node scripts/check-bundled-modules.cjs
python backend/manage.py check
python backend/manage.py test
```

The root `requirements.txt` aggregates `backend/requirements.txt`. The validation workflow uses the backend requirements and runs Django from `backend/manage.py`.

## Oracle deployment

GitHub changes do not deploy themselves. Back up the current Nginx site configuration and review `deploy/nginx/mcqcampus-frontend-locations.conf`. This file is an include snippet, not a full TLS virtual host: include it inside the existing HTTPS server block while preserving TLS and `server_name`.

The include maps `/assets/` to `frontend/assets/`, the unified CSS and JavaScript entry files to their existing frontend paths, `/django-static/` to Django's `STATIC_ROOT`, and `/api/`, `/admin/` plus crawler endpoints to Django. Public application routes are served by Nginx with `index.html` as the SPA fallback.

After pulling a reviewed change on the server, install `backend/requirements.txt`, run Django checks/tests and `python backend/manage.py collectstatic --noinput`, run `sudo nginx -t`, and test direct/deep frontend routes, login/signup, authenticated APIs, CSS/JavaScript, favicon, robots and sitemap before reloading Nginx. No production deployment or Nginx reload is performed by repository validation.
