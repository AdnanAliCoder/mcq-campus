"""Compatibility namespace; the Django project lives in backend/mcqcampus/."""
from pathlib import Path

_backend_package = Path(__file__).resolve().parent.parent / "backend" / "mcqcampus"
if _backend_package.is_dir():
    _backend_path = str(_backend_package)
    if _backend_path not in __path__:
        __path__.append(_backend_path)
