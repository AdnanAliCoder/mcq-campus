import json, logging, re, time
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
    '/api/admin/active-country':'admin_active_country',
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
    """Protect account workspaces while keeping public exam preparation pages accessible."""
    STATIC_PREFIXES=('/assets/',)
    STATIC_PATHS={'/favicon.ico','/favicon.svg','/site.webmanifest','/sw.js'}
    PUBLIC_API_PATHS={'/api/public/content','/api/public/resources','/api/public/catalog','/api/public/legal'}
    AUTH_API_PATHS={
        '/api/auth/session','/api/auth/login','/api/auth/register','/api/auth/forgot',
        '/api/auth/reset','/api/auth/verify','/api/auth/resend-verification','/api/startup',
    }
    AUTH_PAGE_PATHS={'/login','/register','/forgot','/reset','/verify','/reset-code','/reset-password'}
    PRIVATE_PAGE_PREFIXES=('/dashboard','/admin','/super-admin','/profile')
    NOINDEX_PUBLIC_PATHS={
        '/about','/contact','/faq','/privacy','/terms','/disclaimer','/cookies',
        '/advertising','/sitemap','/login','/register','/forgot','/reset','/reset-code','/reset-password','/verify',
    }
    DISCOVERY_FILES={'/sitemap.xml','/robots.txt','/llms.txt'}

    def __init__(self,get_response):
        self.get_response=get_response

    def __call__(self,request):
        path=request.path or '/'
        normalized=path.rstrip('/') or '/'
        if path in self.STATIC_PATHS or path.startswith(self.STATIC_PREFIXES):
            return self.get_response(request)

        authenticated=bool(getattr(getattr(request,'user',None),'is_authenticated',False))
        if normalized.startswith('/api/'):
            public_api = normalized in self.PUBLIC_API_PATHS or (
                normalized == '/api/entities' and request.GET.get('scope') == 'public'
            )
            if normalized in self.AUTH_API_PATHS or public_api:
                response=self.get_response(request)
            elif not authenticated:
                response=JsonResponse({'error':'Authentication required.','loginRequired':True},status=401)
            else:
                response=self.get_response(request)
            response['Cache-Control']='private, no-store, max-age=0'
            response['Pragma']='no-cache'
            response['X-Robots-Tag']='noindex, nofollow'
            return response

        is_private=any(normalized==prefix or normalized.startswith(prefix+'/') for prefix in self.PRIVATE_PAGE_PREFIXES)
        if is_private and not authenticated:
            response=HttpResponseRedirect('/login')
            response['Cache-Control']='private, no-store, max-age=0'
            response['Pragma']='no-cache'
            response['X-Robots-Tag']='noindex, nofollow'
            return response

        response=HttpResponseRedirect('/') if normalized in self.AUTH_PAGE_PATHS and authenticated else self.get_response(request)
        if normalized in self.NOINDEX_PUBLIC_PATHS or is_private or response.status_code>=400:
            response['X-Robots-Tag']='noindex, nofollow'
            if is_private or normalized in self.AUTH_PAGE_PATHS:
                response['Cache-Control']='private, no-store, max-age=0'
                response['Pragma']='no-cache'
            else:
                response['Cache-Control']='public, max-age=300, s-maxage=3600'
                response['Pragma']=''
        elif normalized not in self.DISCOVERY_FILES and 'X-Robots-Tag' in response:
            del response['X-Robots-Tag']
        return response
