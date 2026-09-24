import json, re, logging, time
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.db import connection
from django.core.mail import send_mail
from django.http import JsonResponse, HttpResponse, FileResponse, Http404
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from .models import *
from .serializers import user_dict, user_identity_dict, user_profile_dict
from .services import (
    snapshot, startup_payload, public_content_data, public_resources_data, public_catalog_data, public_legal_data, command, create_token, consume_token, mcq_page,
    learner_dashboard_data, admin_overview_data, admin_users_data, admin_reports_data, admin_trash_data, admin_logs_data, admin_content_data,
)

logger=logging.getLogger('mcqcampus.performance')
def perf_enabled(): return bool(settings.DEBUG or getattr(settings,'PERFORMANCE_LOGGING',False))

def _db_diag():
    cfg=connection.settings_dict
    host=str(cfg.get('HOST') or '')
    port=str(cfg.get('PORT') or '')
    engine=str(cfg.get('ENGINE') or '')
    host_type='pooler' if 'pooler' in host.lower() or port=='6543' else ('direct' if 'postgres' in engine else 'local')
    return {'db_backend':'postgresql' if 'postgres' in engine else 'sqlite','db_host_type':host_type,'db_port':port or None}

def profile_api(name):
    def decorate(fn):
        def wrapped(request,*args,**kwargs):
            if not perf_enabled(): return fn(request,*args,**kwargs)
            start=time.perf_counter(); before=len(connection.queries)
            response=fn(request,*args,**kwargs)
            elapsed=(time.perf_counter()-start)*1000
            recent=connection.queries[before:]
            queries=len(recent)
            db_ms=sum(float(q.get('time') or 0) for q in recent)*1000
            size=len(getattr(response,'content',b'') or b'')
            logger.info('api_timing endpoint=%s total_ms=%.1f db_ms=%.1f queries=%s bytes=%s',name,elapsed,db_ms,queries,size)
            return response
        return wrapped
    return decorate

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

@profile_api('auth_login')
@require_POST
def auth_login(request):
    started=time.perf_counter()
    d=payload(request); email=str(d.get('email') or '').strip().lower(); password=str(d.get('password') or '')
    phase=time.perf_counter()
    # Existing database accounts may have a username that differs from their email.
    # Resolve by email first, then authenticate with Django's real username value.
    candidate=User.objects.select_related('profile').filter(email__iexact=email).order_by('-is_superuser','-is_staff','id').first()
    lookup_ms=(time.perf_counter()-phase)*1000
    phase=time.perf_counter()
    if candidate:
        user=candidate if candidate.check_password(password) and candidate.is_active else None
        if user:
            try: user._mcq_profile_cache=candidate.profile
            except Profile.DoesNotExist: pass
    else:
        # Preserve Django's timing-hardening behavior for unknown accounts.
        authenticate(request,username=email,password=password)
        user=None
    authenticate_ms=(time.perf_counter()-phase)*1000
    if not user or not user.is_active:
        if perf_enabled(): logger.info('login_phase email_lookup_ms=%.1f authenticate_ms=%.1f total_ms=%.1f',lookup_ms,authenticate_ms,(time.perf_counter()-started)*1000)
        return err('Email or password is incorrect.',422)
    phase=time.perf_counter()
    login(request,user)
    role=user_role(user)
    request.session['active_role']='super-admin' if role=='super-admin' else 'admin' if role=='admin' else 'user'
    request.session.set_expiry(60*60*24*30 if d.get('remember') else 60*60*2)
    session_prepare_ms=(time.perf_counter()-phase)*1000
    phase=time.perf_counter()
    out=user_dict(user,request.session); out['expiresAt']=request.session.get_expiry_date().isoformat()
    user_dict_ms=(time.perf_counter()-phase)*1000
    if perf_enabled():
        logger.info('login_phase email_lookup_ms=%.1f authenticate_ms=%.1f session_prepare_ms=%.1f user_dict_ms=%.1f total_ms=%.1f',lookup_ms,authenticate_ms,session_prepare_ms,user_dict_ms,(time.perf_counter()-started)*1000)
    return JsonResponse({'user':out,'csrfToken':get_token(request)})

@require_POST
def auth_register(request):
    d=payload(request); name=str(d.get('name') or '').strip(); email=str(d.get('email') or '').strip().lower(); password=str(d.get('password') or '')
    if not d.get('terms'): return err('Accept the terms and privacy information.',422,{'terms':'Required.'})
    if '@' not in email or len(password)<8: return err('Check your email and password.',422)
    if User.objects.filter(email=email).exists(): return JsonResponse({'completed':True,'message':'If this email can be registered, further instructions will be sent.'})
    u=User.objects.create_user(username=email,email=email,password=password,first_name=name); prof=profile_for(u); prof.role='user'; prof.country=str(d.get('country') or 'Pakistan')[:80]; prof.email_verified=False; prof.save()
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

@profile_api('auth_logout')
@require_POST
def auth_logout(request): logout(request); return JsonResponse({'completed':True})

@require_POST
def public_contact(request):
    d=payload(request); message=str(d.get('message') or '').strip()
    if not message: return err('Enter your message.',422)
    ContactMessage.objects.create(user=request.user if request.user.is_authenticated else None,name=str(d.get('name') or '').strip(),email=str(d.get('email') or '').strip(),message=message)
    return JsonResponse({'completed':True,'message':'Your message has been received.'})

@require_POST
def public_report(request):
    d=payload(request); reason=str(d.get('reason') or '').strip()
    try: mcq=MCQ.objects.get(pk=int(d.get('id') or 0),status='approved')
    except (MCQ.DoesNotExist,TypeError,ValueError): return err('Question not available.',404)
    if not reason: return err('Enter a report reason.',422)
    Report.objects.create(user=request.user if request.user.is_authenticated else None,mcq=mcq,reason=reason)
    return JsonResponse({'completed':True})

@profile_api('startup')
@require_GET
def startup(request):
    data=startup_payload(request.user,request.session)
    data['csrfToken']=get_token(request)
    if data.get('user') and request.session.get_expiry_date():
        data['user']['expiresAt']=request.session.get_expiry_date().isoformat()
    return JsonResponse(data)

@profile_api('public_content')
@require_GET
def public_content(request):
    return JsonResponse(public_content_data())

@profile_api('public_resources')
@require_GET
def public_resources(request):
    return JsonResponse(public_resources_data())

@profile_api('public_catalog')
@require_GET
def public_catalog(request):
    return JsonResponse(public_catalog_data())

@profile_api('public_legal')
@require_GET
def public_legal(request):
    return JsonResponse(public_legal_data())

@profile_api('profile_detail')
@require_GET
@login_required_json
def profile_detail(request):
    data=user_profile_dict(request.user,request.session)
    if request.session.get_expiry_date(): data['expiresAt']=request.session.get_expiry_date().isoformat()
    return JsonResponse({'user':data})

@profile_api('bootstrap')
@require_GET
def bootstrap(request): return JsonResponse(snapshot(request.user),safe=True)

@profile_api('mcqs')
@require_GET
def mcqs(request):
    try:
        page=int(request.GET.get('page') or 1); page_size=int(request.GET.get('page_size') or (50 if request.user.is_authenticated else 20))
    except (TypeError,ValueError):
        return err('Invalid pagination values.',422)
    filters={k:request.GET.get(k) for k in ['status','category','paper','job','year','search'] if request.GET.get(k)}
    return JsonResponse(mcq_page(request.user,page,page_size,filters))

@require_GET
@login_required_json
def performance_health(request):
    if not perf_enabled() or user_role(request.user)!='super-admin': return err('Not available.',404)
    started=time.perf_counter(); db_started=time.perf_counter(); ok=True
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except Exception:
        ok=False
    database_ms=(time.perf_counter()-db_started)*1000
    data={'appMs':round((time.perf_counter()-started)*1000,1),'databaseMs':round(database_ms,1),'databaseOk':ok,**_db_diag()}
    logger.info('performance_health app_ms=%.1f database_ms=%.1f database_ok=%s db_backend=%s db_host_type=%s db_port=%s',data['appMs'],data['databaseMs'],ok,data['db_backend'],data['db_host_type'],data['db_port'])
    return JsonResponse(data)

@profile_api('learner_dashboard')
@require_GET
@login_required_json
def learner_dashboard(request):
    try: return JsonResponse(learner_dashboard_data(request.user))
    except PermissionError as e: return err(e,403)

@profile_api('admin_overview')
@require_GET
@login_required_json
def admin_overview(request):
    try: return JsonResponse(admin_overview_data(request.user,request.session.get('active_role')))
    except PermissionError as e: return err(e,403)

@profile_api('admin_users')
@require_GET
@login_required_json
def admin_users(request):
    try: return JsonResponse(admin_users_data(request.user,request.GET.get('page') or 1,request.GET.get('page_size') or 50))
    except PermissionError as e: return err(e,403)
    except (TypeError,ValueError): return err('Invalid pagination values.',422)

@profile_api('admin_reports')
@require_GET
@login_required_json
def admin_reports(request):
    try: return JsonResponse(admin_reports_data(request.user,request.GET.get('page') or 1,request.GET.get('page_size') or 50))
    except PermissionError as e: return err(e,403)
    except (TypeError,ValueError): return err('Invalid pagination values.',422)

@profile_api('admin_trash')
@require_GET
@login_required_json
def admin_trash(request):
    try: return JsonResponse(admin_trash_data(request.user,request.GET.get('page') or 1,request.GET.get('page_size') or 50))
    except PermissionError as e: return err(e,403)
    except (TypeError,ValueError): return err('Invalid pagination values.',422)

@profile_api('admin_logs')
@require_GET
@login_required_json
def admin_logs(request):
    try: return JsonResponse(admin_logs_data(request.user,request.GET.get('page') or 1,request.GET.get('page_size') or 50))
    except PermissionError as e: return err(e,403)
    except (TypeError,ValueError): return err('Invalid pagination values.',422)

@profile_api('admin_content')
@require_GET
@login_required_json
def admin_content(request):
    try: return JsonResponse(admin_content_data(request.user))
    except PermissionError as e: return err(e,403)

@profile_api('auth_switch_role')
@require_POST
@login_required_json
def auth_switch_role(request):
    role=str(payload(request).get('role') or '')
    account_role=user_role(request.user)
    available=['user']+(['admin'] if account_role in {'admin','super-admin'} else [])+(['super-admin'] if account_role=='super-admin' else [])
    if role not in available: return err('This account does not have that workspace.',403)
    request.session['active_role']=role
    request.session.modified=True
    return JsonResponse({'activeRole':role,'csrfToken':get_token(request)})

@profile_api('commands')
@require_POST
@login_required_json
def commands(request):
    d=payload(request); action=d.get('action'); p=d.get('payload') or {}
    try:
        result=command(request.user,action,p)
        if action in {'changePassword','form:password-change'}:
            update_session_auth_hash(request,request.user)
        response={'success':True,'result':result}
        if action in {'saveProfile','form:profile','form:user'}: response['user']=user_dict(request.user,request.session)
        delta_actions={'attempt','toggleBookmark','savePaper','report','saveProfile','changePassword','form:profile','form:password-change','form:mcq','form:review','form:entity','form:user','form:guide','form:post','form:ad','action:report-resolve','action:user-status','action:ad-toggle','action:ad-delete','action:post-delete','action:bulk-important'}
        if action not in delta_actions: response['refresh']='bootstrap'
        return JsonResponse(response)
    except PermissionError as e: return err(e,403)
    except (ValueError,KeyError,TypeError) as e: return err(e,422)
    except Exception as e:
        if e.__class__.__name__ in {'DoesNotExist','IntegrityError'}: return err('The requested record could not be updated.',422)
        raise

def spa_index(request):
    fields=['singleton','seo_title','seo_description','analytics_enabled','google_analytics_id','adsense_enabled','adsense_client_id']
    s=SiteSetting.objects.only(*fields).filter(pk=1).first()
    if s is None: s=SiteSetting.objects.create(pk=1)
    return render(request,'index.html',{'settings':s})


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
