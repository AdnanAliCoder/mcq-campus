import hashlib, json, re, secrets
from datetime import timedelta, date
from django.db import transaction, connection
from django.db.models import Count, Q
from django.utils import timezone
from django.utils.text import slugify
from .models import *
from .serializers import *

PERMISSION_CATALOG=['add_mcq','edit_own_mcq','edit_any_mcq','delete_own_mcq','delete_any_mcq','review_mcq','approve_mcq','reject_mcq','bulk_import_mcqs','manage_categories','manage_subcategories','manage_child_categories','manage_papers','manage_jobs','manage_job_years','manage_guides','manage_posts','publish_posts','manage_seo','view_reports','resolve_reports','view_analytics','view_logs','manage_users','manage_admins','assign_roles','change_permissions','manage_settings','manage_job_openings','backup','restore_backup']
ENTITY_MODELS={'categories':Category,'subcategories':Subcategory,'children':ChildCategory,'papers':Paper,'jobs':Job,'years':JobYear}
ENTITY_PARENT={'subcategories':('category_id',Category),'children':('subcategory_id',Subcategory),'jobs':('paper_id',Paper),'years':('job_id',Job)}

def is_super(u): return bool(u and u.is_authenticated and user_role(u)=='super-admin')
def is_admin(u): return bool(u and u.is_authenticated and user_role(u) in {'admin','super-admin'})
def has_perm(u,p): return is_super(u) or p in user_permissions(u)
def require(cond,msg='Your account does not have permission for this action.'):
    if not cond: raise PermissionError(msg)
def log(u,action,detail=''): AuditLog.objects.create(user=u if getattr(u,'is_authenticated',False) else None,action=action,detail=str(detail)[:5000])

def next_id(model): return (model.objects.order_by('-id').values_list('id',flat=True).first() or 0)+1

def job_opening_schema_ready():
    tables=set(connection.introspection.table_names())
    required={JobOpening._meta.db_table}
    required.update(field.remote_field.through._meta.db_table for field in JobOpening._meta.local_many_to_many)
    return required.issubset(tables)

def ensure_job_opening_schema():
    if job_opening_schema_ready(): return False
    existing=set(connection.introspection.table_names())
    main=JobOpening._meta.db_table
    through=[field.remote_field.through for field in JobOpening._meta.local_many_to_many]
    with connection.schema_editor() as editor:
        if main not in existing:
            editor.create_model(JobOpening)
        else:
            for model in through:
                if model._meta.db_table not in existing: editor.create_model(model)
    return True

def snapshot(user):
    authenticated=bool(user and getattr(user,'is_authenticated',False))
    settings=SiteSetting.get_solo()
    cats=list(Category.objects.all().order_by('id')); subs=list(Subcategory.objects.all().order_by('id')); childs=list(ChildCategory.objects.all().order_by('id')); papers=list(Paper.objects.all().order_by('id')); jobs=list(Job.objects.all().order_by('id')); years=list(JobYear.objects.all().order_by('id'))
    if is_super(user): mcqs_q=MCQ.objects.all()
    elif user_role(user)=='admin': mcqs_q=MCQ.objects.filter(Q(status='approved')|Q(created_by=user)|Q(submitted_by=user)).distinct()
    else: mcqs_q=MCQ.objects.filter(status='approved')
    mcqs=list(mcqs_q.select_related('category','created_by','submitted_by','reviewed_by','approved_by').order_by('-id'))
    own_attempts=list(Attempt.objects.filter(user=user).select_related('mcq').order_by('-created_at')[:500]) if authenticated else []
    own_bookmarks=list(Bookmark.objects.filter(user=user).values_list('mcq_id',flat=True)) if authenticated else []
    own_saved=list(SavedPaper.objects.filter(user=user).values_list('paper_id',flat=True)) if authenticated else []
    recent=[]
    for aid in [a.mcq_id for a in own_attempts]:
        if aid not in recent: recent.append(aid)
        if len(recent)>=15: break
    report_q=Report.objects.select_related('user','mcq') if (is_super(user) or has_perm(user,'view_reports')) else Report.objects.filter(user=user).select_related('user','mcq') if authenticated else Report.objects.none()
    logs_q=AuditLog.objects.select_related('user').order_by('-created_at')
    if not is_super(user): logs_q=logs_q.filter(user=user) if authenticated else logs_q.none()
    users=[]
    if is_super(user): users=[user_dict(x) for x in User.objects.all().order_by('id')]
    elif user_role(user)=='admin': users=[user_dict(user)]
    guides_q=Guide.objects.all() if is_admin(user) else Guide.objects.filter(published=True)
    posts_q=Post.objects.all() if is_admin(user) else Post.objects.filter(status='published')
    job_table_ready=job_opening_schema_ready()
    job_openings_q=(JobOpening.objects.all() if (is_admin(user) and has_perm(user,'manage_job_openings')) else JobOpening.objects.filter(status='published')) if job_table_ready else JobOpening.objects.none()
    now=timezone.now(); ads_q=AdPlacement.objects.filter(active=True).filter(Q(starts_at__isnull=True)|Q(starts_at__lte=now)).filter(Q(ends_at__isnull=True)|Q(ends_at__gte=now)).order_by('-priority','id')
    if is_super(user): ads_q=AdPlacement.objects.all().order_by('-priority','id')
    data={
        'schemaVersion':4,'categories':[category(x) for x in cats],'subcategories':[subcategory(x) for x in subs],'children':[child(x) for x in childs],'papers':[paper(x) for x in papers],'jobs':[job(x) for x in jobs],'years':[year(x) for x in years],'mcqs':[mcq(x) for x in mcqs],
        'bookmarks':own_bookmarks,'savedPapers':own_saved,'attempts':[{'id':a.mcq_id,'answer':a.answer,'correct':a.correct,'at':iso(a.created_at),'by_id':user.id,'by':user_name(user)} for a in own_attempts],'recent':recent,
        'reports':[{'id':r.id,'mcq_id':r.mcq_id,'reason':r.reason,'status':r.status,'by_id':r.user_id,'by':user_name(r.user) if r.user else 'Visitor','at':iso(r.created_at)} for r in report_q.order_by('-created_at')[:500]],
        'contacts':[{'id':c.id,'name':c.name,'email':c.email,'message':c.message,'at':iso(c.created_at)} for c in ContactMessage.objects.order_by('-created_at')[:300]] if is_super(user) else [],
        'logs':[{'id':x.id,'action':x.action,'detail':x.detail,'by':user_name(x.user) if x.user else 'System','by_id':x.user_id,'at':iso(x.created_at)} for x in logs_q[:500]],
        'trash':[{'id':x.id,'type':x.kind,'name':x.name,'mcqs':x.payload.get('mcqs',[]),'entities':x.payload.get('entities',{}),'deleted_at':iso(x.deleted_at),'deleted_by':user_name(x.deleted_by) if x.deleted_by else 'System','deleted_by_id':x.deleted_by_id} for x in TrashRecord.objects.order_by('-deleted_at')[:300]] if is_super(user) else [],
        'posts':[post(x) for x in posts_q.order_by('-updated_at')],'jobOpenings':[job_opening(x) for x in job_openings_q.order_by('-created_at')],'users':users,'guides':[guide(x) for x in guides_q.order_by('-updated_at')],
        'settings':{'siteName':settings.site_name,'description':settings.description,'country':settings.country,'requireReview':True,'cleanRoutesEnabled':False,'analyticsEnabled':settings.analytics_enabled,'googleAnalyticsId':settings.google_analytics_id,'adsenseEnabled':settings.adsense_enabled,'adsenseClientId':settings.adsense_client_id},
        'content':{'about':settings.about,'contact':settings.contact},'seo':{'title':settings.seo_title,'description':settings.seo_description},
        'rolePermissions':{'admin':{'review':bool(settings.admin_permissions.get('review',False)),'import':bool(settings.admin_permissions.get('import',False)),'permissions':settings.admin_permissions.get('permissions',{})}},
        'ads':[ad(x) for x in ads_q],
    }
    if is_super(user):
        perf=[]
        for a in User.objects.filter(profile__role__in=['admin','super-admin']).order_by('id'):
            created=MCQ.objects.filter(created_by=a).count(); pending=MCQ.objects.filter(created_by=a,status='pending').count(); approved=MCQ.objects.filter(created_by=a,status='approved').count(); rejected=MCQ.objects.filter(created_by=a,status='rejected').count(); reviewed=MCQ.objects.filter(reviewed_by=a).count(); actions=AuditLog.objects.filter(user=a).count(); last=AuditLog.objects.filter(user=a).order_by('-created_at').values_list('created_at',flat=True).first()
            perf.append({'id':a.id,'name':user_name(a),'email':a.email,'role':user_role(a),'status':'active' if a.is_active else 'disabled','mcqs_created':created,'pending':pending,'approved':approved,'rejected':rejected,'reviewed':reviewed,'actions':actions,'last_activity':iso(last)})
        data['adminPerformance']=perf
    else: data['adminPerformance']=[]
    return data

def parse_fields(payload):
    return {k:v for k,v in payload.get('fields',[])}, payload.get('values') or {}, payload.get('context') or {}, payload.get('draft') or {}

def normalize_ids(v):
    if v in (None,''): return []
    if isinstance(v,list): vals=v
    else:
        try: vals=json.loads(v)
        except Exception: vals=[v]
        if not isinstance(vals,list): vals=[vals]
    out=[]
    for x in vals:
        try:
            n=int(x)
            if n>0 and n not in out: out.append(n)
        except Exception: pass
    return out

def validate_mcq_data(d):
    req=['question','option1','option2','option3','option4','correct_answer']
    for k in req:
        if not str(d.get(k,'')).strip(): raise ValueError(f'{k.replace("_"," ").title()} is required.')
    opts=[str(d[f'option{i}']).strip() for i in range(1,5)]
    if str(d['correct_answer']).strip() not in opts: raise ValueError('Correct answer must exactly match one option.')
    cid=int(d.get('category_id') or 0)
    if not Category.objects.filter(pk=cid).exists(): raise ValueError('Choose a valid category.')
    return cid

def save_mcq(user,draft):
    require(is_admin(user) and has_perm(user,'add_mcq'))
    cid=validate_mcq_data(draft); qid=int(draft.get('id') or 0) or None
    existing=MCQ.objects.filter(pk=qid).first() if qid else None
    if existing:
        require(is_super(user) or existing.created_by_id==user.id or has_perm(user,'edit_any_mcq'))
    dup=MCQ.objects.filter(question__iexact=str(draft['question']).strip())
    if existing: dup=dup.exclude(pk=existing.pk)
    if dup.exists(): raise ValueError('A matching question already exists.')
    common={k:str(draft.get(k,'')).strip() for k in ['question','option1','option2','option3','option4','correct_answer','description','source','seo_description']}
    common.update(category_id=cid,subcategory_ids=normalize_ids(draft.get('subcategory_ids')),child_subcategory_ids=normalize_ids(draft.get('child_subcategory_ids')),paper_ids=normalize_ids(draft.get('paper_id')),job_ids=normalize_ids(draft.get('job_ids')),job_year_ids=normalize_ids(draft.get('job_years_ids')),important=bool(draft.get('important')),country=str(draft.get('country') or 'Pakistan'))
    now=timezone.now()
    if existing and existing.status=='approved' and not is_super(user):
        proposed={**mcq(existing),**common,'category_id':cid,'paper_id':common['paper_ids'],'job_years_ids':common['job_year_ids'],'updated_at':iso(now),'updated_by':user_name(user),'updated_by_id':user.id}
        existing.pending_update={'proposed':proposed,'submitted_by':user_name(user),'submitted_by_id':user.id,'submitted_at':iso(now),'approval_status':'pending','reason':''}; existing.submission_type='update'; existing.updated_by=user; existing.save(update_fields=['pending_update','submission_type','updated_by','updated_at']); log(user,'Submitted MCQ update',existing.question); return existing
    if not existing:
        existing=MCQ(id=next_id(MCQ),created_by=user,submitted_by=user,submitted_at=now,status='pending')
    for k,v in common.items(): setattr(existing,k,v)
    existing.updated_by=user; existing.submitted_by=user; existing.submitted_at=now; existing.submission_type='update' if existing.pk and MCQ.objects.filter(pk=existing.pk).exists() else 'new'
    if not is_super(user): existing.status='pending'
    existing.save(); log(user,'Saved MCQ',existing.question); return existing

def review_mcqs(user,ids,status,reason=''):
    require(is_super(user) or has_perm(user,'review_mcq'))
    ids=[int(x) for x in str(ids).split(',') if str(x).strip().isdigit()]
    if status not in {'approved','rejected','pending'}: raise ValueError('Invalid review status.')
    if status!='approved' and not str(reason).strip(): raise ValueError('A reason is required.')
    for q in MCQ.objects.filter(id__in=ids):
        if q.pending_update:
            pu=q.pending_update
            if status=='approved':
                p=pu.get('proposed') or {}
                for k in ['question','option1','option2','option3','option4','correct_answer','description','subcategory_ids','child_subcategory_ids','job_ids','important','source','seo_description','country']:
                    if k in p: setattr(q,k,p[k])
                if 'category_id' in p: q.category_id=int(p['category_id'])
                if 'paper_id' in p: q.paper_ids=normalize_ids(p['paper_id'])
                if 'job_years_ids' in p: q.job_year_ids=normalize_ids(p['job_years_ids'])
                q.pending_update=None; q.status='approved'; q.rejection_reason=''
            elif status=='rejected': q.pending_update=None; q.rejection_reason=reason
            else:
                pu['approval_status']='correction'; pu['reason']=reason; q.pending_update=pu
        else:
            q.status=status; q.rejection_reason='' if status=='approved' else reason
        q.reviewed_by=user
        if status=='approved': q.approved_by=user
        hist=q.audit_history or []; hist.insert(0,{'type':q.submission_type,'reviewed_by':user_name(user),'reviewed_by_id':user.id,'reviewed_at':iso(timezone.now()),'approval_status':status,'reason':reason}); q.audit_history=hist[:100]
        q.save(); log(user,f'MCQ {status}',q.question)

def save_entity(user,payload):
    fields,values,ctx,_=parse_fields(payload); typ=ctx.get('type'); require(typ in ENTITY_MODELS,'Invalid entity type.'); perm={'categories':'manage_categories','subcategories':'manage_subcategories','children':'manage_child_categories','papers':'manage_papers','jobs':'manage_jobs','years':'manage_job_years'}[typ]; require(is_admin(user) and has_perm(user,perm))
    model=ENTITY_MODELS[typ]; rid=int(ctx.get('id') or 0) or None; name=str(values.get('entity-name') or '').strip();
    if not name: raise ValueError('Name is required.')
    icon=str(values.get('entity-icon-data') or values.get('entity-icon') or 'grid').strip() or 'grid'; active='entity-active' in fields
    obj=model.objects.filter(pk=rid).first() if rid else None
    if not obj: obj=model(id=next_id(model),created_by=user)
    obj.name=name; obj.icon=icon; obj.active=active; obj.updated_by=user
    if typ=='papers': obj.country='Pakistan'
    if typ in ENTITY_PARENT:
        fk,_=ENTITY_PARENT[typ]; pid=int(values.get('entity-parent') or 0); require(pid>0,'Choose a valid parent.'); setattr(obj,fk,pid)
    obj.save(); log(user,f'Saved {typ}',name); return {'id':obj.id}

def save_user(user,payload):
    require(is_super(user)); _,v,c,_=parse_fields(payload); uid=int(c.get('id') or 0) or None; email=str(v.get('email') or '').strip().lower(); name=str(v.get('name') or '').strip(); role=v.get('role') or 'user'; status=v.get('status') or 'active'
    if not email or '@' not in email: raise ValueError('Valid email is required.')
    if role not in {'user','admin','super-admin'}: raise ValueError('Invalid role.')
    obj=User.objects.filter(pk=uid).first() if uid else User.objects.filter(email=email).first()
    if not obj: obj=User(email=email,username=email); obj.set_unusable_password()
    obj.email=email; obj.username=email; obj.first_name=name; obj.is_active=status=='active'; obj.is_staff=role in {'admin','super-admin'}; obj.is_superuser=role=='super-admin'; obj.save(); prof=profile_for(obj); prof.role=role;
    if role=='admin': prof.permissions=[k for k,vv in (SiteSetting.get_solo().admin_permissions.get('permissions') or {}).items() if vv]
    prof.save(); log(user,'Saved account',email); return {'id':obj.id}

def save_guide(user,payload):
    require(is_admin(user) and has_perm(user,'manage_guides')); _,v,c,_=parse_fields(payload); rid=int(c.get('id') or 0) or None; obj=Guide.objects.filter(pk=rid).first() if rid else Guide(created_by=user); obj.name=str(v.get('name') or '').strip(); obj.tag=str(v.get('tag') or 'STUDY SKILLS').strip(); obj.summary=str(v.get('summary') or ''); obj.body=str(v.get('body') or ''); obj.updated_by=user; obj.save(); log(user,'Saved guide',obj.name); return {'id':obj.id}

def save_post(user,payload):
    require(is_admin(user) and has_perm(user,'manage_posts')); _,v,c,_=parse_fields(payload); rid=int(c.get('id') or 0) or None; obj=Post.objects.filter(pk=rid).first() if rid else Post(created_by=user); obj.title=str(v.get('title') or '').strip(); obj.slug=slugify(str(v.get('slug') or obj.title))[:120] or f'post-{timezone.now().timestamp():.0f}'; obj.excerpt=str(v.get('excerpt') or ''); obj.body=str(v.get('body') or ''); obj.featured_image=str(v.get('featured_image') or ''); obj.category=str(v.get('category') or ''); obj.seo_title=str(v.get('seo_title') or ''); obj.seo_description=str(v.get('seo_description') or ''); obj.status=str(v.get('status') or 'draft'); links=[]
    for line in str(v.get('links') or '').splitlines():
        if '|' in line:
            label,url=[x.strip() for x in line.split('|',1)]; links.append({'label':label,'url':url})
    obj.links=links; obj.updated_by=user; obj.save(); log(user,'Saved post',obj.title); return {'id':obj.id}

def parse_optional_date(value):
    value=str(value or '').strip()
    if not value: return None
    try: return date.fromisoformat(value)
    except ValueError: raise ValueError('Use YYYY-MM-DD for job dates.')

def save_job_opening(user,payload):
    require(is_admin(user) and has_perm(user,'manage_job_openings'))
    ensure_job_opening_schema()
    fields,v,ctx,_=parse_fields(payload)
    rid=int(ctx.get('id') or 0) or None
    def multi(key):
        found=[value for name,value in payload.get('fields',[]) if name==key]
        return found if found else v.get(key)
    obj=JobOpening.objects.filter(pk=rid).first() if rid else JobOpening(created_by=user)
    title=str(v.get('title') or '').strip()
    if not title: raise ValueError('Job title is required.')
    slug=slugify(str(v.get('slug') or title))[:180] or f'job-{timezone.now().timestamp():.0f}'
    dup=JobOpening.objects.filter(slug=slug)
    if obj.pk: dup=dup.exclude(pk=obj.pk)
    if dup.exists(): slug=f'{slug}-{obj.pk or int(timezone.now().timestamp())}'
    obj.title=title; obj.slug=slug; obj.organization=str(v.get('organization') or '').strip()
    obj.category=str(v.get('category') or '').strip(); obj.advertisement_number=str(v.get('advertisement_number') or '').strip()
    vacancies=str(v.get('total_vacancies') or '').strip(); obj.total_vacancies=int(vacancies) if vacancies.isdigit() else None
    obj.location=str(v.get('location') or '').strip(); obj.qualification=str(v.get('qualification') or '')
    obj.experience_requirement=str(v.get('experience_requirement') or ''); obj.age_limit=str(v.get('age_limit') or '').strip()
    obj.gender=str(v.get('gender') or '').strip(); obj.domicile=str(v.get('domicile') or '').strip()
    obj.employment_type=str(v.get('employment_type') or '').strip(); obj.advertisement_date=parse_optional_date(v.get('advertisement_date'))
    obj.last_date=parse_optional_date(v.get('last_date')); obj.official_advertisement=str(v.get('official_advertisement') or '').strip()
    obj.official_apply_link=str(v.get('official_apply_link') or '').strip(); obj.recruiting_authority=str(v.get('recruiting_authority') or '').strip()
    obj.syllabus=str(v.get('syllabus') or ''); obj.eligibility_details=str(v.get('eligibility_details') or '')
    obj.important_instructions=str(v.get('important_instructions') or ''); obj.status=str(v.get('status') or 'draft')
    if obj.status not in {'draft','published','archived'}: raise ValueError('Invalid job publication status.')
    obj.updated_by=user; obj.save()
    for field,model,key in [
        ('related_mcqs',MCQ,'related_mcq_ids'),('related_categories',Category,'related_category_ids'),
        ('related_papers',Paper,'related_paper_ids'),('related_guides',Guide,'related_guide_ids'),
        ('related_posts',Post,'related_post_ids'),('related_jobs',Job,'related_job_ids')]:
        ids=normalize_ids(multi(key)); getattr(obj,field).set(model.objects.filter(pk__in=ids))
    log(user,'Saved job opening',obj.title)
    return {'id':obj.id,'slug':obj.slug}

def extract_ga(value):
    m=re.search(r'\bG-[A-Z0-9]+\b',str(value or ''),re.I); return m.group(0).upper() if m else ''
def extract_adsense(value):
    m=re.search(r'ca-pub-\d+',str(value or ''),re.I); return m.group(0).lower() if m else ''

def save_config(user,payload):
    require(is_super(user)); fields,v,c,_=parse_fields(payload); view=c.get('view'); s=SiteSetting.get_solo()
    if view=='settings': s.site_name=str(v.get('siteName') or 'MCQ Campus')[:120]; s.description=str(v.get('description') or ''); s.country=str(v.get('country') or 'Pakistan')[:80]
    elif view=='seo': s.seo_title=str(v.get('title') or 'MCQ Campus')[:160]; s.seo_description=str(v.get('description') or '')
    elif view=='content': s.about=str(v.get('about') or ''); s.contact=str(v.get('contact') or '')
    elif view=='roles':
        perms={k:('perm_'+k) in fields for k in PERMISSION_CATALOG}
        if 'review' in fields:
            for k in ['review_mcq','approve_mcq','reject_mcq']: perms[k]=True
        if 'import' in fields: perms['bulk_import_mcqs']=True
        s.admin_permissions={'review':'review' in fields,'import':'import' in fields,'permissions':perms}
        enabled=[k for k,vv in perms.items() if vv]
        Profile.objects.filter(role='admin').update(permissions=enabled)
    elif view=='monetization':
        ga=extract_ga(v.get('google_analytics_code') or v.get('google_analytics_id')); ad=extract_adsense(v.get('adsense_code') or v.get('adsense_client_id'))
        if (v.get('analytics_enabled') or 'analytics_enabled' in fields) and not ga: raise ValueError('Paste a valid Google Analytics snippet or G- measurement ID.')
        if (v.get('adsense_enabled') or 'adsense_enabled' in fields) and not ad: raise ValueError('Paste a valid AdSense snippet or ca-pub client ID.')
        s.google_analytics_id=ga; s.analytics_enabled='analytics_enabled' in fields; s.adsense_client_id=ad; s.adsense_enabled='adsense_enabled' in fields
    else: raise ValueError('Unknown settings section.')
    s.updated_by=user; s.save(); log(user,'Updated site settings',view); return True

def save_ad(user,payload):
    require(is_super(user)); fields,v,c,_=parse_fields(payload); rid=int(c.get('id') or 0) or None; obj=AdPlacement.objects.filter(pk=rid).first() if rid else AdPlacement(created_by=user)
    obj.name=str(v.get('name') or '').strip(); obj.provider=str(v.get('provider') or 'custom'); obj.placement=str(v.get('placement') or 'top_banner'); obj.title=str(v.get('title') or ''); obj.body=str(v.get('body') or ''); obj.image_url=str(v.get('image_url') or ''); obj.target_url=str(v.get('target_url') or ''); obj.adsense_slot=str(v.get('adsense_slot') or '').strip(); obj.priority=int(v.get('priority') or 0); obj.active='active' in fields; obj.updated_by=user
    if not obj.name: raise ValueError('Ad name is required.')
    if obj.provider=='adsense' and not obj.adsense_slot: raise ValueError('AdSense slot ID is required.')
    obj.save(); log(user,'Saved ad placement',obj.name); return {'id':obj.id}

def command(user,action,payload):
    if action=='attempt':
        qid,answer=payload.get('args',[None,None]); q=MCQ.objects.filter(pk=qid,status='approved').first();
        if not q: raise ValueError('Question not available.')
        correct=str(q.correct_answer)==str(answer); Attempt.objects.create(user=user,mcq=q,answer=str(answer),correct=correct); return correct
    if action=='toggleBookmark':
        qid=(payload.get('args') or [None])[0]; q=MCQ.objects.get(pk=qid); obj,created=Bookmark.objects.get_or_create(user=user,mcq=q); 
        if not created: obj.delete(); return False
        return True
    if action=='savePaper':
        pid=(payload.get('args') or [None])[0]; p=Paper.objects.get(pk=pid); obj,created=SavedPaper.objects.get_or_create(user=user,paper=p); 
        if not created: obj.delete(); return False
        return True
    if action=='report':
        qid,reason=payload.get('args',[None,'']); require(str(reason).strip(),'Enter a report reason.'); Report.objects.create(user=user,mcq=MCQ.objects.get(pk=qid),reason=str(reason)); return True
    if action=='saveProfile':
        vals=(payload.get('args') or [{}])[0] or {}; user.first_name=str(vals.get('name') or user_name(user)); new_email=str(vals.get('email') or user.email).strip().lower(); user.email=new_email; user.username=new_email; user.save(); prof=profile_for(user); prof.country=str(vals.get('country') or prof.country); prof.avatar=str(vals.get('avatar') or prof.avatar); prof.save(); return user_dict(user)
    if action=='changePassword':
        vals=(payload.get('args') or [{}])[0] or {}; require(user.check_password(vals.get('current_password','')),'Current password is incorrect.'); new=vals.get('new_password',''); require(len(new)>=8 and new==vals.get('confirm_password'),'New passwords do not match or are too short.'); user.set_password(new); user.save(); return True
    if action=='form:mcq': return {'id':save_mcq(user,payload.get('draft') or {}).id}
    if action=='form:review':
        _,v,c,_=parse_fields(payload); review_mcqs(user,c.get('ids',''),c.get('status','pending'),v.get('reason','')); return True
    if action=='form:entity': return save_entity(user,payload)
    if action=='form:user': return save_user(user,payload)
    if action=='form:guide': return save_guide(user,payload)
    if action=='form:post': return save_post(user,payload)
    if action=='form:job-opening': return save_job_opening(user,payload)
    if action=='form:config': return save_config(user,payload)
    if action=='form:ad': return save_ad(user,payload)
    if action=='form:contact':
        _,v,_,_=parse_fields(payload); ContactMessage.objects.create(user=user,name=str(v.get('name') or user_name(user)),email=str(v.get('email') or user.email),message=str(v.get('message') or '')); return True
    if action in {'form:profile','form:password-change'}:
        _,v,_,_=parse_fields(payload); return command(user,'saveProfile' if action=='form:profile' else 'changePassword',{'args':[v]})
    if action=='action:report-resolve':
        require(is_super(user) or has_perm(user,'resolve_reports')); rid=int(payload.get('id')); r=Report.objects.get(pk=rid); r.status='resolved'; r.resolved_at=timezone.now(); r.resolved_by=user; r.save(); log(user,'Resolved report',rid); return True
    if action=='action:user-status':
        require(is_super(user)); target=User.objects.get(pk=int(payload.get('id'))); target.is_active=not target.is_active; target.save(); return True
    if action=='action:ad-toggle':
        require(is_super(user)); obj=AdPlacement.objects.get(pk=int(payload.get('id'))); obj.active=not obj.active; obj.updated_by=user; obj.save(); return obj.active
    if action=='action:ad-delete':
        require(is_super(user)); obj=AdPlacement.objects.get(pk=int(payload.get('id'))); name=obj.name; obj.delete(); log(user,'Deleted ad placement',name); return True
    if action=='action:job-opening-delete-confirm':
        require(is_admin(user) and has_perm(user,'manage_job_openings')); obj=JobOpening.objects.get(pk=int(payload.get('id'))); name=obj.title; obj.delete(); log(user,'Deleted job opening',name); return True
    if action=='action:import-confirm':
        require(is_admin(user) and has_perm(user,'bulk_import_mcqs')); summary={'imported':0,'duplicates':0,'invalid':0,'failed':0}
        for row in payload.get('rows') or []:
            if row.get('status')!='valid' or not row.get('q'): continue
            try: save_mcq(user,row['q']); summary['imported']+=1
            except ValueError as e:
                if 'already exists' in str(e).lower(): summary['duplicates']+=1
                else: summary['failed']+=1
        return summary
    if action=='action:entity-delete-confirm':
        require(is_super(user)); typ=payload.get('type'); rid=int(payload.get('id')); model=ENTITY_MODELS.get(typ); require(model is not None,'Invalid entity.'); obj=model.objects.get(pk=rid); record={'id':obj.id,'name':obj.name,'icon':obj.icon,'active':obj.active}
        if typ=='subcategories': record['category_id']=obj.category_id
        if typ=='children': record['subcategory_id']=obj.subcategory_id
        if typ=='jobs': record['paper_id']=obj.paper_id
        if typ=='years': record['job_id']=obj.job_id
        tr=TrashRecord.objects.create(kind=typ,name=obj.name,payload={'entities':{typ:[record]},'mcqs':[]},deleted_by=user); obj.delete(); log(user,'Deleted '+typ,tr.name); return {'id':tr.id}
    if action in {'action:trash-restore','action:restore-trash'}:
        require(is_super(user)); tr=TrashRecord.objects.get(pk=int(payload.get('id'))); typ=tr.kind; model=ENTITY_MODELS.get(typ); rows=(tr.payload.get('entities') or {}).get(typ) or []
        for r in rows:
            kwargs={'id':r['id'],'name':r['name'],'icon':r.get('icon','grid'),'active':r.get('active',True),'created_by':user,'updated_by':user}
            if typ=='subcategories': kwargs['category_id']=r['category_id']
            if typ=='children': kwargs['subcategory_id']=r['subcategory_id']
            if typ=='jobs': kwargs['paper_id']=r['paper_id']
            if typ=='years': kwargs['job_id']=r['job_id']
            if typ=='papers': kwargs['country']='Pakistan'
            model.objects.update_or_create(id=r['id'],defaults=kwargs)
        name=tr.name; tr.delete(); log(user,'Recovered '+typ,name); return True
    raise ValueError('Unsupported command.')

def create_token(user,purpose,minutes=30):
    raw=secrets.token_urlsafe(32); h=hashlib.sha256(raw.encode()).hexdigest(); OneTimeToken.objects.create(user=user,purpose=purpose,token_hash=h,expires_at=timezone.now()+timedelta(minutes=minutes)); return raw

def consume_token(raw,purpose):
    h=hashlib.sha256(str(raw).encode()).hexdigest(); obj=OneTimeToken.objects.select_related('user').filter(token_hash=h,purpose=purpose,used_at__isnull=True,expires_at__gt=timezone.now()).first()
    if not obj: return None
    obj.used_at=timezone.now(); obj.save(update_fields=['used_at']); return obj.user
