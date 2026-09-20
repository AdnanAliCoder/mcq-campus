#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

# Restore the complete MCQ Campus frontend from the checked-in deployment bundle.
# The bundle is split only to keep GitHub uploads manageable.
python - <<'PY'
from pathlib import Path
import base64
import io
import zipfile

root = Path(__file__).resolve().parent if '__file__' in globals() else Path.cwd()
parts = [
    root / 'deploy-bundle' / 'part-00.b64',
    root / 'deploy-bundle' / 'part-01.b64',
    root / 'deploy-bundle' / 'part-02.b64',
    root / 'deploy-bundle' / 'rest.b64',
]
missing = [str(p) for p in parts if not p.exists()]
if missing:
    raise SystemExit('Missing frontend restore bundle part(s): ' + ', '.join(missing))

encoded = ''.join(p.read_text(encoding='utf-8').strip() for p in parts)
archive = base64.b64decode(encoded, validate=True)

with zipfile.ZipFile(io.BytesIO(archive)) as zf:
    root_resolved = root.resolve()
    for member in zf.infolist():
        target = (root / member.filename).resolve()
        if root_resolved not in target.parents and target != root_resolved:
            raise SystemExit(f'Unsafe path in frontend bundle: {member.filename}')
    zf.extractall(root)

frontend_index = root / 'frontend' / 'index.html'
if not frontend_index.exists():
    raise SystemExit('Frontend restore completed but frontend/index.html is missing.')

print(f'Restored full frontend ({len(archive)} compressed bytes).')
PY

mkdir -p frontend/assets/css frontend/assets/js frontend/assets/images
python manage.py collectstatic --no-input
python manage.py migrate --no-input --run-syncdb
python manage.py import_seed
python manage.py ensure_superadmin
