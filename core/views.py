import json, re, base64, io, mimetypes, zipfile
from functools import lru_cache
from datetime import timedelta
from django.contrib.auth import authenticate, login, logout
from django.core.mail import send_mail
from django.http import JsonResponse, HttpResponse, FileResponse, Http404
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from .models import *
from .serializers import user_dict
from .services import snapshot, command, create_token, consume_token

def payload(request):
    try: return json.loads(request.body.decode('utf-8') or '{}')
    except Exception: return {}
def err(message,status=400,fields=None): return JsonResponse({'message':str(message),**({'fields':fields} if fields else {})},status=status)
def login_required_json(fn):
    def inner(request,*a,**kw):
        if not request.user.is_authenticated: return err('Your session has ended. Please sign in again.',401)
        return fn(request,*a,**kw)
    return inner

@ensure_csrf_cookie
@require_GET
def auth_session(request):
    user=user_dict(request.user,request.session) if request.user.is_authenticated else None
    if user and request.session.get_expiry_date(): user['expiresAt']=request.session.get_expiry_date().isoformat()
    return JsonResponse({'user':user,'csrfToken':get_token(request)})

@require_POST
def auth_login(request):
    d=payload(request); email=str(d.get('email') or '').strip().lower(); password=str(d.get('password') or '')
    user=authenticate(request,username=email,password=password)
    if not user or not user.is_active: return err('Email or password is incorrect.',422)
    login(request,user); role=user_role(user); request.session['active_role']='super-admin' if role=='super-admin' else 'admin' if role=='admin' else 'user'; request.session.set_expiry(60*60*24*30 if d.get('remember') else 60*60*2)
    out=user_dict(user,request.session); out['expiresAt']=request.session.get_expiry_date().isoformat()
    return JsonResponse({'user':out,'csrfToken':get_token(request)})

@require_POST
def auth_register(request):
    d=payload(request); name=str(d.get('name') or '').strip(); email=str(d.get('email') or '').strip().lower(); password=str(d.get('password') or '')
    if not d.get('terms'): return err('Accept the terms and privacy information.',422,{'terms':'Required.'})
    if '@' not in email or len(password)<8: return err('Check your email and password.',422)
    if User.objects.filter(email=email).exists(): return JsonResponse({'completed':True,'message':'If this email can be registered, further instructions will be sent.'})
    u=User.objects.create_user(username=email,email=email,password=password,first_name=name); prof=profile_for(u); prof.role='user'; prof.email_verified=False; prof.save()
    raw=create_token(u,'verify',60*24); link=request.build_absolute_uri('/#/verify?token='+raw); send_mail('Verify your MCQ Campus email',f'Open this link to verify your account: {link}',None,[email],fail_silently=True)
    return JsonResponse({'completed':True,'message':'Account created. Check your email for the verification link.'})

@require_POST
def auth_forgot(request):
    email=str(payload(request).get('email') or '').strip().lower(); u=User.objects.filter(email=email,is_active=True).first()
    if u:
        raw=create_token(u,'reset',30); link=request.build_absolute_uri('/#/reset?token='+raw); send_mail('Reset your MCQ Campus password',f'Open this link to reset your password: {link}',None,[email],fail_silently=True)
    return JsonResponse({'completed':True,'message':'If an active account matches that email, a reset link has been sent.'})

@require_POST
def auth_reset(request):
    d=payload(request); u=consume_token(d.get('token'),'reset')
    if not u: return err('This password reset link is invalid or expired.',422)
    p=str(d.get('password') or ''); c=str(d.get('confirm') or '')
    if len(p)<8 or p!=c: return err('Passwords do not match or are too short.',422)
    u.set_password(p); u.save(); return JsonResponse({'completed':True,'message':'Password updated. You can now sign in.'})

@require_POST
def auth_verify(request):
    u=consume_token(payload(request).get('token'),'verify')
    if not u: return err('This verification link is invalid or expired.',422)
    prof=profile_for(u); prof.email_verified=True; prof.save(update_fields=['email_verified']); return JsonResponse({'completed':True,'message':'Email verified. You can now sign in.'})

@require_POST
def auth_resend_verification(request):
    email=str(payload(request).get('email') or '').strip().lower(); u=User.objects.filter(email=email,is_active=True,profile__email_verified=False).first()
    if u:
        raw=create_token(u,'verify',60*24); link=request.build_absolute_uri('/#/verify?token='+raw); send_mail('Verify your MCQ Campus email',f'Open this link to verify your account: {link}',None,[email],fail_silently=True)
    return JsonResponse({'completed':True,'message':'If verification is needed, a new email has been sent.'})

@require_POST
def auth_logout(request): logout(request); return JsonResponse({'completed':True})

@require_GET
@login_required_json
def bootstrap(request): return JsonResponse(snapshot(request.user),safe=True)

@require_POST
@login_required_json
def commands(request):
    d=payload(request); action=d.get('action'); p=d.get('payload') or {}
    try:
        result=command(request.user,action,p)
        return JsonResponse({'result':result,'snapshot':snapshot(request.user),'user':user_dict(request.user,request.session)})
    except PermissionError as e: return err(e,403)
    except (ValueError,KeyError,TypeError) as e: return err(e,422)
    except Exception as e:
        if e.__class__.__name__ in {'DoesNotExist','IntegrityError'}: return err('The requested record could not be updated.',422)
        raise

@lru_cache(maxsize=1)
def _frontend_bundle():
    """Load the checked-in full frontend ZIP into memory as a deployment fallback."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    parts = [
        root / 'deploy-bundle' / 'part-00.b64',
        root / 'deploy-bundle' / 'part-01.b64',
        root / 'deploy-bundle' / 'part-02.b64',
        root / 'deploy-bundle' / 'rest.b64',
    ]
    if not all(p.exists() for p in parts):
        return None
    try:
        encoded = ''.join(p.read_text(encoding='utf-8').strip() for p in parts)
        encoded += '=' * (-len(encoded) % 4)
        raw = base64.b64decode(encoded)
        return raw
    except Exception:
        return None

def _frontend_file_bytes(relative_path):
    raw = _frontend_bundle()
    if raw is None:
        return None
    name = 'frontend/' + str(relative_path).lstrip('/').replace('\\', '/')
    if '..' in name.split('/'):
        return None
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            return zf.read(name)
    except (KeyError, zipfile.BadZipFile):
        return None

def frontend_asset(request, path):
    """Serve restored frontend assets even on hosts that skip build.sh (e.g. some Vercel setups)."""
    from pathlib import Path
    local = Path(__file__).resolve().parents[1] / 'frontend' / 'assets' / path
    if local.exists() and local.is_file():
        data = local.read_bytes()
    else:
        data = _frontend_file_bytes('assets/' + path)
    if data is None:
        raise Http404
    content_type = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    response = HttpResponse(data, content_type=content_type)
    response['Cache-Control'] = 'public, max-age=3600'
    return response

def spa_index(request):
    # Serve the restored full frontend rather than the temporary compact
    # Django template shell. A <base> tag keeps relative asset URLs correct
    # even when Django's SPA catch-all handles a nested browser path.
    from pathlib import Path
    path = Path(__file__).resolve().parents[1] / 'frontend' / 'index.html'
    if path.exists():
        html = path.read_text(encoding='utf-8')
    else:
        bundled = _frontend_file_bytes('index.html')
        if bundled is None:
            raise Http404('Frontend is not available.')
        html = bundled.decode('utf-8')
    if '<base ' not in html.lower():
        html = re.sub(r'<head>', '<head><base href="/">', html, count=1, flags=re.I)

    # The public shell must still render before database migrations/seeding
    # have completed on a fresh serverless deployment.
    inject = []
    try:
        s = SiteSetting.get_solo()
    except Exception:
        s = None

    if s is not None and getattr(s, 'analytics_enabled', False) and getattr(s, 'google_analytics_id', ''):
        ga = str(s.google_analytics_id).strip()
        if ga:
            safe_ga = json.dumps(ga)
            inject.append(
                f'<script async src="https://www.googletagmanager.com/gtag/js?id={ga}"></script>'
                f'<script>window.dataLayer=window.dataLayer||[];'
                f'function gtag(){{dataLayer.push(arguments)}};'
                f'gtag("js",new Date());gtag("config",{safe_ga});</script>'
            )
    if s is not None and getattr(s, 'adsense_enabled', False) and getattr(s, 'adsense_client_id', ''):
        adsense = str(s.adsense_client_id).strip()
        if adsense:
            inject.append(
                f'<script async crossorigin="anonymous" '
                f'src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={adsense}"></script>'
            )
    if inject:
        html = re.sub(r'</head>', ''.join(inject) + '</head>', html, count=1, flags=re.I)

    return HttpResponse(html, content_type='text/html; charset=utf-8')

def root_static_file(request, filename):
    allowed={'sitemap-index.xml','sitemap-pages.xml','sitemap-categories.xml','sitemap-papers.xml','sitemap-mcqs.xml','sitemap-resources.xml','sitemap-template.xml','routing-manifest.json'}
    if filename not in allowed: raise Http404
    from pathlib import Path
    path=Path(__file__).resolve().parents[1]/'frontend'/filename
    if not path.exists(): raise Http404
    content_type='application/xml' if filename.endswith('.xml') else 'application/json'
    return FileResponse(open(path,'rb'),content_type=content_type)

def robots_txt(request):
    body='User-agent: *\nAllow: /\nSitemap: '+request.build_absolute_uri('/sitemap-index.xml')+'\n'; return HttpResponse(body,content_type='text/plain')
