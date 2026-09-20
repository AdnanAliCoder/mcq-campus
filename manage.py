#!/usr/bin/env python
import os, sys
from pathlib import Path
import base64, zipfile, io

def prepare_deploy_bundle():
    base = Path(__file__).resolve().parent
    bundle = base / 'deploy-bundle'
    marker = base / '.full-ui-restored'
    if marker.exists() or not bundle.exists():
        return
    parts = []
    for name in ['part-00.b64','part-01.b64','part-02.b64','rest.b64']:
        p = bundle / name
        if not p.exists():
            return
        parts.append(p.read_text(encoding='utf-8').strip())
    raw = base64.b64decode(''.join(parts))
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        zf.extractall(base)
    marker.write_text('ok', encoding='utf-8')

if __name__ == '__main__':
    prepare_deploy_bundle()
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mcqcampus.settings')
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)
