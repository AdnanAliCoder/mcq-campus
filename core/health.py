from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.views.decorators.http import require_safe


@require_safe
def healthz(request):
    """Read-only readiness probe; never return database errors or credentials."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1 FROM core_sitesetting LIMIT 1')
    except DatabaseError:
        response = JsonResponse({'status': 'unavailable'}, status=503)
    else:
        response = JsonResponse({'status': 'ok'})
    response['Cache-Control'] = 'no-store'
    response['X-Robots-Tag'] = 'noindex'
    return response
