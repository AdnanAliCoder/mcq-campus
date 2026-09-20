#!/usr/bin/env bash
set -euo pipefail
python -m pip install -r requirements.txt
python manage.py check --deploy --fail-level WARNING
mkdir -p frontend/assets/css frontend/assets/js frontend/assets/images
python manage.py collectstatic --no-input
python manage.py migrate --no-input --run-syncdb
python manage.py import_seed
python manage.py ensure_superadmin
