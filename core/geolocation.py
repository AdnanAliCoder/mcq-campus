"""Best-effort visitor-country detection for public country-scoped pages.

Prefer country headers populated by trusted hosting/CDN proxies. If none is
available, use a short-timeout IP geolocation lookup and cache only the
country code, keyed by a one-way hash of the IP address.
"""
import hashlib
import ipaddress
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.core.cache import cache

_COUNTRY_CODE = re.compile(r"^[A-Z]{2}$")
_NEGATIVE_CACHE_VALUE = "ZZ"


def _trusted_header_country(request):
    # These headers are supplied/overwritten by common hosting/CDN proxies.
    for key in (
        "HTTP_CF_IPCOUNTRY",
        "HTTP_X_VERCEL_IP_COUNTRY",
        "HTTP_CLOUDFRONT_VIEWER_COUNTRY",
    ):
        value = str(request.META.get(key) or "").strip().upper()
        if _COUNTRY_CODE.fullmatch(value) and value not in {"XX", "ZZ", "T1"}:
            return value
    return ""


def _client_public_ip(request):
    forwarded = str(request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    remote = str(request.META.get("REMOTE_ADDR") or "").strip()
    # Reverse proxies generally put the real visitor first in X-Forwarded-For.
    # Never pass private/reserved addresses to the external lookup provider.
    for candidate in (forwarded, remote):
        if not candidate:
            continue
        try:
            address = ipaddress.ip_address(candidate)
        except ValueError:
            continue
        if address.is_global:
            return str(address)
    return ""


def _external_lookup(ip_address):
    if os.getenv("MCQCAMPUS_GEOLOOKUP_ENABLED", "true").strip().lower() in {"0", "false", "no", "off"}:
        return ""
    template = os.getenv(
        "MCQCAMPUS_GEOLOCATION_URL",
        "https://ipapi.co/{ip}/country/",
    ).strip()
    if not template or "{ip}" not in template:
        return ""
    url = template.replace("{ip}", quote(ip_address, safe=""))
    timeout = 0.6
    try:
        configured_timeout = float(os.getenv("MCQCAMPUS_GEOLOCATION_TIMEOUT", "0.6"))
        if 0.1 <= configured_timeout <= 2.0:
            timeout = configured_timeout
    except (TypeError, ValueError):
        pass
    request = Request(
        url,
        headers={
            "Accept": "text/plain",
            "User-Agent": "MCQCampus-country-routing/1.0",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read(32).decode("ascii", errors="ignore").strip().upper()
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        return ""
    return raw if _COUNTRY_CODE.fullmatch(raw) and raw not in {"XX", "ZZ", "T1"} else ""


def visitor_country_code(request):
    """Return a two-letter visitor country code, or an empty string if unknown."""
    proxy_code = _trusted_header_country(request)
    if proxy_code:
        return proxy_code

    ip_address = _client_public_ip(request)
    if not ip_address:
        return ""

    cache_key = "mcqcampus:ip-country:v1:" + hashlib.sha256(ip_address.encode("utf-8")).hexdigest()[:32]
    try:
        cached = cache.get(cache_key)
    except Exception:
        cached = None
    if isinstance(cached, str):
        return "" if cached == _NEGATIVE_CACHE_VALUE else cached

    code = _external_lookup(ip_address)
    try:
        # Negative answers are cached briefly to avoid repeated provider calls
        # when a visitor's network is not in the provider's database.
        cache.set(cache_key, code or _NEGATIVE_CACHE_VALUE, timeout=86400 if code else 900)
    except Exception:
        pass
    return code
