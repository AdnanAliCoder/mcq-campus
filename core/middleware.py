import json, logging, time
from django.conf import settings
from django.db import connection
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse

logger=logging.getLogger('mcqcampus.performance')

class CanonicalHostRedirectMiddleware:
    """Permanently redirect alternate production hosts to the configured canonical domain."""
    def __init__(self,get_response):
        self.get_response=get_response

    def __call__(self,request):
        raw_host=str(request.META.get('HTTP_HOST') or '').split(':',1)[0].strip().lower()
        source=str(getattr(settings,'VERCEL_DEFAULT_HOST','') or '').strip().lower()
        target=str(getattr(settings,'PUBLIC_CANONICAL_HOST','') or '').strip().lower()
        sibling=(target[4:] if target.startswith('www.') else 'www.'+target) if target else ''
        redirect_hosts={h for h in (source,sibling) if h and h!=target}
        if target and raw_host in redirect_hosts:
            response=HttpResponse(status=308)
            response['Location']='https://'+target+request.get_full_path()
            response['Cache-Control']='public, max-age=0, s-maxage=3600'
            return response
        return self.get_response(request)
TRACKED={
    '/api/startup':'startup',
    '/api/auth/session':'auth_session',
    '/api/profile':'profile_detail',
    '/api/public/content':'public_content',
    '/api/public/resources':'public_resources',
    '/api/public/catalog':'public_catalog',
    '/api/public/legal':'public_legal',
    '/api/auth/login':'auth_login',
    '/api/auth/switch-role':'auth_switch_role',
    '/api/auth/logout':'auth_logout',
    '/api/commands':'commands',
    '/api/bootstrap':'bootstrap',
    '/api/mcqs':'mcqs',
    '/api/learner/dashboard':'learner_dashboard',
    '/api/admin/overview':'admin_overview',
    '/api/admin/users':'admin_users',
    '/api/admin/reports':'admin_reports',
    '/api/admin/trash':'admin_trash',
    '/api/admin/logs':'admin_logs',
    '/api/admin/content':'admin_content',
}

class PerformanceTimingMiddleware:
    """Optional safe request timing around SessionMiddleware/AuthMiddleware too."""
    def __init__(self,get_response):
        self.get_response=get_response

    def __call__(self,request):
        name=TRACKED.get(request.path)
        enabled=bool(settings.DEBUG or getattr(settings,'PERFORMANCE_LOGGING',False))
        if not enabled or not name:
            return self.get_response(request)
        started=time.perf_counter()
        old_force_debug=connection.force_debug_cursor
        connection.force_debug_cursor=True
        before=len(connection.queries)
        action=''
        try:
            if request.path=='/api/commands':
                try:
                    raw=json.loads(request.body.decode('utf-8') or '{}')
                    candidate=str(raw.get('action') or '')
                    if candidate and len(candidate)<=80 and all(ch.isalnum() or ch in ':_-' for ch in candidate):
                        action=candidate
                except Exception:
                    pass
            response=self.get_response(request)
            elapsed=(time.perf_counter()-started)*1000
            recent=connection.queries[before:]
            queries=len(recent)
            db_ms=sum(float(q.get('time') or 0) for q in recent)*1000
            try: size=len(response.content or b'')
            except Exception: size=0
            if action:
                logger.info('request_timing endpoint=%s action=%s total_ms=%.1f db_ms=%.1f queries=%s bytes=%s',name,action,elapsed,db_ms,queries,size)
            else:
                logger.info('request_timing endpoint=%s total_ms=%.1f db_ms=%.1f queries=%s bytes=%s',name,elapsed,db_ms,queries,size)
            return response
        finally:
            connection.force_debug_cursor=old_force_debug


class LoginWallMiddleware:
    """Require an authenticated session for every application page and API except sign-in flows."""
    STATIC_PREFIXES=('/assets/',)
    STATIC_PATHS={'/favicon.ico','/site.webmanifest','/sw.js'}
    AUTH_API_PATHS={
        '/api/auth/session','/api/auth/login','/api/auth/register',
        '/api/auth/forgot','/api/auth/reset','/api/auth/verify',
        '/api/auth/resend-verification','/api/startup',
    }
    AUTH_PAGE_PATHS={'/login','/register','/forgot','/reset','/verify'}

    def __init__(self,get_response):
        self.get_response=get_response

    def __call__(self,request):
        path=request.path or '/'
        if path in self.STATIC_PATHS or path.startswith(self.STATIC_PREFIXES):
            return self.get_response(request)

        normalized=path.rstrip('/') or '/'
        authenticated=bool(getattr(getattr(request,'user',None),'is_authenticated',False))
        if normalized.startswith('/api/'):
            if normalized in self.AUTH_API_PATHS:
                response=self.get_response(request)
            elif not authenticated:
                response=JsonResponse({'error':'Authentication required.','loginRequired':True},status=401)
            else:
                response=self.get_response(request)
            response['Cache-Control']='private, no-store, max-age=0'
            response['Pragma']='no-cache'
            response['X-Robots-Tag']='noindex, nofollow'
            return response

        if normalized in self.AUTH_PAGE_PATHS:
            if authenticated:
                response=HttpResponseRedirect('/')
            else:
                response=self.get_response(request)
        elif not authenticated:
            response=HttpResponseRedirect('/login')
        else:
            response=self.get_response(request)

        # This site is now account-only, so authenticated HTML must not enter a shared CDN cache.
        response['Cache-Control']='private, no-store, max-age=0'
        response['Pragma']='no-cache'
        response['X-Robots-Tag']='noindex, nofollow'
        return response
