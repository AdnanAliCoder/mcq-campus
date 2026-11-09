"""Small template context helpers for cache-safe static asset URLs."""
from django.conf import settings


def mcqcampus_asset_version(request):
    """Return the content-derived version shared by local static asset URLs."""
    return {"asset_version": getattr(settings, "STATIC_ASSET_VERSION", "static-v1")}
