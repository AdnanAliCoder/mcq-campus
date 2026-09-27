import json, re, logging, time, hashlib, hmac, secrets
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.hashers import make_password
from django.db import connection, transaction
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email
from django.http import JsonResponse, HttpResponse, FileResponse, Http404
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.utils import timezone
from django.utils.html import escape
from django.utils.text import slugify
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from .models import *
from .serializers import user_dict, user_identity_dict, user_profile_dict, mcq
from .services import (
    snapshot, startup_payload, public_content_data, public_resources_data, public_catalog_data, public_legal_data, command, create_token, consume_token, mcq_page, _validate_password,
    learner_dashboard_data, admin_overview_data, admin_users_data, admin_reports_data, admin_trash_data, admin_logs_data, admin_content_data, is_admin, is_super, _bulk_duplicate_mcq,
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

def _pending_code_hash(email,code):
    key=str(settings.SECRET_KEY).encode('utf-8')
    return hmac.new(key,f'{email}:{str(code)}'.encode('utf-8'),hashlib.sha256).hexdigest()

def _new_signup_code():
    return f'{secrets.randbelow(1000000):06d}'

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

def _email_shell(title,lead,content_html,footer):
    return f"""<!doctype html>
<html><body style="margin:0;background:#f4f8f6;font-family:Arial,sans-serif;color:#18352d">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f8f6;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #d7e6df;border-radius:16px;overflow:hidden">
<tr><td style="background:#087e65;padding:24px 28px;color:#fff"><div style="font-size:13px;letter-spacing:.12em;font-weight:700">MCQ CAMPUS</div><div style="font-size:24px;font-weight:700;margin-top:8px">{escape(title)}</div></td></tr>
<tr><td style="padding:28px"><p style="margin:0 0 18px;font-size:16px;line-height:1.6">{escape(lead)}</p>{content_html}<p style="margin:24px 0 0;color:#607268;font-size:13px;line-height:1.6">{escape(footer)}</p></td></tr>
</table><p style="font-size:12px;color:#7a8d84;margin:14px 0 0">MCQ Campus · www.mcqcampus.com</p>
</td></tr></table></body></html>"""

def _send_auth_email(subject,body,email,html=None):
    try:
        message=EmailMultiAlternatives(subject,body,None,[email])
        if html: message.attach_alternative(html,'text/html')
        message.send(fail_silently=False)
        return True
    except Exception as exc:
        logger.warning('auth_email_delivery_failed type=%s',exc.__class__.__name__)
        return False

def _code_email(code,title,lead,minutes,footer):
    body=f'MCQ Campus\n\n{lead}\n\nCode: {code}\n\nThis code expires in {minutes} minutes.\n{footer}'
    code_html=escape(str(code))
    html=_email_shell(
        title,lead,
        f'<div style="text-align:center;margin:24px 0"><div style="display:inline-block;background:#eef8f3;border:1px solid #b9ddce;border-radius:12px;padding:16px 24px;font-size:32px;letter-spacing:.22em;font-weight:800;color:#075b4c">{code_html}</div><div style="margin-top:10px;color:#607268;font-size:13px">Expires in {minutes} minutes</div></div>',
        footer,
    )
    return body,html

def _verification_email(code):
    minutes=getattr(settings,'EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES',10)
    return _code_email(code,'Verify your email','Use this 6-digit code to finish creating your MCQ Campus account.',minutes,'Your account will not be created until this code is verified.')

def _reset_email(code):
    minutes=getattr(settings,'PASSWORD_RESET_CODE_EXPIRY_MINUTES',10)
    return _code_email(code,'Reset your password','Use this 6-digit code to reset your MCQ Campus password.',minutes,'If you did not request a password reset, you can ignore this email.')

def _password_change_email(code):
    minutes=getattr(settings,'PASSWORD_RESET_CODE_EXPIRY_MINUTES',10)
    return _code_email(code,'Confirm password change','Use this 6-digit code to confirm your new password.',minutes,'Your password will remain unchanged until this code is verified.')

def _welcome_email(user):
    first=user.first_name or 'Learner'
    body=(f'Welcome to MCQ Campus, {first}!\n\nYour account is verified and ready. '
          'You can practise MCQs, explore past papers, take tests, save questions, review mistakes, '
          'track progress, and prepare for jobs and competitive exams.\n\nhttps://www.mcqcampus.com')
    html=_email_shell(
        'Welcome to MCQ Campus',
        f'Welcome, {first}! Your account has been verified successfully.',
        '<p style="font-size:15px;line-height:1.7;margin:0 0 16px">You can now use MCQ Campus to:</p>'
        '<ul style="padding-left:20px;line-height:1.9;color:#314d44">'
        '<li>Practice MCQs with answers and explanations</li>'
        '<li>Explore past papers and job-wise preparation</li>'
        '<li>Take tests and review your results</li>'
        '<li>Save questions and track your learning progress</li>'
        '<li>Access PDFs, current affairs, guides and exam resources</li>'
        '</ul>'
        '<p style="margin:24px 0 0"><a href="https://www.mcqcampus.com" style="display:inline-block;background:#087e65;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:700">Open MCQ Campus</a></p>',
        'We are glad to have you with us. Keep learning at your own pace.',
    )
    return body,html

def _send_email_parts(subject,parts,email):
    body,html=parts
    return _send_auth_email(subject,body,email,html)

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
    d=payload(request)
    first_name=str(d.get('first_name') or '').strip()
    last_name=str(d.get('last_name') or '').strip()
    password=str(d.get('password') or '')
    confirm=str(d.get('confirm') or '')
    if not first_name: return err('First name is required.',422,{'first_name':'Required.'})
    if not last_name: return err('Last name is required.',422,{'last_name':'Required.'})
    if password!=confirm: return err('Passwords do not match.',422,{'confirm':'Passwords do not match.'})
    if not d.get('terms'): return err('Accept the terms and privacy information.',422,{'terms':'Required.'})
    try: email=_normalize_email(d.get('email'))
    except ValueError as exc: return err(exc,422,{'email':str(exc)})
    if _rate_limited('register',[f'ip:{_client_ip(request)}'],5,60*60): return err('Too many registration attempts. Please try again later.',429)
    _record_rate('register',[f'ip:{_client_ip(request)}'])
    if User.objects.filter(email__iexact=email).exists():
        return err('An account with this email already exists. Please sign in.',422,{'email':'Already registered.'})
    temp=User(username=email,email=email,first_name=first_name[:150],last_name=last_name[:150])
    try: _validate_password(password,temp)
    except ValueError as exc: return err(exc,422,{'password':str(exc)})
    code=_new_signup_code()
    now=timezone.now()
    expiry_minutes=getattr(settings,'EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES',10)
    PendingSignup.objects.update_or_create(
        email=email,
        defaults={
            'first_name':first_name[:150],
            'last_name':last_name[:150],
            'password_hash':make_password(password),
            'code_hash':_pending_code_hash(email,code),
            'expires_at':now+timedelta(minutes=expiry_minutes),
            'attempt_count':0,
            'last_sent_at':now,
        },
    )
    delivered=_send_email_parts('Your MCQ Campus verification code',_verification_email(code),email)
    if not delivered:
        return err('Verification email could not be delivered right now. Please try Resend code shortly.',503,{'emailDelivery':'temporary'})
    return JsonResponse({
        'completed':True,
        'verificationRequired':True,
        'email':email,
        'resendAfter':getattr(settings,'EMAIL_VERIFICATION_RESEND_SECONDS',60),
        'expiresIn':expiry_minutes*60,
        'message':'Enter the 6-digit code sent to your email. Your account will be created after verification.',
    })

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
        _send_email_parts('MCQ Campus password reset code',_reset_email(code),email)
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
    code=str(d.get('code') or '').strip()
    if not re.fullmatch(r'\d{6}',code):
        _record_rate('verify',ids)
        return err('Enter the valid 6-digit verification code.',422)
    pending=PendingSignup.objects.filter(email__iexact=email).first()
    if pending:
        max_attempts=getattr(settings,'EMAIL_VERIFICATION_MAX_ATTEMPTS',5)
        if pending.expires_at<=timezone.now() or pending.attempt_count>=max_attempts:
            return err('Invalid or expired verification code. Request a new code.',422)
        if not hmac.compare_digest(pending.code_hash,_pending_code_hash(email,code)):
            pending.attempt_count+=1
            pending.save(update_fields=['attempt_count','updated_at'])
            _record_rate('verify',ids)
            return err('Invalid or expired verification code.',422)
        with transaction.atomic():
            pending=PendingSignup.objects.select_for_update().get(pk=pending.pk)
            if pending.expires_at<=timezone.now() or pending.attempt_count>=max_attempts:
                return err('Invalid or expired verification code. Request a new code.',422)
            if not hmac.compare_digest(pending.code_hash,_pending_code_hash(email,code)):
                pending.attempt_count+=1
                pending.save(update_fields=['attempt_count','updated_at'])
                return err('Invalid or expired verification code.',422)
            if User.objects.filter(email__iexact=email).exists():
                pending.delete()
                return err('An account with this email already exists. Please sign in.',422)
            u=User(
                username=email,email=email,
                first_name=pending.first_name,last_name=pending.last_name,
                password=pending.password_hash,
                is_active=True,is_staff=False,is_superuser=False,
            )
            u.save()
            prof=profile_for(u)
            prof.role='user'; prof.permissions=[]; prof.email_verified=True
            prof.save(update_fields=['role','permissions','email_verified'])
            pending.delete()
        _send_email_parts('Welcome to MCQ Campus',_welcome_email(u),u.email)
        return JsonResponse({'completed':True,'message':'Email verified and account created. You can now sign in.'})

    # Backward compatibility for accounts created by the older verification flow.
    u=User.objects.filter(email__iexact=email,is_active=True).first()
    if not u: _record_rate('verify',ids); return err('Invalid or expired verification code.',422)
    prof=profile_for(u)
    if prof.email_verified: return err('Verification is already complete.',422)
    verified=consume_token(u,code,'verify',getattr(settings,'EMAIL_VERIFICATION_MAX_ATTEMPTS',5))
    if not verified: _record_rate('verify',ids); return err('Invalid or expired verification code.',422)
    prof.email_verified=True; prof.save(update_fields=['email_verified'])
    return JsonResponse({'completed':True,'message':'Email verified. You can now sign in.'})

@require_POST
def auth_resend_verification(request):
    d=payload(request)
    generic={'completed':True,'message':'If verification is required, a new code has been sent.','resendAfter':getattr(settings,'EMAIL_VERIFICATION_RESEND_SECONDS',60)}
    try: email=_normalize_email(d.get('email'))
    except ValueError: return JsonResponse(generic)
    ids=[f'email:{email}',f'ip:{_client_ip(request)}']
    if _rate_limited('resend',ids,5,60*60): return JsonResponse(generic)
    pending=PendingSignup.objects.filter(email__iexact=email).first()
    if pending:
        cooldown=getattr(settings,'EMAIL_VERIFICATION_RESEND_SECONDS',60)
        elapsed=(timezone.now()-pending.last_sent_at).total_seconds()
        if elapsed<cooldown:
            remaining=max(1,int(cooldown-elapsed+0.999))
            return JsonResponse({**generic,'message':f'Please wait {remaining} seconds before requesting another code.','resendAfter':remaining})
        code=_new_signup_code()
        expiry_minutes=getattr(settings,'EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES',10)
        delivered=_send_email_parts('Your MCQ Campus verification code',_verification_email(code),email)
        if delivered:
            pending.code_hash=_pending_code_hash(email,code)
            pending.expires_at=timezone.now()+timedelta(minutes=expiry_minutes)
            pending.attempt_count=0
            pending.last_sent_at=timezone.now()
            pending.save(update_fields=['code_hash','expires_at','attempt_count','last_sent_at','updated_at'])
        _record_rate('resend',ids)
        return JsonResponse(generic)
    # Backward compatibility for older unverified accounts.
    u=User.objects.filter(email__iexact=email,is_active=True,profile__email_verified=False).first()
    if u:
        cooldown=getattr(settings,'EMAIL_VERIFICATION_RESEND_SECONDS',60)
        latest=OneTimeToken.objects.filter(user=u,purpose='verify').order_by('-created_at').first()
        if latest and (timezone.now()-latest.created_at).total_seconds()<cooldown: return JsonResponse(generic)
        code=create_token(u,'verify',getattr(settings,'EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES',10))
        _send_email_parts('Your MCQ Campus verification code',_verification_email(code),email)
    _record_rate('resend',ids)
    return JsonResponse(generic)


@require_POST
@login_required_json
def auth_password_change_start(request):
    d=payload(request)
    current=str(d.get('current_password') or '')
    new=str(d.get('new_password') or '')
    confirm=str(d.get('confirm_password') or '')
    if not request.user.check_password(current):
        return err('Current password is incorrect.',422,{'current_password':'Incorrect password.'})
    if not new or new!=confirm:
        return err('New passwords do not match.',422,{'confirm_password':'Passwords must match.'})
    if request.user.check_password(new):
        return err('New password must be different from your current password.',422,{'new_password':'Choose a different password.'})
    try: _validate_password(new,request.user)
    except ValueError as exc: return err(exc,422,{'new_password':str(exc)})
    ids=[f'user:{request.user.pk}',f'ip:{_client_ip(request)}']
    if _rate_limited('password-change',ids,5,15*60):
        return err('Too many password change attempts. Please try again later.',429)
    _record_rate('password-change',ids)
    code=create_token(request.user,'change',getattr(settings,'PASSWORD_RESET_CODE_EXPIRY_MINUTES',10))
    request.session['pending_password_change_hash']=make_password(new)
    request.session['pending_password_change_user']=request.user.pk
    request.session.modified=True
    if not _send_email_parts('Confirm your MCQ Campus password change',_password_change_email(code),request.user.email):
        OneTimeToken.objects.filter(user=request.user,purpose='change',used_at__isnull=True).update(used_at=timezone.now())
        request.session.pop('pending_password_change_hash',None)
        request.session.pop('pending_password_change_user',None)
        return err('We could not send the verification code right now. Please try again shortly.',503)
    return JsonResponse({'completed':True,'verificationRequired':True,'resendAfter':60,'message':'A 6-digit verification code was sent to your email.'})

@require_POST
@login_required_json
def auth_password_change_confirm(request):
    code=str(payload(request).get('code') or '').strip()
    if not re.fullmatch(r'\d{6}',code): return err('Enter the 6-digit verification code.',422)
    if request.session.get('pending_password_change_user')!=request.user.pk:
        return err('Start the password change process again.',422)
    encoded=str(request.session.get('pending_password_change_hash') or '')
    if not encoded:
        return err('Start the password change process again.',422)
    verified=consume_token(request.user,code,'change',getattr(settings,'PASSWORD_RESET_MAX_ATTEMPTS',5))
    if not verified: return err('Invalid or expired verification code.',422)
    request.user.password=encoded
    request.user.save(update_fields=['password'])
    request.session.pop('pending_password_change_hash',None)
    request.session.pop('pending_password_change_user',None)
    update_session_auth_hash(request,request.user)
    return JsonResponse({'completed':True,'message':'Your password has been changed successfully.'})

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
    filters={k:request.GET.get(k) for k in ['status','category','paper','job','year','search','owner','author','from','to','id'] if request.GET.get(k)}
    return JsonResponse(mcq_page(request.user,page,page_size,filters))

@profile_api('mcq_match')
@require_GET
@login_required_json
def mcq_match(request):
    if not is_admin(request.user): return err('Administrator access is required.',403)
    question=str(request.GET.get('question') or '').strip()
    if len(question)<3: return JsonResponse({'match':None})
    obj=_bulk_duplicate_mcq(question)
    return JsonResponse({'match':mcq(obj) if obj else None})

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
    available=['user']+(['admin'] if account_role in {'admin','super-admin'} else [])+(['super-admin'] if is_super(request.user) else [])
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
        delta_actions={'attempt','toggleBookmark','savePaper','report','saveProfile','changePassword','form:profile','form:password-change','form:mcq','form:review','form:entity','form:user','form:guide','form:post','form:ad','form:pdf','form:latest-job','action:import-confirm','action:report-resolve','action:user-status','action:ad-toggle','action:ad-delete','action:post-delete','action:pdf-delete','action:latest-job-toggle','action:latest-job-delete'}
        if action not in delta_actions: response['refresh']='bootstrap'
        return JsonResponse(response)
    except PermissionError as e: return err(e,403)
    except (ValueError,KeyError,TypeError) as e: return err(e,422)
    except Exception as e:
        if e.__class__.__name__ in {'DoesNotExist','IntegrityError'}: return err('The requested record could not be updated.',422)
        raise

SEO_ORIGIN='https://mcqcampus.com'

def _seo_slug(value):
    return slugify(str(value or ''))[:96] or 'item'

def _public_text_response(body, content_type):
    response=HttpResponse(body,content_type=content_type)
    # Keep crawler-facing discovery files cheap and independent of session state.
    response['Cache-Control']='public, max-age=300, s-maxage=3600'
    response['X-Robots-Tag']='noindex'
    return response

def _xml_response(body):
    return _public_text_response(body,'application/xml; charset=utf-8')

def _urlset(items):
    rows=[]
    for loc,lastmod in items:
        lm=f'<lastmod>{lastmod.date().isoformat()}</lastmod>' if lastmod else ''
        rows.append(f'<url><loc>{escape(loc)}</loc>{lm}</url>')
    return '<?xml version="1.0" encoding="UTF-8"?>'+'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(rows)+'</urlset>'

def sitemap_index(request):
    names=['pages','categories','papers','mcqs','resources']
    body='<?xml version="1.0" encoding="UTF-8"?>'+'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f'<sitemap><loc>{SEO_ORIGIN}/sitemap-{name}.xml</loc></sitemap>' for name in names)+'</sitemapindex>'
    return _xml_response(body)

def sitemap_pages(request):
    paths=['/','/mcqs','/categories','/papers','/jobs-exams','/pdfs','/latest-jobs','/posts','/about','/contact','/faq','/privacy','/terms','/disclaimer']
    return _xml_response(_urlset([(SEO_ORIGIN+p,None) for p in paths]))

def sitemap_categories(request):
    rows=[(f'{SEO_ORIGIN}/category/{_seo_slug(x.name)}',x.updated_at) for x in Category.objects.filter(active=True).only('name','updated_at')]
    subs=Subcategory.objects.filter(active=True,category__active=True).only('name','updated_at')
    rows.extend((f'{SEO_ORIGIN}/subcategory/{_seo_slug(x.name)}',x.updated_at) for x in subs)
    children=ChildCategory.objects.filter(active=True,subcategory__active=True,subcategory__category__active=True).only('name','updated_at')
    rows.extend((f'{SEO_ORIGIN}/topic/{_seo_slug(x.name)}',x.updated_at) for x in children)
    return _xml_response(_urlset(rows))

def sitemap_papers(request):
    rows=[]
    for p in Paper.objects.filter(active=True).only('name','updated_at'):
        rows.append((f'{SEO_ORIGIN}/paper/{_seo_slug(p.name)}',p.updated_at))
    jobs=Job.objects.filter(active=True,paper__active=True).select_related('paper').only('name','updated_at','paper__name')
    for j in jobs:
        rows.append((f'{SEO_ORIGIN}/paper/{_seo_slug(j.paper.name)}/job/{_seo_slug(j.name)}',j.updated_at))
    years=JobYear.objects.filter(active=True,job__active=True,job__paper__active=True).select_related('job','job__paper').only('name','updated_at','job__name','job__paper__name')
    for y in years:
        rows.append((f'{SEO_ORIGIN}/paper/{_seo_slug(y.job.paper.name)}/job/{_seo_slug(y.job.name)}/year/{_seo_slug(y.name)}',y.updated_at))
    return _xml_response(_urlset(rows))

def sitemap_mcqs(request):
    rows=[(f'{SEO_ORIGIN}/mcq/{_seo_slug(q.question)}',q.updated_at) for q in MCQ.objects.filter(status='approved').only('question','updated_at')]
    return _xml_response(_urlset(rows))

def sitemap_resources(request):
    rows=[(f'{SEO_ORIGIN}/post/{p.slug}',p.updated_at) for p in Post.objects.filter(status='published').only('slug','updated_at')]
    return _xml_response(_urlset(rows))

def _seo_page_context(path, default_title, default_description):
    """Build crawler-visible metadata and internal links without requiring JavaScript."""
    title=default_title
    description=default_description
    heading='MCQ Campus'
    intro='Practice MCQs with answers and explanations, explore past papers, jobs, categories and exam preparation resources.'
    links=[
        ('Practice MCQs','/mcqs'),('MCQ Categories','/categories'),('Past Papers','/papers'),
        ('Jobs & Exams','/jobs-exams'),('Preparation PDFs','/pdfs'),('Latest Jobs','/latest-jobs'),
        ('Exam Preparation Articles','/posts'),
    ]

    if path=='/':
        title='MCQ Campus — Practice MCQs, Past Papers & Exam Preparation'
        description='Practice MCQs with answers and explanations, browse past papers, jobs, categories and exam preparation resources for competitive exams.'
        heading='Practice MCQs, Past Papers & Exam Preparation'
    elif path=='/mcqs':
        title='Practice MCQs with Answers & Explanations | MCQ Campus'
        description='Practice approved MCQs with correct answers and explanations across categories, jobs and past papers.'
        heading='Practice MCQs with Answers & Explanations'
        links=[(q.question[:100],f'/mcq/{_seo_slug(q.question)}') for q in MCQ.objects.filter(status='approved').only('question').order_by('-updated_at')[:100]]
    elif path=='/categories':
        title='MCQ Categories | MCQ Campus'
        description='Browse MCQ categories and practice questions with answers and explanations for competitive exam preparation.'
        heading='MCQ Categories'
        links=[(x.name,f'/category/{_seo_slug(x.name)}') for x in Category.objects.filter(active=True).only('name').order_by('name')]
    elif path=='/papers':
        title='Past Papers & MCQs with Answers | MCQ Campus'
        description='Browse testing organizations and past papers, then practice related MCQs with answers and explanations.'
        heading='Past Papers & MCQs'
        links=[(p.name,f'/paper/{_seo_slug(p.name)}') for p in Paper.objects.filter(active=True).only('name').order_by('name')]
    elif path=='/jobs-exams':
        title='Jobs & Exams Preparation — Past Papers and MCQs | MCQ Campus'
        description='Browse competitive exam jobs and prepare with job-wise past papers, repeated MCQs, answers and explanations.'
        heading='Jobs & Exams Preparation'
        links=[
            (j.name,f'/paper/{_seo_slug(j.paper.name)}/job/{_seo_slug(j.name)}')
            for j in Job.objects.filter(active=True,paper__active=True).select_related('paper').only('name','paper__name').order_by('name')
        ]
    elif path.startswith('/category/'):
        wanted=path.split('/category/',1)[1].strip('/')
        for x in Category.objects.filter(active=True).only('id','name'):
            if _seo_slug(x.name)==wanted:
                title=f'{x.name} MCQs with Answers | MCQ Campus'
                description=f'Practice {x.name} MCQs with correct answers and explanations for competitive exam preparation.'
                heading=f'{x.name} MCQs'
                links=[(q.question[:100],f'/mcq/{_seo_slug(q.question)}') for q in MCQ.objects.filter(status='approved',category_id=x.id).only('question').order_by('-updated_at')[:100]]
                break
    elif path.startswith('/subcategory/'):
        wanted=path.split('/subcategory/',1)[1].strip('/')
        for x in Subcategory.objects.filter(active=True,category__active=True).select_related('category').only('id','name','category__name'):
            if _seo_slug(x.name)==wanted:
                title=f'{x.name} MCQs with Answers | MCQ Campus'
                description=f'Practice {x.name} MCQs with correct answers and explanations for competitive exam preparation.'
                heading=f'{x.name} MCQs'
                links=[
                    (c.name,f'/topic/{_seo_slug(c.name)}')
                    for c in ChildCategory.objects.filter(active=True,subcategory_id=x.id).only('name').order_by('name')
                ]
                if not links:
                    links=[(q.question[:100],f'/mcq/{_seo_slug(q.question)}') for q in MCQ.objects.filter(status='approved',subcategory_ids__contains=[x.id]).only('question').order_by('-updated_at')[:100]]
                break
    elif path.startswith('/topic/'):
        wanted=path.split('/topic/',1)[1].strip('/')
        for x in ChildCategory.objects.filter(active=True,subcategory__active=True,subcategory__category__active=True).select_related('subcategory','subcategory__category').only('id','name','subcategory__name','subcategory__category__name'):
            if _seo_slug(x.name)==wanted:
                title=f'{x.name} MCQs with Answers | MCQ Campus'
                description=f'Practice {x.name} multiple choice questions with correct answers and explanations.'
                heading=f'{x.name} MCQs'
                links=[(q.question[:100],f'/mcq/{_seo_slug(q.question)}') for q in MCQ.objects.filter(status='approved',child_subcategory_ids__contains=[x.id]).only('question').order_by('-updated_at')[:100]]
                break
    elif path.startswith('/paper/'):
        parts=[p for p in path.split('/') if p]
        paper_slug=parts[1] if len(parts)>1 else ''
        paper=None
        for p in Paper.objects.filter(active=True).only('id','name'):
            if _seo_slug(p.name)==paper_slug: paper=p; break
        if paper:
            title=f'{paper.name} Past Papers & MCQs | MCQ Campus'
            description=f'Browse {paper.name} jobs, past papers and related MCQs with answers and explanations.'
            heading=f'{paper.name} Past Papers'
            links=[(j.name,f'/paper/{paper_slug}/job/{_seo_slug(j.name)}') for j in Job.objects.filter(active=True,paper_id=paper.id).only('name').order_by('name')]
            if 'job' in parts:
                ji=parts.index('job')
                job_slug=parts[ji+1] if len(parts)>ji+1 else ''
                job=None
                for j in Job.objects.filter(active=True,paper_id=paper.id).only('id','name'):
                    if _seo_slug(j.name)==job_slug: job=j; break
                if job:
                    title=f'{job.name} Past Papers & MCQs | MCQ Campus'
                    description=f'Explore {job.name} past papers and practice related MCQs with answers and explanations.'
                    heading=f'{job.name} Past Papers & MCQs'
                    links=[(y.name,f'/paper/{paper_slug}/job/{job_slug}/year/{_seo_slug(y.name)}') for y in JobYear.objects.filter(active=True,job_id=job.id).only('name').order_by('-name')]
                    if 'year' in parts:
                        yi=parts.index('year')
                        year_slug=parts[yi+1] if len(parts)>yi+1 else ''
                        year=None
                        for y in JobYear.objects.filter(active=True,job_id=job.id).only('id','name'):
                            if _seo_slug(y.name)==year_slug: year=y; break
                        if year:
                            title=f'{job.name} {year.name} MCQs | MCQ Campus'
                            description=f'Practice MCQs from {job.name} {year.name} with answers and explanations.'
                            heading=f'{job.name} — {year.name}'
                            links=[(q.question[:100],f'/mcq/{_seo_slug(q.question)}') for q in MCQ.objects.filter(status='approved',job_year_ids__contains=[year.id]).only('question').order_by('-updated_at')[:100]]
    elif path.startswith('/mcq/'):
        wanted=path.split('/mcq/',1)[1].strip('/')
        for q in MCQ.objects.filter(status='approved').only('question','description','seo_description'):
            if _seo_slug(q.question)==wanted:
                title=f'{q.question[:70]} | MCQ Campus'
                description=(q.seo_description or q.description or 'Practice this MCQ with the correct answer and explanation on MCQ Campus.')[:155]
                heading=q.question
                intro=description
                links=[('More Practice MCQs','/mcqs'),('Browse Categories','/categories'),('Browse Past Papers','/papers')]
                break
    return title,description,heading,intro,links

def spa_index(request):
    fields=['singleton','seo_title','seo_description','analytics_enabled','google_analytics_id','adsense_enabled','adsense_client_id']
    s=SiteSetting.objects.only(*fields).filter(pk=1).first()
    if s is None: s=SiteSetting.objects.create(pk=1)
    default_title=s.seo_title or 'MCQ Campus — Practice MCQs, Past Papers & Exam Preparation'
    default_description=s.seo_description or 'MCQ Campus offers practice MCQs, past papers, job-wise exam preparation, answers and explanations for learners in Pakistan and India.'
    path=request.path.rstrip('/') or '/'
    title,description,heading,intro,links=_seo_page_context(path,default_title,default_description)
    canonical=SEO_ORIGIN+('/' if path=='/' else path)
    return render(request,'index.html',{
        'settings':s,'seo_title':title,'seo_description':description,'canonical_url':canonical,
        'seo_heading':heading,'seo_intro':intro,'seo_links':links,
    })


def favicon(request):
    from pathlib import Path
    path=Path(__file__).resolve().parents[1]/'frontend'/'assets'/'images'/'favicon.png'
    if not path.exists(): raise Http404
    return FileResponse(open(path,'rb'),content_type='image/png')

def site_manifest(request):
    data={
        'name':'MCQ Campus',
        'short_name':'MCQ Campus',
        'description':'Practice MCQs, past papers and exam preparation.',
        'start_url':'/',
        'scope':'/',
        'display':'standalone',
        'background_color':'#ffffff',
        'theme_color':'#102823',
        'icons':[
            {'src':'/assets/images/favicon-192.png','sizes':'192x192','type':'image/png'},
            {'src':'/assets/images/favicon-512.png','sizes':'512x512','type':'image/png'},
        ],
    }
    return JsonResponse(data,content_type='application/manifest+json')

def root_static_file(request, filename):
    allowed={'routing-manifest.json'}
    if filename not in allowed: raise Http404
    from pathlib import Path
    path=Path(__file__).resolve().parents[1]/'frontend'/filename
    if not path.exists(): raise Http404
    return FileResponse(open(path,'rb'),content_type='application/json')

def robots_txt(request):
    body='User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /super-admin/\nDisallow: /dashboard/\nDisallow: /profile/\nDisallow: /api/\nSitemap: '+SEO_ORIGIN+'/sitemap.xml\n'
    return _public_text_response(body,'text/plain; charset=utf-8')
