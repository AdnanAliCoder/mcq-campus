import json, re
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

@require_GET
def bootstrap(request): return JsonResponse(snapshot(request.user),safe=True)

@require_POST
@login_required_json
def auth_switch_role(request):
    role=str(payload(request).get('role') or '')
    available=user_dict(request.user,request.session).get('roles',[])
    if role not in available: return err('This account does not have that workspace.',403)
    request.session['active_role']=role
    request.session.modified=True
    return JsonResponse({'user':user_dict(request.user,request.session),'snapshot':snapshot(request.user),'csrfToken':get_token(request)})

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

def spa_index(request):
    s=SiteSetting.get_solo(); return render(request,'index.html',{'settings':s})


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
