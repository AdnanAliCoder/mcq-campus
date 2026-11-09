"""Compatibility namespace; the real Django app lives in backend/core/."""
from pathlib import Path

_backend_package = Path(__file__).resolve().parent.parent / "backend" / "core"
if _backend_package.is_dir():
    _backend_path = str(_backend_package)
    if _backend_path not in __path__:
        __path__.append(_backend_path)
