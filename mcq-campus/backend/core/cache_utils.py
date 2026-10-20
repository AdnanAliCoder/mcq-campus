"""Best-effort, versioned caching helpers for performance-sensitive public data.

Cache backend failures must not break application requests. Callers provide
plain Python data (dicts/lists/scalars), never request/session/user objects.
"""
import hashlib
import json
import logging
import secrets

from django.core.cache import cache

logger = logging.getLogger('mcqcampus.cache')
_MISS = object()


def cached_value(group, identity, builder, timeout=60):
    """Return a cached value, computing it normally if cache access fails or misses."""
    try:
        version = str(cache.get(f'mcqcampus:cache-version:{group}', '0'))
    except Exception:
        version = 'unavailable'
    try:
        serialized = json.dumps(identity, sort_keys=True, ensure_ascii=False, default=str, separators=(',', ':'))
        digest = hashlib.sha256(serialized.encode('utf-8')).hexdigest()[:24]
    except Exception:
        digest = hashlib.sha256(repr(identity).encode('utf-8', errors='replace')).hexdigest()[:24]
    key = f'mcqcampus:v1:{group}:{version}:{digest}'
    try:
        value = cache.get(key, _MISS)
        if value is not _MISS:
            return value
    except Exception:
        pass
    value = builder()
    try:
        cache.set(key, value, timeout=timeout)
    except Exception:
        # Redis is an optimization, not a dependency for serving the website.
        logger.debug('cache_write_failed group=%s', group, exc_info=True)
    return value


def invalidate_mcqcampus_cache(*groups):
    """Version-bust only selected cache groups after successful database writes."""
    for group in set(str(value or '').strip() for value in groups):
        if not group:
            continue
        try:
            cache.set(f'mcqcampus:cache-version:{group}', secrets.token_hex(8), timeout=None)
        except Exception:
            # The short TTL on cached entries limits staleness if Redis is unavailable.
            logger.debug('cache_invalidation_failed group=%s', group, exc_info=True)
