import hashlib, secrets
from datetime import timedelta
from django.contrib.auth.models import User
from django.db.models import Count
from django.utils import timezone
from .models import *
from .serializers import *

PERMISSION_CATALOG = [
    'add_mcq','edit_own_mcq','edit_any_mcq','delete_own_mcq','delete_any_mcq',
    'review_mcq','approve_mcq','reject_mcq','bulk_import_mcqs','manage_categories',
    'manage_papers','manage_jobs','manage_years','manage_guides','view_reports'
]


def _hash_token(raw):
    return hashlib.sha256(str(raw).encode('utf-8')).hexdigest()


def create_token(user, purpose, minutes=30):
    raw = secrets.token_urlsafe(32)
    OneTimeToken.objects.create(
        user=user,
        purpose=purpose,
        token_hash=_hash_token(raw),
        expires_at=timezone.now() + timedelta(minutes=minutes),
    )
    return raw


def consume_token(raw, purpose):
    if not raw:
        return None
    tok = OneTimeToken.objects.filter(
        purpose=purpose,
        token_hash=_hash_token(raw),
        used_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).select_related('user').first()
    if not tok:
        return None
    tok.used_at = timezone.now()
    tok.save(update_fields=['used_at'])
    return tok.user


def _is_super(user):
    return user.is_authenticated and user_role(user) == 'super-admin'


def _is_adminish(user):
    return user.is_authenticated and user_role(user) in {'admin', 'super-admin'}


def _require_super(user):
    if not _is_super(user):
        raise PermissionError('Only Super Admin can perform this action.')


def _require_admin(user):
    if not _is_adminish(user):
        raise PermissionError('Admin permission is required.')


def _next_id(model):
    last = model.objects.order_by('-id').first()
    return int(last.id) + 1 if last else 1


def _setting_dict():
    s = SiteSetting.get_solo()
    return {
        'site_name': s.site_name,
        'description': s.description,
        'country': s.country,
        'about': s.about,
        'contact': s.contact,
        'seo_title': s.seo_title,
        'seo_description': s.seo_description,
        'admin_permissions': s.admin_permissions or {},
        'google_analytics_id': s.google_analytics_id,
        'analytics_enabled': s.analytics_enabled,
        'adsense_client_id': s.adsense_client_id,
        'adsense_enabled': s.adsense_enabled,
    }


def _admin_summary(user):
    admins = []
    for u in User.objects.filter(profile__role__in=['admin', 'super-admin']).select_related('profile'):
        created = MCQ.objects.filter(created_by=u).count()
        approved = MCQ.objects.filter(created_by=u, status='approved').count()
        pending = MCQ.objects.filter(created_by=u, status='pending').count()
        rejected = MCQ.objects.filter(created_by=u, status='rejected').count()
        reviewed = MCQ.objects.filter(reviewed_by=u).count()
        last_log = AuditLog.objects.filter(user=u).order_by('-created_at').first()
        admins.append({
            'id': u.id,
            'name': user_name(u),
            'email': u.email,
            'role': user_role(u),
            'permissions': user_permissions(u),
            'status': 'active' if u.is_active else 'disabled',
            'created_mcqs': created,
            'approved_mcqs': approved,
            'pending_mcqs': pending,
            'rejected_mcqs': rejected,
            'reviewed_mcqs': reviewed,
            'total_actions': AuditLog.objects.filter(user=u).count(),
            'last_activity': iso(last_log.created_at) if last_log else None,
        })
    return admins


def snapshot(user):
    data = {
        'settings': _setting_dict(),
        'categories': [category(x) for x in Category.objects.order_by('id')],
        'subcategories': [subcategory(x) for x in Subcategory.objects.order_by('id')],
        'childCategories': [child(x) for x in ChildCategory.objects.order_by('id')],
        'papers': [paper(x) for x in Paper.objects.order_by('id')],
        'jobs': [job(x) for x in Job.objects.order_by('id')],
        'years': [year(x) for x in JobYear.objects.order_by('id')],
        'mcqs': [mcq(x) for x in MCQ.objects.order_by('-created_at')[:1000]],
        'guides': [guide(x) for x in Guide.objects.order_by('-created_at')],
        'posts': [post(x) for x in Post.objects.order_by('-created_at')],
        'ads': [ad(x) for x in AdPlacement.objects.order_by('-priority','id')],
        'bookmarks': [],
        'savedPapers': [],
        'attempts': [],
        'reports': [],
        'contacts': [],
        'admins': [],
        'activity': [],
        'stats': {
            'total_mcqs': MCQ.objects.count(),
            'approved_mcqs': MCQ.objects.filter(status='approved').count(),
            'pending_mcqs': MCQ.objects.filter(status='pending').count(),
            'rejected_mcqs': MCQ.objects.filter(status='rejected').count(),
            'total_categories': Category.objects.count(),
            'total_papers': Paper.objects.count(),
            'total_admins': User.objects.filter(profile__role__in=['admin','super-admin']).count(),
        }
    }
    if user.is_authenticated:
        data['bookmarks'] = [{'id': b.mcq_id, 'mcq_id': b.mcq_id, 'created_at': iso(b.created_at)} for b in Bookmark.objects.filter(user=user)]
        data['savedPapers'] = [{'id': s.paper_id, 'paper_id': s.paper_id, 'created_at': iso(s.created_at)} for s in SavedPaper.objects.filter(user=user)]
        data['attempts'] = [{'id': a.id, 'mcq_id': a.mcq_id, 'answer': a.answer, 'correct': a.correct, 'created_at': iso(a.created_at)} for a in Attempt.objects.filter(user=user).order_by('-created_at')[:300]]
    if _is_adminish(user):
        data['reports'] = [{'id': r.id, 'mcq_id': r.mcq_id, 'reason': r.reason, 'status': r.status, 'created_at': iso(r.created_at)} for r in Report.objects.order_by('-created_at')[:300]]
        data['contacts'] = [{'id': c.id, 'name': c.name, 'email': c.email, 'message': c.message, 'created_at': iso(c.created_at)} for c in ContactMessage.objects.order_by('-created_at')[:300]]
        data['activity'] = [{'id': l.id, 'action': l.action, 'detail': l.detail, 'user': user_name(l.user) if l.user else 'System', 'created_at': iso(l.created_at)} for l in AuditLog.objects.order_by('-created_at')[:500]]
    if _is_super(user):
        data['admins'] = _admin_summary(user)
    return data


def _log(user, action, detail=''):
    AuditLog.objects.create(user=user if user.is_authenticated else None, action=action, detail=detail[:500])


def _set_fields(obj, payload, fields):
    for f in fields:
        if f in payload:
            setattr(obj, f, payload[f])
    return obj


def command(user, action, p):
    action = action or ''
    if action == 'set-active-role':
        return {'ok': True, 'activeRole': p.get('role')}

    if action == 'update-site-settings':
        _require_super(user)
        s = SiteSetting.get_solo()
        for f in ['site_name','description','country','about','contact','seo_title','seo_description','google_analytics_id','adsense_client_id']:
            if f in p: setattr(s, f, p.get(f) or '')
        for f in ['analytics_enabled','adsense_enabled']:
            if f in p: setattr(s, f, bool(p.get(f)))
        if 'admin_permissions' in p and isinstance(p['admin_permissions'], dict):
            s.admin_permissions = p['admin_permissions']
        s.updated_by = user
        s.save()
        _log(user, 'update-site-settings', 'Updated website settings')
        return _setting_dict()

    if action in {'create-admin','update-admin'}:
        _require_super(user)
        email = (p.get('email') or '').strip().lower()
        if not email:
            raise ValueError('Admin email is required.')
        if action == 'create-admin':
            if User.objects.filter(email=email).exists():
                raise ValueError('This email already exists.')
            u = User.objects.create_user(username=email, email=email, password=p.get('password') or secrets.token_urlsafe(10), first_name=p.get('name') or email)
        else:
            u = User.objects.get(id=p.get('id'))
            u.email = email
            u.username = email
            u.first_name = p.get('name') or u.first_name
            if p.get('password'):
                u.set_password(p['password'])
        u.is_staff = True
        u.is_active = p.get('status','active') != 'disabled'
        u.save()
        prof = profile_for(u)
        prof.role = p.get('role') if p.get('role') in {'admin','super-admin'} else 'admin'
        prof.permissions = p.get('permissions') or PERMISSION_CATALOG
        prof.email_verified = True
        prof.save()
        _log(user, action, email)
        return user_dict(u)

    if action in {'create-ad','update-ad'}:
        _require_super(user)
        obj = AdPlacement.objects.get(id=p.get('id')) if action == 'update-ad' else AdPlacement(created_by=user)
        _set_fields(obj, p, ['name','provider','placement','title','body','image_url','target_url','adsense_slot','priority'])
        if 'active' in p: obj.active = bool(p.get('active'))
        obj.updated_by = user
        obj.save()
        _log(user, action, obj.name)
        return ad(obj)

    if action == 'delete-ad':
        _require_super(user)
        AdPlacement.objects.filter(id=p.get('id')).delete()
        _log(user, 'delete-ad', str(p.get('id')))
        return {'ok': True}

    if action in {'create-category','update-category'}:
        _require_admin(user)
        obj = Category.objects.get(id=p.get('id')) if action == 'update-category' else Category(id=p.get('id') or _next_id(Category), created_by=user)
        _set_fields(obj, p, ['name','icon'])
        if 'active' in p: obj.active = bool(p.get('active'))
        obj.updated_by = user; obj.save(); _log(user, action, obj.name); return category(obj)

    if action in {'create-paper','update-paper'}:
        _require_admin(user)
        obj = Paper.objects.get(id=p.get('id')) if action == 'update-paper' else Paper(id=p.get('id') or _next_id(Paper), created_by=user)
        _set_fields(obj, p, ['name','country','icon'])
        if 'paper_icon' in p: obj.icon = p.get('paper_icon') or obj.icon
        if 'active' in p: obj.active = bool(p.get('active'))
        obj.updated_by = user; obj.save(); _log(user, action, obj.name); return paper(obj)

    if action in {'create-mcq','update-mcq'}:
        _require_admin(user)
        obj = MCQ.objects.get(id=p.get('id')) if action == 'update-mcq' else MCQ(id=p.get('id') or _next_id(MCQ), created_by=user, submitted_by=user)
        for f in ['question','option1','option2','option3','option4','correct_answer','description','country','source','seo_description','submission_type']:
            if f in p: setattr(obj, f, p.get(f) or '')
        if 'category_id' in p: obj.category_id = p.get('category_id')
        for src, dest in [('subcategory_ids','subcategory_ids'),('child_subcategory_ids','child_subcategory_ids'),('paper_id','paper_ids'),('job_ids','job_ids'),('job_years_ids','job_year_ids')]:
            if src in p: setattr(obj, dest, p.get(src) or [])
        if 'important' in p: obj.important = bool(p.get('important'))
        if 'status' in p: obj.status = p.get('status') or 'pending'
        obj.updated_by = user
        obj.save()
        _log(user, action, obj.question[:80])
        return mcq(obj)

    if action == 'approve-mcq':
        _require_admin(user)
        obj = MCQ.objects.get(id=p.get('id'))
        obj.status='approved'; obj.reviewed_by=user; obj.approved_by=user; obj.rejection_reason=''; obj.save()
        _log(user, 'approve-mcq', obj.question[:80]); return mcq(obj)

    if action == 'reject-mcq':
        _require_admin(user)
        obj = MCQ.objects.get(id=p.get('id'))
        obj.status='rejected'; obj.reviewed_by=user; obj.rejection_reason=p.get('reason') or p.get('rejection_reason') or ''; obj.save()
        _log(user, 'reject-mcq', obj.question[:80]); return mcq(obj)

    if action == 'bookmark-mcq':
        b,_ = Bookmark.objects.get_or_create(user=user, mcq_id=p.get('mcq_id') or p.get('id'))
        return {'id': b.mcq_id, 'mcq_id': b.mcq_id}
    if action == 'remove-bookmark':
        Bookmark.objects.filter(user=user, mcq_id=p.get('mcq_id') or p.get('id')).delete(); return {'ok': True}
    if action == 'save-paper':
        s,_ = SavedPaper.objects.get_or_create(user=user, paper_id=p.get('paper_id') or p.get('id')); return {'id': s.paper_id, 'paper_id': s.paper_id}
    if action == 'submit-attempt':
        mcq_obj = MCQ.objects.get(id=p.get('mcq_id'))
        ans = p.get('answer') or ''
        a = Attempt.objects.create(user=user, mcq=mcq_obj, answer=ans, correct=str(ans).strip()==str(mcq_obj.correct_answer).strip())
        return {'id': a.id, 'correct': a.correct}
    if action == 'contact-message':
        c = ContactMessage.objects.create(user=user if user.is_authenticated else None, name=p.get('name',''), email=p.get('email',''), message=p.get('message',''))
        return {'id': c.id}

    raise ValueError('Unsupported action: ' + action)
