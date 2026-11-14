#!/usr/bin/env bash
# Create missing Django tables for apps that do not yet have committed migrations.
# Safe to re-run: Django skips tables that already exist. This does NOT add or alter
# columns in existing tables; schema drift needs a real migration after inspection.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python}"

if [[ ! -f manage.py ]]; then
  echo "ERROR: manage.py was not found at $ROOT_DIR" >&2
  exit 1
fi

echo "Checking Django configuration..."
"$PYTHON_BIN" manage.py check

echo
echo "Applying committed migrations and creating missing tables for unmigrated apps..."
"$PYTHON_BIN" manage.py migrate --run-syncdb --noinput

echo
echo "Checking Django configuration again..."
"$PYTHON_BIN" manage.py check

echo
echo "Database sync completed."
echo "Restart the Django/Gunicorn service, then test the API endpoints."
echo "Note: --run-syncdb creates missing tables only; it does not repair missing columns in existing tables."
