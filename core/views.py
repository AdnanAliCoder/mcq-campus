import json, re, logging, time
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.db import connection
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.http import JsonResponse, HttpResponse, FileResponse, Http404
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from .models import *
from .serializers import user_dict, user_identity_dict, user_profile_dict
from .services import (
    snapshot, startup_payload, public_content_data, public_resources_data, public_catalog_data, public_legal_data, command, create_token, consume_token, mcq_page, _validate_password,
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

def _normalize_email(value):
    email=str(value or '').strip().lower()
    try: validate_email(email)
    except ValidationError: raise ValueError('Enter a valid email address.')
    return email

def _client_ip(request):
    forwarded=str(request.META.get('HTTP_X_FORWARDED_FOR') or '').split(',')[0].strip()
    return forwarded or str(request.META.get('REMOTE_ADDR') or 'unknown')

def _rate_hash(kind,value):
    import hashlib, hmac
    return hmac.new(str(settings.SECRET_KEY).encode(),f'{kind}:{value}'.encode(),hashlib.sha256).hexdigest()

def _rate_limited(kind,identities,limit,window_seconds):
    if not getattr(settings,'AUTH_RATE_LIMIT_ENABLED',True): return False
    since=timezone.now()-timedelta(seconds=window_seconds)
    for value in identities:
        digest=_rate_hash(kind,value)
        if AuditLog.objects.filter(action='auth-rate:'+kind,detail=digest,created_at__gte=since).count()>=limit: return True
    return False

def _record_rate(kind,identities):
    if not getattr(settings,'AUTH_RATE_LIMIT_ENABLED',True): return
    for value in identities:
        AuditLog.objects.create(action='auth-rate:'+kind,detail=_rate_hash(kind,value))

def _send_auth_email(subject,body,email):
    try:
        send_mail(subject,body,None,[email],fail_silently=False)
        return True
    except Exception as exc:
        logger.warning('auth_email_delivery_failed type=%s',exc.__class__.__name__)
        return False

def _verification_email(code):
    minutes=getattr(settings,'EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES',10)
    return f'MCQ Campus\n\nYour verification code is:\n\n{code}\n\nThis code expires in {minutes} minutes.\nIf you did not create this account, you can ignore this email.'

def _reset_email(code):
    minutes=getattr(settings,'PASSWORD_RESET_CODE_EXPIRY_MINUTES',10)
    return f'MCQ Campus\n\nPassword reset code:\n\n{code}\n\nThis code expires in {minutes} minutes.\nIf you did not request a password reset, you can ignore this email.'

def login_required_json(fn):
    def inner(request,*a,**kw):
        if not request.user.is_authenticated: return err('Your session has ended. Please sign in again.',401)
        prof=profile_for(request.user)
        if prof and not prof.email_verified:
            logout(request)
            return err('Email verification is required.',403,{'verificationRequired':True})
        return fn(request,*a,**kw)
    return inner

@ensure_csrf_cookie
@require_GET
def auth_session(request):
    if request.user.is_authenticated:
        prof=profile_for(request.user)
        if prof and not prof.email_verified: logout(request)
    user=user_dict(request.user,request.session) if request.user.is_authenticated else None
    if user and request.session.get_expiry_date(): user['expiresAt']=request.session.get_expiry_date().isoformat()
    return JsonResponse({'user':user,'csrfToken':get_token(request)})

@profile_api('auth_login')
@require_POST
def auth_login(request):
    started=time.perf_counter()
    d=payload(request)
    try: email=_normalize_email(d.get('email'))
    except ValueError: email=str(d.get('email') or '').strip().lower()
    password=str(d.get('password') or '')
    rate_ids=[f'email:{email}',f'ip:{_client_ip(request)}']
    if _rate_limited('login',rate_ids,7,15*60): return err('Too many sign-in attempts. Please try again later.',429)
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
        _record_rate('login',rate_ids)
        return err('Email or password is incorrect.',422)
    prof=profile_for(user)
    if prof and not prof.email_verified:
        return err('Your email is not verified. Enter the verification code sent to your email.',403,{'verificationRequired':True,'email':email})
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
    d=payload(request); name=str(d.get('name') or '').strip(); password=str(d.get('password') or '')
    if not d.get('terms'): return err('Accept the terms and privacy information.',422,{'terms':'Required.'})
    try: email=_normalize_email(d.get('email'))
    except ValueError as exc: return err(exc,422,{'email':str(exc)})
    if _rate_limited('register',[f'ip:{_client_ip(request)}'],5,60*60): return err('Too many registration attempts. Please try again later.',429)
    _record_rate('register',[f'ip:{_client_ip(request)}'])
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({'completed':True,'message':'If this email can be registered, further instructions will be sent.'})
    u=User(username=email,email=email,first_name=name,is_active=True,is_staff=False,is_superuser=False)
    try: _validate_password(password,u)
    except ValueError as exc: return err(exc,422,{'password':str(exc)})
    u.set_password(password); u.save()
    prof=profile_for(u); prof.role='user'; prof.permissions=[]; prof.country=str(d.get('country') or 'Pakistan')[:80]; prof.email_verified=False; prof.save()
    code=create_token(u,'verify',getattr(settings,'EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES',10))
    delivered=_send_auth_email('Your MCQ Campus verification code',_verification_email(code),email)
    if not delivered:
        return err('Account created, but the verification email could not be delivered right now. Please use Resend code.',503,{'emailDelivery':'temporary'})
    return JsonResponse({'completed':True,'verificationRequired':True,'email':email,'message':'Account created. Enter the 6-digit code sent to your email.'})

@require_POST
def auth_forgot(request):
    d=payload(request)
    try: email=_normalize_email(d.get('email'))
    except ValueError: return JsonResponse({'completed':True,'message':'If an active account matches that email, a reset code has been sent.'})
    ids=[f'email:{email}',f'ip:{_client_ip(request)}']
    if _rate_limited('forgot',ids,5,60*60):
        return JsonResponse({'completed':True,'message':'If an active account matches that email, a reset code has been sent.'})
    _record_rate('forgot',ids)
    u=User.objects.filter(email__iexact=email,is_active=True).first()
    if u:
        code=create_token(u,'reset',getattr(settings,'PASSWORD_RESET_CODE_EXPIRY_MINUTES',10))
        _send_auth_email('MCQ Campus password reset code',_reset_email(code),email)
    return JsonResponse({'completed':True,'message':'If an active account matches that email, a reset code has been sent.'})

@require_POST
def auth_reset(request):
    d=payload(request)
    try: email=_normalize_email(d.get('email'))
    except ValueError: return err('Invalid or expired reset code.',422)
    ids=[f'email:{email}',f'ip:{_client_ip(request)}']
    if _rate_limited('reset',ids,10,15*60): return err('Too many reset attempts. Please try again later.',429)
    u=User.objects.filter(email__iexact=email,is_active=True).first()
    if not u: _record_rate('reset',ids); return err('Invalid or expired reset code.',422)
    p=str(d.get('password') or ''); cfm=str(d.get('confirm') or '')
    if p!=cfm: return err('Passwords do not match.',422,{'confirm':'Passwords do not match.'})
    try: _validate_password(p,u)
    except ValueError as exc: return err(exc,422,{'password':str(exc)})
    code=d.get('code')
    verified=consume_token(u,code,'reset',getattr(settings,'PASSWORD_RESET_MAX_ATTEMPTS',5))
    if not verified: _record_rate('reset',ids); return err('Invalid or expired reset code.',422)
    u.set_password(p); u.save(update_fields=['password'])
    OneTimeToken.objects.filter(user=u,purpose='reset',used_at__isnull=True).update(used_at=timezone.now())
    return JsonResponse({'completed':True,'message':'Password updated. You can now sign in.'})

@require_POST
def auth_verify(request):
    d=payload(request)
    try: email=_normalize_email(d.get('email'))
    except ValueError: return err('Invalid or expired verification code.',422)
    ids=[f'email:{email}',f'ip:{_client_ip(request)}']
    if _rate_limited('verify',ids,15,15*60): return err('Too many verification attempts. Please try again later.',429)
    u=User.objects.filter(email__iexact=email,is_active=True).first()
    if not u: _record_rate('verify',ids); return err('Invalid or expired verification code.',422)
    prof=profile_for(u)
    if prof.email_verified: return err('Verification is already complete.',422)
    verified=consume_token(u,d.get('code'),'verify',getattr(settings,'EMAIL_VERIFICATION_MAX_ATTEMPTS',5))
    if not verified: _record_rate('verify',ids); return err('Invalid or expired verification code.',422)
    prof.email_verified=True; prof.save(update_fields=['email_verified'])
    return JsonResponse({'completed':True,'message':'Email verified. You can now sign in.'})

@require_POST
def auth_resend_verification(request):
    d=payload(request)
    generic={'completed':True,'message':'If verification is required, a new code has been sent.'}
    try: email=_normalize_email(d.get('email'))
    except ValueError: return JsonResponse(generic)
    ids=[f'email:{email}',f'ip:{_client_ip(request)}']
    if _rate_limited('resend',ids,5,60*60): return JsonResponse(generic)
    _record_rate('resend',ids)
    u=User.objects.filter(email__iexact=email,is_active=True,profile__email_verified=False).first()
    if u:
        cooldown=getattr(settings,'EMAIL_VERIFICATION_RESEND_SECONDS',60)
        latest=OneTimeToken.objects.filter(user=u,purpose='verify').order_by('-created_at').first()
        if latest and (timezone.now()-latest.created_at).total_seconds()<cooldown: return JsonResponse(generic)
        code=create_token(u,'verify',getattr(settings,'EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES',10))
        _send_auth_email('Your MCQ Campus verification code',_verification_email(code),email)
    return JsonResponse(generic)

@profile_api('auth_logout')
@require_POST
def auth_logout(request): logout(request); return JsonResponse({'completed':True})

@require_POST
def public_contact(request):
    d=payload(request); message=str(d.get('message') or '').strip(); ip=_client_ip(request)
    if _rate_limited('contact',[f'ip:{ip}'],5,60*60): return err('Too many messages. Please try again later.',429)
    if not message: return err('Enter your message.',422)
    email=str(d.get('email') or '').strip().lower()
    if email:
        try: email=_normalize_email(email)
        except ValueError as exc: return err(exc,422,{'email':str(exc)})
    _record_rate('contact',[f'ip:{ip}'])
    ContactMessage.objects.create(user=request.user if request.user.is_authenticated else None,name=str(d.get('name') or '').strip(),email=email,message=message)
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
