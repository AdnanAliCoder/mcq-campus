#!/usr/bin/env bash
set -o errexit
pip install -r requirements.txt
mkdir -p frontend/assets/css frontend/assets/js frontend/assets/images
python manage.py collectstatic --no-input
python manage.py migrate --no-input --run-syncdb
python manage.py import_seed
python manage.py ensure_superadmin
