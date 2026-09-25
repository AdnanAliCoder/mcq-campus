import hashlib, hmac, json, re, secrets
from datetime import datetime, timedelta
from django.conf import settings
from django.contrib.auth import password_validation
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import connection, transaction
from django.db.models import Count, Q, Max, Window
from django.utils import timezone
from django.utils.text import slugify
from .models import *
from .serializers import *

PERMISSION_CATALOG=['super_admin_permission','add_mcq','edit_own_mcq','edit_any_mcq','delete_own_mcq','delete_any_mcq','review_mcq','approve_mcq','reject_mcq','bulk_import_mcqs','manage_categories','manage_subcategories','manage_child_categories','manage_papers','manage_jobs','manage_job_years','manage_guides','delete_guides','manage_posts','publish_posts','delete_posts','manage_pdfs','delete_pdfs','manage_latest_jobs','delete_latest_jobs','manage_current_affairs','manage_seo','view_reports','resolve_reports','view_analytics','view_logs','manage_users','manage_admins','assign_roles','change_permissions','manage_settings','manage_footer','manage_legal_pages','manage_social_links','manage_ads','backup','restore_backup']
ENTITY_MODELS={'categories':Category,'subcategories':Subcategory,'children':ChildCategory,'papers':Paper,'jobs':Job,'years':JobYear}
ENTITY_PARENT={'subcategories':('category_id',Category),'children':('subcategory_id',Subcategory),'jobs':('paper_id',Paper),'years':('job_id',Job)}

BASE_ADMIN_PERMISSIONS={'add_mcq','edit_own_mcq'}
def is_super(u): return bool(u and u.is_authenticated and (user_role(u)=='super-admin' or 'super_admin_permission' in user_permissions(u)))
def is_admin(u): return bool(u and u.is_authenticated and user_role(u) in {'admin','super-admin'})
def has_perm(u,p): return is_super(u) or (user_role(u)=='admin' and p in BASE_ADMIN_PERMISSIONS)
def require(cond,msg='Your account does not have permission for this action.'):
    if not cond: raise PermissionError(msg)
def log(u,action,detail=''): AuditLog.objects.create(user=u if getattr(u,'is_authenticated',False) else None,action=action,detail=str(detail)[:5000])

def next_id(model): return (model.objects.order_by('-id').values_list('id',flat=True).first() or 0)+1

def _site_blob(settings=None):
    settings=settings or SiteSetting.get_solo()
    raw=settings.admin_permissions if isinstance(settings.admin_permissions,dict) else {}
    blob=raw.get('_site') or {}
    return dict(blob) if isinstance(blob,dict) else {}

def _save_site_blob(settings,blob):
    root=dict(settings.admin_permissions or {})
    root['_site']=blob
    settings.admin_permissions=root

def _profile_payload(profile):
    raw=str(profile.avatar or '')
    prefix='__MCQ_PROFILE__:'
    if raw.startswith(prefix):
        try:
            data=json.loads(raw[len(prefix):])
            return data if isinstance(data,dict) else {'avatar':''}
        except Exception: return {'avatar':''}
    return {'avatar':raw}

def _save_profile_payload(profile,values):
    data=_profile_payload(profile)
    for key in ['avatar','exam_goal','daily_goal','testsTaken','lastTestSummary']:
        if key in values: data[key]=values.get(key)
    if 'interests' in values:
        interests=values.get('interests')
        data['interests']=interests if isinstance(interests,list) else ([interests] if interests else [])
    profile.avatar='__MCQ_PROFILE__:'+json.dumps(data,separators=(',',':'))

def _parse_date(value,end=False):
    value=str(value or '').strip()
    if not value: return None
    try:
        dt=datetime.strptime(value,'%Y-%m-%d')
        if end: dt=dt+timedelta(days=1)-timedelta(seconds=1)
        return timezone.make_aware(dt,timezone.get_current_timezone())
    except Exception: return None

def _client_ad(x):
    return {'id':x.id,'brand':x.name,'provider':'direct' if x.provider=='custom' else x.provider,'placement':x.placement,'text':x.body or x.title,'image_url':x.image_url,'destination_url':x.target_url,'enabled':x.active,'start_date':x.starts_at.date().isoformat() if x.starts_at else '','end_date':x.ends_at.date().isoformat() if x.ends_at else '','priority':x.priority,'created_at':iso(x.created_at),'updated_at':iso(x.updated_at)}

def _entity_impact(typ,rid):
    sets={k:set() for k in ENTITY_MODELS}; sets[typ].add(int(rid))
    if typ=='categories':
        sets['subcategories'].update(Subcategory.objects.filter(category_id=rid).values_list('id',flat=True)); sets['children'].update(ChildCategory.objects.filter(subcategory_id__in=sets['subcategories']).values_list('id',flat=True))
    elif typ=='subcategories': sets['children'].update(ChildCategory.objects.filter(subcategory_id=rid).values_list('id',flat=True))
    elif typ=='papers':
        sets['jobs'].update(Job.objects.filter(paper_id=rid).values_list('id',flat=True)); sets['years'].update(JobYear.objects.filter(job_id__in=sets['jobs']).values_list('id',flat=True))
    elif typ=='jobs': sets['years'].update(JobYear.objects.filter(job_id=rid).values_list('id',flat=True))

    # Production uses PostgreSQL/Supabase. Keep relationship matching in SQL there so
    # deleting one taxonomy record never downloads/scans the entire MCQ table in Python.
    if connection.vendor=='postgresql':
        linked=Q()
        if sets['categories']: linked|=Q(category_id__in=sets['categories'])
        for field,key in [('subcategory_ids','subcategories'),('child_subcategory_ids','children'),('paper_ids','papers'),('job_ids','jobs'),('job_year_ids','years')]:
            for value in sets[key]: linked|=Q(**{field+'__contains':[int(value)]})
        matched=list(MCQ.objects.filter(linked).only(
            'id','question','option1','option2','option3','option4','correct_answer','description','category_id',
            'subcategory_ids','child_subcategory_ids','paper_ids','job_ids','job_year_ids','country','status',
            'important','source','seo_description','rejection_reason','submission_type','pending_update','audit_history'
        )) if linked.children else []
        return sets,matched

    # SQLite does not support JSONField contains lookups. This compatibility path is
    # only for local/tests; restrict selected columns so even the fallback stays light.
    matched=[]
    for q in MCQ.objects.only('id','category_id','subcategory_ids','child_subcategory_ids','paper_ids','job_ids','job_year_ids',
                              'question','option1','option2','option3','option4','correct_answer','description','country','status',
                              'important','source','seo_description','rejection_reason','submission_type','pending_update','audit_history'):
        linked=(q.category_id in sets['categories'] or bool(set(q.subcategory_ids or []) & sets['subcategories']) or bool(set(q.child_subcategory_ids or []) & sets['children']) or bool(set(q.paper_ids or []) & sets['papers']) or bool(set(q.job_ids or []) & sets['jobs']) or bool(set(q.job_year_ids or []) & sets['years']))
        if linked: matched.append(q)
    return sets,matched

def _serialize_entity(t,x):
    row={'id':x.id,'name':x.name,'icon':x.icon,'active':x.active}
    if t=='papers': row['country']=x.country
    if t=='subcategories': row['category_id']=x.category_id
    if t=='children': row['subcategory_id']=x.subcategory_id
    if t=='jobs': row['paper_id']=x.paper_id
    if t=='years': row['job_id']=x.job_id
    return row

def _serialize_mcq(x):
    return {'id':x.id,'question':x.question,'option1':x.option1,'option2':x.option2,'option3':x.option3,'option4':x.option4,'correct_answer':x.correct_answer,'description':x.description,'category_id':x.category_id,'subcategory_ids':x.subcategory_ids,'child_subcategory_ids':x.child_subcategory_ids,'paper_ids':x.paper_ids,'job_ids':x.job_ids,'job_year_ids':x.job_year_ids,'country':x.country,'status':x.status,'important':x.important,'source':x.source,'seo_description':x.seo_description,'rejection_reason':x.rejection_reason,'submission_type':x.submission_type,'pending_update':x.pending_update,'audit_history':x.audit_history}

def _delete_entity(user,typ,rid):
    require(is_super(user),'Only the Super Admin can permanently move taxonomy records to recovery.')
    model=ENTITY_MODELS.get(typ); require(model is not None,'Invalid entity.')
    root=model.objects.filter(pk=int(rid)).first()
    if root is None: return None
    sets,mcqs=_entity_impact(typ,int(rid)); entities={}
    for t,ids in sets.items(): entities[t]=[_serialize_entity(t,x) for x in ENTITY_MODELS[t].objects.filter(pk__in=ids)]
    mcq_rows=[_serialize_mcq(x) for x in mcqs]
    MCQ.objects.filter(pk__in=[x.id for x in mcqs]).delete()
    root.delete()
    tr=TrashRecord.objects.create(kind=typ,name=root.name,payload={'entities':entities,'mcqs':mcq_rows},deleted_by=user)
    log(user,'Deleted '+typ,f'{root.name} · {len(mcq_rows)} MCQ(s) moved to recovery')
    return tr

def _restore_trash(user,tr):
    require(is_super(user))
    entities=(tr.payload or {}).get('entities') or {}
    for typ in ['categories','papers','subcategories','jobs','children','years']:
        model=ENTITY_MODELS[typ]
        for r in entities.get(typ) or []:
            defaults={'name':r['name'],'icon':r.get('icon','grid'),'active':r.get('active',True),'created_by':user,'updated_by':user}
            if typ=='papers': defaults['country']=r.get('country') or 'Pakistan'
            if typ=='subcategories': defaults['category_id']=r['category_id']
            if typ=='children': defaults['subcategory_id']=r['subcategory_id']
            if typ=='jobs': defaults['paper_id']=r['paper_id']
            if typ=='years': defaults['job_id']=r['job_id']
            model.objects.update_or_create(id=r['id'],defaults=defaults)
    for r in (tr.payload or {}).get('mcqs') or []:
        defaults={k:r.get(k) for k in ['question','option1','option2','option3','option4','correct_answer','description','subcategory_ids','child_subcategory_ids','paper_ids','job_ids','job_year_ids','country','status','important','source','seo_description','rejection_reason','submission_type','pending_update','audit_history']}
        defaults['category_id']=r.get('category_id'); defaults['created_by']=user; defaults['updated_by']=user; defaults['submitted_by']=user; defaults['submitted_at']=timezone.now()
        MCQ.objects.update_or_create(id=r['id'],defaults=defaults)
    name=tr.name; kind=tr.kind; tr.delete(); log(user,'Recovered '+kind,name); return True


def _client_site_state(settings):
    site=_site_blob(settings)
    footer=site.get('footer') or {}; social=site.get('socialLinks') or {}; contact_cfg=site.get('contact') or {}; legal=site.get('legalPages') or {}; ad_cfg=site.get('adSettings') or {}; current=site.get('currentAffairsConfig') or {}
    role_root=settings.admin_permissions if isinstance(settings.admin_permissions,dict) else {}; perms=role_root.get('permissions') or {}
    return {
      'settings':{'siteName':settings.site_name,'description':settings.description,'country':settings.country,'mcqEntryCountry':site.get('mcqEntryCountry') or settings.country,'requireReview':True,'cleanRoutesEnabled':False,'analyticsEnabled':settings.analytics_enabled,'googleAnalyticsId':settings.google_analytics_id,'adsenseEnabled':settings.adsense_enabled,'adsenseClientId':settings.adsense_client_id,'footer':footer,'socialLinks':social,'contact':contact_cfg},
      'content':{'about':settings.about,'contact':settings.contact,'legalPages':legal},
      'seo':{'title':settings.seo_title,'description':settings.seo_description},
      'rolePermissions':{'admin':{'review':bool(role_root.get('review',False)),'import':bool(role_root.get('import',False)),'permissions':perms}},
      'adSettings':{'enabled':ad_cfg.get('enabled',True),'adsenseClient':settings.adsense_client_id or ad_cfg.get('adsenseClient',''),'analyticsId':settings.google_analytics_id or ad_cfg.get('analyticsId',''),'slots':ad_cfg.get('slots') or {}},
      'pdfs':site.get('pdfs') or [],'latestJobs':site.get('latestJobs') or [],'currentAffairsConfig':current,
    }

def _startup_site_state(settings):
    return {
      'settings':{'siteName':settings.site_name,'description':settings.description,'country':settings.country,'mcqEntryCountry':settings.country},
      'seo':{'title':settings.seo_title,'description':settings.seo_description},
    }

def startup_payload(user,session):
    settings=SiteSetting.objects.only('singleton','site_name','description','country','seo_title','seo_description').filter(pk=1).first()
    if settings is None: settings=SiteSetting.objects.create(pk=1)
    return {'snapshot':{'schemaVersion':9,**_startup_site_state(settings)},'user':user_identity_dict(user,session) if user and getattr(user,'is_authenticated',False) else None}

def public_content_data():
    now=timezone.now()
    ads_q=AdPlacement.objects.filter(active=True).filter(Q(starts_at__isnull=True)|Q(starts_at__lte=now)).filter(Q(ends_at__isnull=True)|Q(ends_at__gte=now)).order_by('-priority','id')
    return {
      'posts':[post(x) for x in Post.objects.filter(status='published').order_by('-updated_at')[:50]],
      'guides':[guide(x) for x in Guide.objects.filter(published=True).order_by('-updated_at')[:50]],
      'ads':[_client_ad(x) for x in ads_q[:50]],
    }

def public_resources_data():
    settings=SiteSetting.get_solo()
    state=_client_site_state(settings)
    return {k:state[k] for k in ['settings','seo','rolePermissions','adSettings']}

def public_catalog_data():
    settings=SiteSetting.get_solo(); state=_client_site_state(settings)
    return {k:state[k] for k in ['pdfs','latestJobs','currentAffairsConfig']}

def public_legal_data():
    settings=SiteSetting.get_solo(); state=_client_site_state(settings)
    return {'content':state['content']}


def visible_mcqs(user):
    if is_super(user): return MCQ.objects.all()
    if user_role(user)=='admin': return MCQ.objects.filter(Q(status='approved')|Q(created_by=user)|Q(submitted_by=user)).distinct()
    return MCQ.objects.filter(status='approved')

def mcq_page(user,page=1,page_size=50,filters=None):
    filters=filters or {}; page=max(1,int(page or 1)); page_size=max(1,min(int(page_size or 50),100))
    qs=visible_mcqs(user)
    if filters.get('status'): qs=qs.filter(status=str(filters['status']))
    if filters.get('category'):
        try: qs=qs.filter(category_id=int(filters['category']))
        except (TypeError,ValueError): pass
    if filters.get('search'): qs=qs.filter(question__icontains=str(filters['search']).strip())
    # JSON membership filters are supported by PostgreSQL/Supabase. Keep them optional.
    for key,field in [('paper','paper_ids'),('job','job_ids'),('year','job_year_ids')]:
        if filters.get(key):
            try: qs=qs.filter(**{field+'__contains':[int(filters[key])]})
            except (TypeError,ValueError): pass
    qs=qs.select_related('category','created_by','submitted_by','reviewed_by','approved_by').annotate(_page_total=Window(expression=Count('id'))).order_by('-id')
    start=(page-1)*page_size
    objects=list(qs[start:start+page_size])
    total=int(objects[0]._page_total) if objects else (qs.count() if page>1 else 0)
    rows=[mcq_list(x) for x in objects]
    return {'items':rows,'page':page,'pageSize':page_size,'total':total,'hasNext':start+len(rows)<total}

def snapshot(user):
    cats=list(Category.objects.select_related('created_by','updated_by').all().order_by('id'))
    subs=list(Subcategory.objects.select_related('created_by','updated_by').all().order_by('id'))
    childs=list(ChildCategory.objects.select_related('created_by','updated_by').all().order_by('id'))
    papers=list(Paper.objects.select_related('created_by','updated_by').all().order_by('id'))
    jobs=list(Job.objects.select_related('created_by','updated_by').all().order_by('id'))
    years=list(JobYear.objects.select_related('created_by','updated_by').all().order_by('id'))
    qs=MCQ.objects.filter(status='approved').select_related('category','created_by','submitted_by','reviewed_by','approved_by').annotate(_page_total=Window(expression=Count('id'))).order_by('-id')
    objects=list(qs[:20])
    total=int(objects[0]._page_total) if objects else 0
    rows=[mcq_list(x) for x in objects]
    return {
      'schemaVersion':9,
      'categories':[category(x) for x in cats],'subcategories':[subcategory(x) for x in subs],'children':[child(x) for x in childs],
      'papers':[paper(x) for x in papers],'jobs':[job(x) for x in jobs],'years':[year(x) for x in years],
      'mcqs':rows,'mcqPage':{'page':1,'pageSize':20,'total':total,'hasNext':len(rows)<total},
    }

def learner_dashboard_data(user):
    require(bool(user and getattr(user,'is_authenticated',False)))
    attempts=list(Attempt.objects.filter(user=user).order_by('-created_at')[:100])
    bookmarks=list(Bookmark.objects.filter(user=user).values_list('mcq_id',flat=True))
    saved=list(SavedPaper.objects.filter(user=user).values_list('paper_id',flat=True))
    return {
        'attempts':[{'id':a.mcq_id,'answer':a.answer,'correct':a.correct,'at':iso(a.created_at),'by_id':user.id,'by':user_name(user)} for a in attempts],
        'bookmarks':bookmarks,
        'savedPapers':saved,
    }

def admin_overview_data(user,active_role=None):
    require(is_admin(user))
    super_view=is_super(user) and active_role=='super-admin'
    if super_view:
        qs=MCQ.objects.all()
    else:
        qs=MCQ.objects.filter(created_by=user)
    counts=qs.aggregate(
        total=Count('id'),
        pending=Count('id',filter=Q(status='pending')),
        approved=Count('id',filter=Q(status='approved')),
        rejected=Count('id',filter=Q(status='rejected')),
    )
    recent=[mcq_list(x) for x in qs.select_related('category','created_by','submitted_by','reviewed_by','approved_by').order_by('-updated_at','-id')[:6]]
    data={'mcqs':counts,'recent':recent,'openReports':0,'staff':0,'staffPreview':[],'learners':0,'trash':0}
    if super_view:
        data['openReports']=Report.objects.exclude(status__in=['resolved','closed']).count()
        people=User.objects.aggregate(total=Count('id'),staff=Count('id',filter=Q(profile__role__in=['admin','super-admin'])))
        data['staff']=people['staff'] or 0; data['learners']=(people['total'] or 0)-data['staff']; data['trash']=TrashRecord.objects.count()
        staff=User.objects.select_related('profile').filter(profile__role__in=['admin','super-admin']).order_by('id')[:4]
        data['staffPreview']=[{'id':x.id,'name':user_name(x),'email':x.email,'role':user_role(x)} for x in staff]
    elif has_perm(user,'view_reports'):
        data['openReports']=Report.objects.exclude(status__in=['resolved','closed']).count()
    return data

def admin_users_data(user,page=1,page_size=50):
    require(is_super(user) or has_perm(user,'manage_users') or has_perm(user,'manage_admins'))
    page=max(1,int(page or 1)); page_size=max(1,min(int(page_size or 50),100))
    qs=User.objects.select_related('profile').order_by('id')
    total=qs.count(); start=(page-1)*page_size
    return {'items':[user_admin_dict(x) for x in qs[start:start+page_size]],'page':page,'pageSize':page_size,'total':total,'hasNext':start+page_size<total}

def admin_reports_data(user,page=1,page_size=50):
    require(is_super(user) or has_perm(user,'view_reports'))
    page=max(1,int(page or 1)); page_size=max(1,min(int(page_size or 50),100))
    qs=Report.objects.select_related('user','mcq').order_by('-created_at')
    total=qs.count(); start=(page-1)*page_size
    reports=[{'id':r.id,'mcq_id':r.mcq_id,'question':r.mcq.question if r.mcq else '','reason':r.reason,'status':r.status,'by_id':r.user_id,'by':user_name(r.user) if r.user else 'Visitor','at':iso(r.created_at)} for r in qs[start:start+page_size]]
    contacts=[]
    if is_super(user) and page==1:
        contacts=[{'id':x.id,'name':x.name,'email':x.email,'message':x.message,'at':iso(x.created_at)} for x in ContactMessage.objects.order_by('-created_at')[:50]]
    return {'items':reports,'contacts':contacts,'page':page,'pageSize':page_size,'total':total,'hasNext':start+page_size<total}

def admin_trash_data(user,page=1,page_size=50):
    require(is_super(user))
    page=max(1,int(page or 1)); page_size=max(1,min(int(page_size or 50),100))
    qs=TrashRecord.objects.select_related('deleted_by').order_by('-deleted_at')
    total=qs.count(); start=(page-1)*page_size
    items=[{'id':x.id,'type':x.kind,'name':x.name,'mcqs':(x.payload or {}).get('mcqs',[]),'entities':(x.payload or {}).get('entities',{}),'deleted_at':iso(x.deleted_at),'deleted_by':user_name(x.deleted_by) if x.deleted_by else 'System','deleted_by_id':x.deleted_by_id} for x in qs[start:start+page_size]]
    return {'items':items,'page':page,'pageSize':page_size,'total':total,'hasNext':start+page_size<total}

def admin_logs_data(user,page=1,page_size=50):
    require(is_super(user) or has_perm(user,'view_logs'))
    page=max(1,int(page or 1)); page_size=max(1,min(int(page_size or 50),100))
    qs=AuditLog.objects.select_related('user').order_by('-created_at')
    if not is_super(user): qs=qs.filter(user=user)
    total=qs.count(); start=(page-1)*page_size
    items=[{'id':x.id,'action':x.action,'detail':x.detail,'by':user_name(x.user) if x.user else 'System','by_id':x.user_id,'at':iso(x.created_at)} for x in qs[start:start+page_size]]
    return {'items':items,'page':page,'pageSize':page_size,'total':total,'hasNext':start+page_size<total}

def admin_content_data(user):
    require(is_admin(user))
    posts_q=Post.objects.all() if has_perm(user,'manage_posts') or is_super(user) else Post.objects.filter(status='published')
    guides_q=Guide.objects.all() if has_perm(user,'manage_guides') or is_super(user) else Guide.objects.filter(published=True)
    ads_q=AdPlacement.objects.all().order_by('-priority','id') if has_perm(user,'manage_ads') or is_super(user) else AdPlacement.objects.none()
    return {'posts':[post(x) for x in posts_q.order_by('-updated_at')[:100]],'guides':[guide(x) for x in guides_q.order_by('-updated_at')[:100]],'ads':[_client_ad(x) for x in ads_q[:100]]}

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
    job_ids=normalize_ids(draft.get('job_ids'))
    common.update(category_id=cid,subcategory_ids=normalize_ids(draft.get('subcategory_ids')),child_subcategory_ids=normalize_ids(draft.get('child_subcategory_ids')),paper_ids=normalize_ids(draft.get('paper_id')),job_ids=job_ids,job_year_ids=normalize_ids(draft.get('job_years_ids')),important=len(set(job_ids))>=2,country=str(draft.get('country') or 'Pakistan'))
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
        q.important=len(set(q.job_ids or []))>=2
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
    if typ=='papers': obj.country=str(values.get('entity-country') or 'Pakistan')[:80]
    if typ in ENTITY_PARENT:
        fk,_=ENTITY_PARENT[typ]; pid=int(values.get('entity-parent') or 0); require(pid>0,'Choose a valid parent.'); setattr(obj,fk,pid)
    obj.save(); log(user,f'Saved {typ}',name); return {'type':typ,'entity':_serialize_entity(typ,obj)}

def _normalize_email(value):
    email=str(value or '').strip().lower()
    try: validate_email(email)
    except ValidationError: raise ValueError('Enter a valid email address.')
    return email

def _validate_password(password,user=None):
    try: password_validation.validate_password(str(password or ''),user=user)
    except ValidationError as exc: raise ValueError(' '.join(exc.messages))

def _active_super_admins(exclude_id=None):
    qs=User.objects.filter(is_active=True,is_superuser=True)
    if exclude_id: qs=qs.exclude(pk=exclude_id)
    return qs.exists()

def _invalidate_user_sessions(user_id):
    for session in Session.objects.filter(expire_date__gte=timezone.now()).iterator():
        try:
            if str(session.get_decoded().get('_auth_user_id'))==str(user_id): session.delete()
        except Exception:
            continue

def save_user(user,payload):
    require(is_super(user)); fields,v,c,_=parse_fields(payload); uid=int(c.get('id') or 0) or None
    email=_normalize_email(v.get('email')); name=str(v.get('name') or '').strip(); role=v.get('role') or 'user'; status=v.get('status') or 'active'
    if role not in {'user','admin','super-admin'}: raise ValueError('Invalid role.')
    obj=User.objects.filter(pk=uid).first() if uid else User.objects.filter(email__iexact=email).first()
    creating=obj is None
    if creating:
        obj=User(email=email,username=email); obj.set_unusable_password()
    old_role=user_role(obj) if not creating else 'user'; old_active=obj.is_active if not creating else False
    if not creating and old_role=='super-admin' and (role!='super-admin' or status!='active'):
        require(obj.pk!=user.pk,'You cannot demote or disable the Super Admin account you are currently using.')
        require(_active_super_admins(exclude_id=obj.pk),'At least one active Super Admin must remain.')
    duplicate=User.objects.exclude(pk=obj.pk).filter(email__iexact=email).exists() if obj.pk else User.objects.filter(email__iexact=email).exists()
    require(not duplicate,'That email is already in use.')
    obj.email=email; obj.username=email; obj.first_name=name; obj.is_active=status=='active'; obj.is_staff=role in {'admin','super-admin'}; obj.is_superuser=role=='super-admin'; obj.save()
    prof=profile_for(obj); prof.role=role
    if role=='admin': prof.permissions=['super_admin_permission'] if 'super_admin_permission' in fields else list(BASE_ADMIN_PERMISSIONS)
    elif role=='super-admin': prof.permissions=list(PERMISSION_CATALOG)
    else: prof.permissions=[]
    prof.save()
    if old_active and not obj.is_active: _invalidate_user_sessions(obj.pk)
    log(user,'Saved account',email); return {'user':user_admin_dict(obj)}

def save_guide(user,payload):
    require(is_admin(user) and has_perm(user,'manage_guides')); _,v,c,_=parse_fields(payload); rid=int(c.get('id') or 0) or None; obj=Guide.objects.filter(pk=rid).first() if rid else Guide(created_by=user); obj.name=str(v.get('name') or '').strip(); obj.tag=str(v.get('tag') or 'STUDY SKILLS').strip(); obj.summary=str(v.get('summary') or ''); obj.body=str(v.get('body') or ''); obj.updated_by=user; obj.save(); log(user,'Saved guide',obj.name); return {'guide':guide(obj)}

def save_post(user,payload):
    require(is_admin(user) and has_perm(user,'manage_posts')); _,v,c,_=parse_fields(payload); rid=int(c.get('id') or 0) or None; obj=Post.objects.filter(pk=rid).first() if rid else Post(created_by=user)
    obj.title=str(v.get('title') or '').strip(); require(obj.title,'Post title is required.')
    obj.slug=slugify(str(v.get('slug') or obj.title))[:120] or f'post-{timezone.now().timestamp():.0f}'
    if Post.objects.exclude(pk=obj.pk).filter(slug=obj.slug).exists(): obj.slug=f'{obj.slug[:105]}-{int(timezone.now().timestamp())}'
    obj.body=str(v.get('body') or '').strip(); require(obj.body,'Blog content is required.'); obj.excerpt=re.sub(r'\s+',' ',obj.body).strip()[:180]; image_data=str(v.get('featured_image_data') or ''); image_url=str(v.get('featured_image') or ''); obj.featured_image=image_url if image_url.startswith(('http://','https://')) else ''; obj.category=obj.category or 'Exam preparation'; obj.seo_title=obj.title[:80]; obj.seo_description=obj.excerpt[:300]; obj.status='published'; links=[]
    for line in str(v.get('links') or '').splitlines():
        if '|' in line:
            label,url=[x.strip() for x in line.split('|',1)]; links.append({'label':label,'url':url})
    if image_data.startswith('data:image/'): links.append({'label':'__featured_image_data','url':image_data})
    obj.links=links; obj.updated_by=user; obj.save(); log(user,'Saved post',obj.title); return {'post':post(obj)}

def extract_ga(value):
    m=re.search(r'\bG-[A-Z0-9]+\b',str(value or ''),re.I); return m.group(0).upper() if m else ''
def extract_adsense(value):
    m=re.search(r'ca-pub-\d+',str(value or ''),re.I); return m.group(0).lower() if m else ''

def save_config(user,payload):
    require(is_super(user)); fields,v,c,_=parse_fields(payload); view=c.get('view'); s=SiteSetting.get_solo(); blob=_site_blob(s)
    if view=='settings':
        s.site_name=str(v.get('siteName') or 'MCQ Campus')[:120]; s.description=str(v.get('description') or ''); s.country=str(v.get('country') or 'Pakistan')[:80]; blob['mcqEntryCountry']=str(v.get('country') or s.country)[:80]
    elif view=='seo': s.seo_title=str(v.get('title') or 'MCQ Campus')[:160]; s.seo_description=str(v.get('description') or '')
    elif view=='content': s.about=str(v.get('about') or ''); s.contact=str(v.get('contact') or '')
    elif view=='roles':
        perms={k:('perm_'+k) in fields for k in PERMISSION_CATALOG}
        if 'review' in fields:
            for k in ['review_mcq','approve_mcq','reject_mcq']: perms[k]=True
        if 'import' in fields: perms['bulk_import_mcqs']=True
        root=dict(s.admin_permissions or {}); root.update({'review':'review' in fields,'import':'import' in fields,'permissions':perms}); root['_site']=blob; s.admin_permissions=root
        enabled=[k for k,vv in perms.items() if vv]; Profile.objects.filter(role='admin').update(permissions=enabled)
    elif view=='monetization':
        ga=extract_ga(v.get('google_analytics_code') or v.get('google_analytics_id')); ad=extract_adsense(v.get('adsense_code') or v.get('adsense_client_id'))
        s.google_analytics_id=ga; s.analytics_enabled='analytics_enabled' in fields; s.adsense_client_id=ad; s.adsense_enabled='adsense_enabled' in fields
    else: raise ValueError('Unknown settings section.')
    if view!='roles': _save_site_blob(s,blob)
    s.updated_by=user; s.save(); log(user,'Updated site settings',view); return True

def _parse_bulk_label(raw,default_icon='grid'):
    text=str(raw or '').strip()
    m=re.match(r'^\{([^}]+)\}\s*(.+)
    fields,v,c,_=parse_fields(payload); s=SiteSetting.get_solo(); blob=_site_blob(s); now=timezone.now().isoformat()
    if form=='footer-settings':
        require(is_super(user) or has_perm(user,'manage_footer')); old=blob.get('footer') or {}; footer=dict(old)
        for k in ['description','copyrightText','footerLogoUrl','countryText']: footer[k]=str(v.get(k) or '')
        for k in ['showCountryText','showAbout','showContact','showPrivacy','showTerms','showDisclaimer','showCookiePolicy','showAdvertisingPolicy','showFaq','showSitemap']: footer[k]=k in fields
        blob['footer']=footer; contact=dict(blob.get('contact') or {}); contact['supportEmail']=str(v.get('supportEmail') or ''); contact['advertisingContact']=str(v.get('advertisingContact') or ''); blob['contact']=contact
    elif form=='social-links':
        require(is_super(user) or has_perm(user,'manage_social_links')); social={}
        for key in ['facebook','youtube','instagram','linkedin','x']:
            social[key]={'url':str(v.get(key+'_url') or ''),'icon':str(v.get(key+'_icon') or key),'iconData':str(v.get(key+'_icon_data') or ''),'enabled':key+'_enabled' in fields}
        email=str(v.get('footer_email') or '').strip()
        if email and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email): raise ValueError('Enter a valid footer email address.')
        social['email']={'address':email,'enabled':'footer_email_enabled' in fields}
        blob['socialLinks']=social
    elif form=='legal-page':
        require(is_super(user) or has_perm(user,'manage_legal_pages')); key=str(c.get('page') or 'about'); require(key in {'about','contact','privacy','terms','disclaimer','cookies','advertising'},'Invalid page.'); pages=dict(blob.get('legalPages') or {}); content=str(v.get('content') or ''); title=str(v.get('title') or '').strip(); require(title and content,'Title and page content are required.'); pages[key]={'title':title,'content':content,'lastUpdated':str(v.get('lastUpdated') or timezone.now().date().isoformat()),'published':'published' in fields,'seoTitle':title[:80],'metaDescription':re.sub(r'[#*\-]+',' ',content).strip()[:155]}; blob['legalPages']=pages
    elif form=='ad-config':
        require(is_super(user) or has_perm(user,'manage_ads')); ad=extract_adsense(v.get('adsenseClient')); ga=extract_ga(v.get('analyticsId')); slots={k[5:]:str(val or '') for k,val in v.items() if k.startswith('slot_')}; blob['adSettings']={'enabled':'enabled' in fields,'adsenseClient':ad,'analyticsId':ga,'slots':slots}; s.adsense_client_id=ad; s.adsense_enabled=bool(ad) and 'enabled' in fields; s.google_analytics_id=ga; s.analytics_enabled=bool(ga)
    elif form=='direct-ad':
        require(is_super(user) or has_perm(user,'manage_ads')); brand=str(v.get('brand') or '').strip(); require(brand,'Brand name is required.'); obj=AdPlacement(name=brand,provider='custom',placement=str(v.get('placement') or 'home_ad'),title=brand,body=str(v.get('text') or ''),image_url=str(v.get('image_url') or ''),target_url=str(v.get('destination_url') or ''),active=True,starts_at=_parse_date(v.get('start_date')),ends_at=_parse_date(v.get('end_date'),True),created_by=user,updated_by=user); obj.save(); log(user,'Saved direct ad',brand); return {'id':obj.id}
    elif form=='pdf':
        require(is_super(user) or has_perm(user,'manage_pdfs')); rows=list(blob.get('pdfs') or []); rid=int(c.get('id') or 0); old=next((x for x in rows if int(x.get('id',0))==rid),None); title=str(v.get('title') or '').strip(); require(title,'PDF Title is required.'); download=str(v.get('pdf_file_data') or v.get('download_url') or (old or {}).get('download_url') or '').strip(); require(download,'Choose a PDF file or enter a Download URL.'); new={'id':rid or max([int(x.get('id',0)) for x in rows]+[0])+1,'title':title,'slug':slugify(title),'description':str(v.get('description') or ''),'download_url':download,'cover':str(v.get('cover_data') or v.get('cover') or (old or {}).get('cover') or ''),'active':True,'created_at':(old or {}).get('created_at') or now,'created_by':(old or {}).get('created_by') or user_name(user),'created_by_id':(old or {}).get('created_by_id') or user.id,'updated_at':now,'updated_by':user_name(user),'updated_by_id':user.id}
        rows=[new if int(x.get('id',0))==new['id'] else x for x in rows] if old else [new]+rows; blob['pdfs']=rows
    elif form=='latest-job':
        require(is_super(user) or has_perm(user,'manage_latest_jobs')); rows=list(blob.get('latestJobs') or []); rid=int(c.get('id') or 0); old=next((x for x in rows if int(x.get('id',0))==rid),None); paper_id=int(v.get('paper_id') or 0); require(Paper.objects.filter(pk=paper_id).exists(),'Choose a valid Organization / Paper.'); title=str(v.get('title') or '').strip(); last=str(v.get('last_date') or '').strip(); require(title and last,'Job Title and Last Date are required.'); new={'id':rid or max([int(x.get('id',0)) for x in rows]+[0])+1,'paper_id':paper_id,'title':title,'slug':slugify(title),'last_date':last,'apply_url':str(v.get('apply_url') or ''),'published':'published' in fields,'created_at':(old or {}).get('created_at') or now,'created_by':(old or {}).get('created_by') or user_name(user),'created_by_id':(old or {}).get('created_by_id') or user.id,'updated_at':now,'updated_by':user_name(user),'updated_by_id':user.id}; rows=[new if int(x.get('id',0))==new['id'] else x for x in rows] if old else [new]+rows; blob['latestJobs']=rows
    elif form=='bulk-categories':
        require(is_admin(user) and has_perm(user,'manage_categories')); count=0
        for raw in str(v.get('categories') or '').splitlines():
            line=raw.strip()
            if not line: continue
            name,ic=_parse_bulk_label(line,'grid')
            if not name: continue
            obj=Category.objects.filter(name__iexact=name).first()
            if not obj: Category.objects.create(id=next_id(Category),name=name,icon=ic,created_by=user,updated_by=user)
            elif ic!='grid' and obj.icon!=ic: obj.icon=ic; obj.updated_by=user; obj.save(update_fields=['icon','updated_by','updated_at'])
            count+=1
        log(user,'Bulk category import',f'{count} line(s) processed'); return {'processed':count}
    elif form=='bulk-hierarchy':
        require(is_admin(user) and has_perm(user,'manage_papers') and has_perm(user,'manage_jobs') and has_perm(user,'manage_job_years')); count=0
        for raw in str(v.get('hierarchy') or '').splitlines():
            parts=[x.strip() for x in re.split(r'\s*(?:\||>)\s*',raw.strip()) if x.strip()]
            if len(parts)!=3: continue
            pn,pi=_parse_bulk_label(parts[0],'paper'); jn,ji=_parse_bulk_label(parts[1],'grid'); yn,yi=_parse_bulk_label(parts[2],'grid')
            p=Paper.objects.filter(name__iexact=pn).first()
            if not p: p=Paper.objects.create(id=next_id(Paper),name=pn,country=s.country,icon=pi,created_by=user,updated_by=user)
            elif pi!='paper' and p.icon!=pi: p.icon=pi; p.updated_by=user; p.save(update_fields=['icon','updated_by','updated_at'])
            j=Job.objects.filter(paper=p,name__iexact=jn).first()
            if not j: j=Job.objects.create(id=next_id(Job),paper=p,name=jn,icon=ji,created_by=user,updated_by=user)
            elif ji!='grid' and j.icon!=ji: j.icon=ji; j.updated_by=user; j.save(update_fields=['icon','updated_by','updated_at'])
            y=JobYear.objects.filter(job=j,name__iexact=yn).first()
            if not y: JobYear.objects.create(id=next_id(JobYear),job=j,name=yn,icon=yi,created_by=user,updated_by=user)
            elif yi!='grid' and y.icon!=yi: y.icon=yi; y.updated_by=user; y.save(update_fields=['icon','updated_by','updated_at'])
            count+=1
        log(user,'Bulk hierarchy import',f'{count} line(s) processed'); return {'processed':count}
    else: raise ValueError('Unsupported site form.')
    _save_site_blob(s,blob); s.updated_by=user; s.save(); log(user,'Updated '+form,form); return True

def save_ad(user,payload):
    require(is_super(user)); fields,v,c,_=parse_fields(payload); rid=int(c.get('id') or 0) or None; obj=AdPlacement.objects.filter(pk=rid).first() if rid else AdPlacement(created_by=user)
    obj.name=str(v.get('name') or '').strip(); obj.provider=str(v.get('provider') or 'custom'); obj.placement=str(v.get('placement') or 'top_banner'); obj.title=str(v.get('title') or ''); obj.body=str(v.get('body') or ''); obj.image_url=str(v.get('image_url') or ''); obj.target_url=str(v.get('target_url') or ''); obj.adsense_slot=str(v.get('adsense_slot') or '').strip(); obj.priority=int(v.get('priority') or 0); obj.active='active' in fields; obj.updated_by=user
    if not obj.name: raise ValueError('Ad name is required.')
    if obj.provider=='adsense' and not obj.adsense_slot: raise ValueError('AdSense slot ID is required.')
    obj.save(); log(user,'Saved ad placement',obj.name); return {'ad':ad(obj)}

def command(user,action,payload):
    if action=='attempt':
        qid,answer=payload.get('args',[None,None]); q=MCQ.objects.filter(pk=qid,status='approved').first();
        if not q: raise ValueError('Question not available.')
        correct=str(q.correct_answer)==str(answer); Attempt.objects.create(user=user,mcq=q,answer=str(answer),correct=correct); return correct
    if action=='toggleBookmark':
        qid=(payload.get('args') or [None])[0]; q=MCQ.objects.get(pk=qid); obj,created=Bookmark.objects.get_or_create(user=user,mcq=q)
        if not created: obj.delete(); return False
        return True
    if action=='savePaper':
        pid=(payload.get('args') or [None])[0]; p=Paper.objects.get(pk=pid); obj,created=SavedPaper.objects.get_or_create(user=user,paper=p)
        if not created: obj.delete(); return False
        return True
    if action=='report':
        qid,reason=payload.get('args',[None,'']); require(str(reason).strip(),'Enter a report reason.'); r=Report.objects.create(user=user,mcq=MCQ.objects.get(pk=qid),reason=str(reason)); return {'report':{'id':r.id,'mcq_id':r.mcq_id,'reason':r.reason,'status':r.status,'by_id':user.id,'by':user_name(user),'at':iso(r.created_at)}}
    if action=='saveProfile':
        vals=(payload.get('args') or [{}])[0] or {}; user.first_name=str(vals.get('name') or user_name(user)); new_email=str(vals.get('email') or user.email).strip().lower(); require('@' in new_email,'Enter a valid email.'); require(not User.objects.exclude(pk=user.pk).filter(email=new_email).exists(),'That email is already in use.'); user.email=new_email; user.username=new_email; user.save(); prof=profile_for(user); prof.country=str(vals.get('country') or prof.country); _save_profile_payload(prof,vals); prof.save(); return user_profile_dict(user)
    if action=='changePassword':
        vals=(payload.get('args') or [{}])[0] or {}; require(user.check_password(vals.get('current_password','')),'Current password is incorrect.'); new=str(vals.get('new_password') or ''); require(new==vals.get('confirm_password'),'New passwords do not match.'); _validate_password(new,user); user.set_password(new); user.save(); return True
    if action=='form:mcq':
        obj=save_mcq(user,payload.get('draft') or {}); return {'mcq':mcq(MCQ.objects.select_related('category','created_by','submitted_by','reviewed_by','approved_by').get(pk=obj.pk))}
    if action=='form:review':
        _,v,c,_=parse_fields(payload); ids=[int(x) for x in str(c.get('ids','')).split(',') if str(x).strip().isdigit()]; review_mcqs(user,c.get('ids',''),c.get('status','pending'),v.get('reason','')); rows=MCQ.objects.filter(pk__in=ids).select_related('category','created_by','submitted_by','reviewed_by','approved_by'); return {'mcqs':[mcq(x) for x in rows]}
    if action=='form:entity': return save_entity(user,payload)
    if action=='form:user': return save_user(user,payload)
    if action=='form:guide': return save_guide(user,payload)
    if action=='form:post': return save_post(user,payload)
    if action=='form:config': return save_config(user,payload)
    if action=='form:pdf':
        save_site_form(user,'pdf',payload); return {'pdfs':_site_blob(SiteSetting.get_solo()).get('pdfs') or []}
    if action=='form:latest-job':
        save_site_form(user,'latest-job',payload); return {'latestJobs':_site_blob(SiteSetting.get_solo()).get('latestJobs') or []}
    if action in {'form:footer-settings','form:social-links','form:legal-page','form:ad-config','form:direct-ad','form:bulk-hierarchy','form:bulk-categories'}: return save_site_form(user,action[5:],payload)
    if action=='form:ad': return save_ad(user,payload)
    if action=='form:contact':
        _,v,_,_=parse_fields(payload); ContactMessage.objects.create(user=user,name=str(v.get('name') or user_name(user)),email=str(v.get('email') or user.email),message=str(v.get('message') or '')); return True
    if action in {'form:profile','form:password-change'}:
        _,v,_,_=parse_fields(payload); return command(user,'saveProfile' if action=='form:profile' else 'changePassword',{'args':[v]})
    if action=='action:report-resolve':
        require(is_super(user) or has_perm(user,'resolve_reports')); rid=int(payload.get('id')); r=Report.objects.get(pk=rid); r.status='resolved'; r.resolved_at=timezone.now(); r.resolved_by=user; r.save(); log(user,'Resolved report',rid); return {'report':{'id':r.id,'mcq_id':r.mcq_id,'reason':r.reason,'status':r.status,'by_id':r.user_id,'by':user_name(r.user) if r.user else 'Visitor','at':iso(r.created_at)}}
    if action=='action:user-status':
        require(is_super(user)); target=User.objects.get(pk=int(payload.get('id')))
        enabling=not target.is_active
        if not enabling:
            require(target.pk!=user.pk,'You cannot disable the account you are currently using.')
            if user_role(target)=='super-admin': require(_active_super_admins(exclude_id=target.pk),'At least one active Super Admin must remain.')
        target.is_active=enabling; target.save(update_fields=['is_active'])
        if not enabling: _invalidate_user_sessions(target.pk)
        return {'user':user_dict(target)}
    if action=='action:ad-toggle':
        require(is_super(user) or has_perm(user,'manage_ads')); obj=AdPlacement.objects.get(pk=int(payload.get('id'))); obj.active=not obj.active; obj.updated_by=user; obj.save(); return {'ad':ad(obj)}
    if action=='action:ad-delete':
        require(is_super(user) or has_perm(user,'manage_ads')); obj=AdPlacement.objects.get(pk=int(payload.get('id'))); rid=obj.id; name=obj.name; obj.delete(); log(user,'Deleted ad placement',name); return {'deleted':{'type':'ads','ids':[rid]}}
    if action=='action:post-delete':
        require(is_super(user) or has_perm(user,'delete_posts')); obj=Post.objects.get(pk=int(payload.get('id'))); rid=obj.id; title=obj.title; obj.delete(); log(user,'Deleted post',title); return {'deleted':{'type':'posts','ids':[rid]}}
    if action in {'action:pdf-delete','action:latest-job-delete','action:latest-job-toggle'}:
        form='pdfs' if action=='action:pdf-delete' else 'latestJobs'; perm='delete_pdfs' if form=='pdfs' else ('delete_latest_jobs' if action.endswith('delete') else 'manage_latest_jobs'); require(is_super(user) or has_perm(user,perm)); s=SiteSetting.get_solo(); blob=_site_blob(s); rows=list(blob.get(form) or []); rid=int(payload.get('id'))
        if action.endswith('toggle'):
            for x in rows:
                if int(x.get('id',0))==rid: x['published']=not bool(x.get('published',True)); x['updated_at']=timezone.now().isoformat()
        else: rows=[x for x in rows if int(x.get('id',0))!=rid]
        blob[form]=rows; _save_site_blob(s,blob); s.updated_by=user; s.save(); return {form:rows}
    if action in {'action:entity-delete-confirm','action:entity-bulk-delete','action:hierarchy-bulk-delete'}:
        typ=payload.get('type'); ids=payload.get('ids') or [payload.get('id')]; count=0
        for rid in ids:
            if rid and ENTITY_MODELS.get(typ) and _delete_entity(user,typ,int(rid)) is not None: count+=1
        return {'deleted':{'type':typ,'ids':[int(x) for x in ids if x]}}
    if action in {'action:trash-restore','action:restore-trash'}: return _restore_trash(user,TrashRecord.objects.get(pk=int(payload.get('id'))))
    if action=='action:import-confirm':
        require(is_admin(user) and has_perm(user,'bulk_import_mcqs')); summary={'imported':0,'duplicates':0,'invalid':0,'failed':0}; imported_ids=[]
        for row in payload.get('rows') or []:
            if row.get('status')!='valid' or not row.get('q'): continue
            try:
                obj=save_mcq(user,row['q']); imported_ids.append(obj.pk); summary['imported']+=1
            except ValueError as e:
                if 'already exists' in str(e).lower(): summary['duplicates']+=1
                else: summary['failed']+=1
        imported=MCQ.objects.filter(pk__in=imported_ids).select_related('category','created_by','submitted_by','reviewed_by','approved_by').order_by('-id')
        return {'summary':summary,'mcqs':[mcq(x) for x in imported]}
    raise ValueError('Unsupported command.')

def _otp_hash(user,purpose,code):
    key=str(settings.SECRET_KEY).encode('utf-8')
    message=f'{user.pk}:{purpose}:{str(code)}'.encode('utf-8')
    return hmac.new(key,message,hashlib.sha256).hexdigest()

def create_token(user,purpose,minutes=10):
    if purpose not in {'verify','reset'}: raise ValueError('Invalid token purpose.')
    OneTimeToken.objects.filter(user=user,purpose=purpose,used_at__isnull=True).update(used_at=timezone.now())
    raw=f'{secrets.randbelow(1000000):06d}'
    OneTimeToken.objects.create(user=user,purpose=purpose,code_hash=_otp_hash(user,purpose,raw),expires_at=timezone.now()+timedelta(minutes=minutes))
    return raw

def consume_token(user,raw,purpose,max_attempts=5):
    if not user or purpose not in {'verify','reset'}: return None
    code=str(raw or '').strip()
    if not re.fullmatch(r'\d{6}',code): return None
    obj=OneTimeToken.objects.filter(user=user,purpose=purpose,used_at__isnull=True).order_by('-created_at').first()
    if not obj or obj.expires_at<=timezone.now() or obj.attempt_count>=max_attempts: return None
    if not hmac.compare_digest(obj.code_hash,_otp_hash(user,purpose,code)):
        obj.attempt_count+=1
        fields=['attempt_count']
        if obj.attempt_count>=max_attempts:
            obj.used_at=timezone.now(); fields.append('used_at')
        obj.save(update_fields=fields)
        return None
    obj.used_at=timezone.now(); obj.save(update_fields=['used_at'])
    OneTimeToken.objects.filter(user=user,purpose=purpose,used_at__isnull=True).exclude(pk=obj.pk).update(used_at=timezone.now())
    return obj.user
,text)
    if m: return m.group(2).strip(),m.group(1).strip()
    m=re.match(r'^\[([^\]]+)\]\s*(.+)
    fields,v,c,_=parse_fields(payload); s=SiteSetting.get_solo(); blob=_site_blob(s); now=timezone.now().isoformat()
    if form=='footer-settings':
        require(is_super(user) or has_perm(user,'manage_footer')); old=blob.get('footer') or {}; footer=dict(old)
        for k in ['description','copyrightText','footerLogoUrl','countryText']: footer[k]=str(v.get(k) or '')
        for k in ['showCountryText','showAbout','showContact','showPrivacy','showTerms','showDisclaimer','showCookiePolicy','showAdvertisingPolicy','showFaq','showSitemap']: footer[k]=k in fields
        blob['footer']=footer; contact=dict(blob.get('contact') or {}); contact['supportEmail']=str(v.get('supportEmail') or ''); contact['advertisingContact']=str(v.get('advertisingContact') or ''); blob['contact']=contact
    elif form=='social-links':
        require(is_super(user) or has_perm(user,'manage_social_links')); social={}
        for key in ['facebook','youtube','instagram','linkedin','x']:
            social[key]={'url':str(v.get(key+'_url') or ''),'icon':str(v.get(key+'_icon') or key),'iconData':str(v.get(key+'_icon_data') or ''),'enabled':key+'_enabled' in fields}
        email=str(v.get('footer_email') or '').strip()
        if email and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email): raise ValueError('Enter a valid footer email address.')
        social['email']={'address':email,'enabled':'footer_email_enabled' in fields}
        blob['socialLinks']=social
    elif form=='legal-page':
        require(is_super(user) or has_perm(user,'manage_legal_pages')); key=str(c.get('page') or 'about'); require(key in {'about','contact','privacy','terms','disclaimer','cookies','advertising'},'Invalid page.'); pages=dict(blob.get('legalPages') or {}); content=str(v.get('content') or ''); title=str(v.get('title') or '').strip(); require(title and content,'Title and page content are required.'); pages[key]={'title':title,'content':content,'lastUpdated':str(v.get('lastUpdated') or timezone.now().date().isoformat()),'published':'published' in fields,'seoTitle':title[:80],'metaDescription':re.sub(r'[#*\-]+',' ',content).strip()[:155]}; blob['legalPages']=pages
    elif form=='ad-config':
        require(is_super(user) or has_perm(user,'manage_ads')); ad=extract_adsense(v.get('adsenseClient')); ga=extract_ga(v.get('analyticsId')); slots={k[5:]:str(val or '') for k,val in v.items() if k.startswith('slot_')}; blob['adSettings']={'enabled':'enabled' in fields,'adsenseClient':ad,'analyticsId':ga,'slots':slots}; s.adsense_client_id=ad; s.adsense_enabled=bool(ad) and 'enabled' in fields; s.google_analytics_id=ga; s.analytics_enabled=bool(ga)
    elif form=='direct-ad':
        require(is_super(user) or has_perm(user,'manage_ads')); brand=str(v.get('brand') or '').strip(); require(brand,'Brand name is required.'); obj=AdPlacement(name=brand,provider='custom',placement=str(v.get('placement') or 'home_ad'),title=brand,body=str(v.get('text') or ''),image_url=str(v.get('image_url') or ''),target_url=str(v.get('destination_url') or ''),active=True,starts_at=_parse_date(v.get('start_date')),ends_at=_parse_date(v.get('end_date'),True),created_by=user,updated_by=user); obj.save(); log(user,'Saved direct ad',brand); return {'id':obj.id}
    elif form=='pdf':
        require(is_super(user) or has_perm(user,'manage_pdfs')); rows=list(blob.get('pdfs') or []); rid=int(c.get('id') or 0); old=next((x for x in rows if int(x.get('id',0))==rid),None); title=str(v.get('title') or '').strip(); require(title,'PDF Title is required.'); download=str(v.get('pdf_file_data') or v.get('download_url') or (old or {}).get('download_url') or '').strip(); require(download,'Choose a PDF file or enter a Download URL.'); new={'id':rid or max([int(x.get('id',0)) for x in rows]+[0])+1,'title':title,'slug':slugify(title),'description':str(v.get('description') or ''),'download_url':download,'cover':str(v.get('cover_data') or v.get('cover') or (old or {}).get('cover') or ''),'active':True,'created_at':(old or {}).get('created_at') or now,'created_by':(old or {}).get('created_by') or user_name(user),'created_by_id':(old or {}).get('created_by_id') or user.id,'updated_at':now,'updated_by':user_name(user),'updated_by_id':user.id}
        rows=[new if int(x.get('id',0))==new['id'] else x for x in rows] if old else [new]+rows; blob['pdfs']=rows
    elif form=='latest-job':
        require(is_super(user) or has_perm(user,'manage_latest_jobs')); rows=list(blob.get('latestJobs') or []); rid=int(c.get('id') or 0); old=next((x for x in rows if int(x.get('id',0))==rid),None); paper_id=int(v.get('paper_id') or 0); require(Paper.objects.filter(pk=paper_id).exists(),'Choose a valid Organization / Paper.'); title=str(v.get('title') or '').strip(); last=str(v.get('last_date') or '').strip(); require(title and last,'Job Title and Last Date are required.'); new={'id':rid or max([int(x.get('id',0)) for x in rows]+[0])+1,'paper_id':paper_id,'title':title,'slug':slugify(title),'last_date':last,'apply_url':str(v.get('apply_url') or ''),'published':'published' in fields,'created_at':(old or {}).get('created_at') or now,'created_by':(old or {}).get('created_by') or user_name(user),'created_by_id':(old or {}).get('created_by_id') or user.id,'updated_at':now,'updated_by':user_name(user),'updated_by_id':user.id}; rows=[new if int(x.get('id',0))==new['id'] else x for x in rows] if old else [new]+rows; blob['latestJobs']=rows
    elif form=='bulk-hierarchy':
        require(is_admin(user) and has_perm(user,'manage_papers') and has_perm(user,'manage_jobs') and has_perm(user,'manage_job_years')); count=0
        for raw in str(v.get('hierarchy') or '').splitlines():
            parts=[x.strip() for x in re.split(r'\s*(?:\||>)\s*',raw.strip()) if x.strip()]
            if len(parts)!=3: continue
            pn,jn,yn=parts; p=Paper.objects.filter(name__iexact=pn).first()
            if not p: p=Paper.objects.create(id=next_id(Paper),name=pn,country=s.country,icon='paper',created_by=user,updated_by=user)
            j=Job.objects.filter(paper=p,name__iexact=jn).first()
            if not j: j=Job.objects.create(id=next_id(Job),paper=p,name=jn,icon='grid',created_by=user,updated_by=user)
            if not JobYear.objects.filter(job=j,name__iexact=yn).exists(): JobYear.objects.create(id=next_id(JobYear),job=j,name=yn,icon='grid',created_by=user,updated_by=user)
            count+=1
        log(user,'Bulk hierarchy import',f'{count} line(s) processed'); return {'processed':count}
    else: raise ValueError('Unsupported site form.')
    _save_site_blob(s,blob); s.updated_by=user; s.save(); log(user,'Updated '+form,form); return True

def save_ad(user,payload):
    require(is_super(user)); fields,v,c,_=parse_fields(payload); rid=int(c.get('id') or 0) or None; obj=AdPlacement.objects.filter(pk=rid).first() if rid else AdPlacement(created_by=user)
    obj.name=str(v.get('name') or '').strip(); obj.provider=str(v.get('provider') or 'custom'); obj.placement=str(v.get('placement') or 'top_banner'); obj.title=str(v.get('title') or ''); obj.body=str(v.get('body') or ''); obj.image_url=str(v.get('image_url') or ''); obj.target_url=str(v.get('target_url') or ''); obj.adsense_slot=str(v.get('adsense_slot') or '').strip(); obj.priority=int(v.get('priority') or 0); obj.active='active' in fields; obj.updated_by=user
    if not obj.name: raise ValueError('Ad name is required.')
    if obj.provider=='adsense' and not obj.adsense_slot: raise ValueError('AdSense slot ID is required.')
    obj.save(); log(user,'Saved ad placement',obj.name); return {'ad':ad(obj)}

def command(user,action,payload):
    if action=='attempt':
        qid,answer=payload.get('args',[None,None]); q=MCQ.objects.filter(pk=qid,status='approved').first();
        if not q: raise ValueError('Question not available.')
        correct=str(q.correct_answer)==str(answer); Attempt.objects.create(user=user,mcq=q,answer=str(answer),correct=correct); return correct
    if action=='toggleBookmark':
        qid=(payload.get('args') or [None])[0]; q=MCQ.objects.get(pk=qid); obj,created=Bookmark.objects.get_or_create(user=user,mcq=q)
        if not created: obj.delete(); return False
        return True
    if action=='savePaper':
        pid=(payload.get('args') or [None])[0]; p=Paper.objects.get(pk=pid); obj,created=SavedPaper.objects.get_or_create(user=user,paper=p)
        if not created: obj.delete(); return False
        return True
    if action=='report':
        qid,reason=payload.get('args',[None,'']); require(str(reason).strip(),'Enter a report reason.'); r=Report.objects.create(user=user,mcq=MCQ.objects.get(pk=qid),reason=str(reason)); return {'report':{'id':r.id,'mcq_id':r.mcq_id,'reason':r.reason,'status':r.status,'by_id':user.id,'by':user_name(user),'at':iso(r.created_at)}}
    if action=='saveProfile':
        vals=(payload.get('args') or [{}])[0] or {}; user.first_name=str(vals.get('name') or user_name(user)); new_email=str(vals.get('email') or user.email).strip().lower(); require('@' in new_email,'Enter a valid email.'); require(not User.objects.exclude(pk=user.pk).filter(email=new_email).exists(),'That email is already in use.'); user.email=new_email; user.username=new_email; user.save(); prof=profile_for(user); prof.country=str(vals.get('country') or prof.country); _save_profile_payload(prof,vals); prof.save(); return user_profile_dict(user)
    if action=='changePassword':
        vals=(payload.get('args') or [{}])[0] or {}; require(user.check_password(vals.get('current_password','')),'Current password is incorrect.'); new=str(vals.get('new_password') or ''); require(new==vals.get('confirm_password'),'New passwords do not match.'); _validate_password(new,user); user.set_password(new); user.save(); return True
    if action=='form:mcq':
        obj=save_mcq(user,payload.get('draft') or {}); return {'mcq':mcq(MCQ.objects.select_related('category','created_by','submitted_by','reviewed_by','approved_by').get(pk=obj.pk))}
    if action=='form:review':
        _,v,c,_=parse_fields(payload); ids=[int(x) for x in str(c.get('ids','')).split(',') if str(x).strip().isdigit()]; review_mcqs(user,c.get('ids',''),c.get('status','pending'),v.get('reason','')); rows=MCQ.objects.filter(pk__in=ids).select_related('category','created_by','submitted_by','reviewed_by','approved_by'); return {'mcqs':[mcq(x) for x in rows]}
    if action=='form:entity': return save_entity(user,payload)
    if action=='form:user': return save_user(user,payload)
    if action=='form:guide': return save_guide(user,payload)
    if action=='form:post': return save_post(user,payload)
    if action=='form:config': return save_config(user,payload)
    if action in {'form:footer-settings','form:social-links','form:legal-page','form:ad-config','form:direct-ad','form:pdf','form:latest-job','form:bulk-hierarchy'}: return save_site_form(user,action[5:],payload)
    if action=='form:ad': return save_ad(user,payload)
    if action=='form:contact':
        _,v,_,_=parse_fields(payload); ContactMessage.objects.create(user=user,name=str(v.get('name') or user_name(user)),email=str(v.get('email') or user.email),message=str(v.get('message') or '')); return True
    if action in {'form:profile','form:password-change'}:
        _,v,_,_=parse_fields(payload); return command(user,'saveProfile' if action=='form:profile' else 'changePassword',{'args':[v]})
    if action=='action:report-resolve':
        require(is_super(user) or has_perm(user,'resolve_reports')); rid=int(payload.get('id')); r=Report.objects.get(pk=rid); r.status='resolved'; r.resolved_at=timezone.now(); r.resolved_by=user; r.save(); log(user,'Resolved report',rid); return {'report':{'id':r.id,'mcq_id':r.mcq_id,'reason':r.reason,'status':r.status,'by_id':r.user_id,'by':user_name(r.user) if r.user else 'Visitor','at':iso(r.created_at)}}
    if action=='action:user-status':
        require(is_super(user)); target=User.objects.get(pk=int(payload.get('id')))
        enabling=not target.is_active
        if not enabling:
            require(target.pk!=user.pk,'You cannot disable the account you are currently using.')
            if user_role(target)=='super-admin': require(_active_super_admins(exclude_id=target.pk),'At least one active Super Admin must remain.')
        target.is_active=enabling; target.save(update_fields=['is_active'])
        if not enabling: _invalidate_user_sessions(target.pk)
        return {'user':user_dict(target)}
    if action=='action:ad-toggle':
        require(is_super(user) or has_perm(user,'manage_ads')); obj=AdPlacement.objects.get(pk=int(payload.get('id'))); obj.active=not obj.active; obj.updated_by=user; obj.save(); return {'ad':ad(obj)}
    if action=='action:ad-delete':
        require(is_super(user) or has_perm(user,'manage_ads')); obj=AdPlacement.objects.get(pk=int(payload.get('id'))); rid=obj.id; name=obj.name; obj.delete(); log(user,'Deleted ad placement',name); return {'deleted':{'type':'ads','ids':[rid]}}
    if action=='action:post-delete':
        require(is_super(user) or has_perm(user,'delete_posts')); obj=Post.objects.get(pk=int(payload.get('id'))); rid=obj.id; title=obj.title; obj.delete(); log(user,'Deleted post',title); return {'deleted':{'type':'posts','ids':[rid]}}
    if action in {'action:pdf-delete','action:latest-job-delete','action:latest-job-toggle'}:
        form='pdfs' if action=='action:pdf-delete' else 'latestJobs'; perm='delete_pdfs' if form=='pdfs' else ('delete_latest_jobs' if action.endswith('delete') else 'manage_latest_jobs'); require(is_super(user) or has_perm(user,perm)); s=SiteSetting.get_solo(); blob=_site_blob(s); rows=list(blob.get(form) or []); rid=int(payload.get('id'))
        if action.endswith('toggle'):
            for x in rows:
                if int(x.get('id',0))==rid: x['published']=not bool(x.get('published',True)); x['updated_at']=timezone.now().isoformat()
        else: rows=[x for x in rows if int(x.get('id',0))!=rid]
        blob[form]=rows; _save_site_blob(s,blob); s.updated_by=user; s.save(); return True
    if action=='action:bulk-important':
        require(is_admin(user) and (has_perm(user,'edit_any_mcq') or is_super(user))); ids=[int(x) for x in payload.get('ids') or []]; MCQ.objects.filter(pk__in=ids).update(important=str(payload.get('value')).lower()=='true',updated_by=user); return {'updated':{'type':'mcqs','ids':ids,'fields':{'important':str(payload.get('value')).lower()=='true'}}}
    if action in {'action:entity-delete-confirm','action:entity-bulk-delete','action:hierarchy-bulk-delete'}:
        typ=payload.get('type'); ids=payload.get('ids') or [payload.get('id')]; count=0
        for rid in ids:
            if rid and ENTITY_MODELS.get(typ) and _delete_entity(user,typ,int(rid)) is not None: count+=1
        return {'deleted':{'type':typ,'ids':[int(x) for x in ids if x]}}
    if action in {'action:trash-restore','action:restore-trash'}: return _restore_trash(user,TrashRecord.objects.get(pk=int(payload.get('id'))))
    if action=='action:import-confirm':
        require(is_admin(user) and has_perm(user,'bulk_import_mcqs')); summary={'imported':0,'duplicates':0,'invalid':0,'failed':0}
        for row in payload.get('rows') or []:
            if row.get('status')!='valid' or not row.get('q'): continue
            try: save_mcq(user,row['q']); summary['imported']+=1
            except ValueError as e:
                if 'already exists' in str(e).lower(): summary['duplicates']+=1
                else: summary['failed']+=1
        return summary
    raise ValueError('Unsupported command.')

def _otp_hash(user,purpose,code):
    key=str(settings.SECRET_KEY).encode('utf-8')
    message=f'{user.pk}:{purpose}:{str(code)}'.encode('utf-8')
    return hmac.new(key,message,hashlib.sha256).hexdigest()

def create_token(user,purpose,minutes=10):
    if purpose not in {'verify','reset'}: raise ValueError('Invalid token purpose.')
    OneTimeToken.objects.filter(user=user,purpose=purpose,used_at__isnull=True).update(used_at=timezone.now())
    raw=f'{secrets.randbelow(1000000):06d}'
    OneTimeToken.objects.create(user=user,purpose=purpose,code_hash=_otp_hash(user,purpose,raw),expires_at=timezone.now()+timedelta(minutes=minutes))
    return raw

def consume_token(user,raw,purpose,max_attempts=5):
    if not user or purpose not in {'verify','reset'}: return None
    code=str(raw or '').strip()
    if not re.fullmatch(r'\d{6}',code): return None
    obj=OneTimeToken.objects.filter(user=user,purpose=purpose,used_at__isnull=True).order_by('-created_at').first()
    if not obj or obj.expires_at<=timezone.now() or obj.attempt_count>=max_attempts: return None
    if not hmac.compare_digest(obj.code_hash,_otp_hash(user,purpose,code)):
        obj.attempt_count+=1
        fields=['attempt_count']
        if obj.attempt_count>=max_attempts:
            obj.used_at=timezone.now(); fields.append('used_at')
        obj.save(update_fields=fields)
        return None
    obj.used_at=timezone.now(); obj.save(update_fields=['used_at'])
    OneTimeToken.objects.filter(user=user,purpose=purpose,used_at__isnull=True).exclude(pk=obj.pk).update(used_at=timezone.now())
    return obj.user
,text)
    if m: return m.group(2).strip(),m.group(1).strip()[:32]
    return text,default_icon

def save_site_form(user,form,payload):
    fields,v,c,_=parse_fields(payload); s=SiteSetting.get_solo(); blob=_site_blob(s); now=timezone.now().isoformat()
    if form=='footer-settings':
        require(is_super(user) or has_perm(user,'manage_footer')); old=blob.get('footer') or {}; footer=dict(old)
        for k in ['description','copyrightText','footerLogoUrl','countryText']: footer[k]=str(v.get(k) or '')
        for k in ['showCountryText','showAbout','showContact','showPrivacy','showTerms','showDisclaimer','showCookiePolicy','showAdvertisingPolicy','showFaq','showSitemap']: footer[k]=k in fields
        blob['footer']=footer; contact=dict(blob.get('contact') or {}); contact['supportEmail']=str(v.get('supportEmail') or ''); contact['advertisingContact']=str(v.get('advertisingContact') or ''); blob['contact']=contact
    elif form=='social-links':
        require(is_super(user) or has_perm(user,'manage_social_links')); social={}
        for key in ['facebook','youtube','instagram','linkedin','x']:
            social[key]={'url':str(v.get(key+'_url') or ''),'icon':str(v.get(key+'_icon') or key),'iconData':str(v.get(key+'_icon_data') or ''),'enabled':key+'_enabled' in fields}
        email=str(v.get('footer_email') or '').strip()
        if email and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email): raise ValueError('Enter a valid footer email address.')
        social['email']={'address':email,'enabled':'footer_email_enabled' in fields}
        blob['socialLinks']=social
    elif form=='legal-page':
        require(is_super(user) or has_perm(user,'manage_legal_pages')); key=str(c.get('page') or 'about'); require(key in {'about','contact','privacy','terms','disclaimer','cookies','advertising'},'Invalid page.'); pages=dict(blob.get('legalPages') or {}); content=str(v.get('content') or ''); title=str(v.get('title') or '').strip(); require(title and content,'Title and page content are required.'); pages[key]={'title':title,'content':content,'lastUpdated':str(v.get('lastUpdated') or timezone.now().date().isoformat()),'published':'published' in fields,'seoTitle':title[:80],'metaDescription':re.sub(r'[#*\-]+',' ',content).strip()[:155]}; blob['legalPages']=pages
    elif form=='ad-config':
        require(is_super(user) or has_perm(user,'manage_ads')); ad=extract_adsense(v.get('adsenseClient')); ga=extract_ga(v.get('analyticsId')); slots={k[5:]:str(val or '') for k,val in v.items() if k.startswith('slot_')}; blob['adSettings']={'enabled':'enabled' in fields,'adsenseClient':ad,'analyticsId':ga,'slots':slots}; s.adsense_client_id=ad; s.adsense_enabled=bool(ad) and 'enabled' in fields; s.google_analytics_id=ga; s.analytics_enabled=bool(ga)
    elif form=='direct-ad':
        require(is_super(user) or has_perm(user,'manage_ads')); brand=str(v.get('brand') or '').strip(); require(brand,'Brand name is required.'); obj=AdPlacement(name=brand,provider='custom',placement=str(v.get('placement') or 'home_ad'),title=brand,body=str(v.get('text') or ''),image_url=str(v.get('image_url') or ''),target_url=str(v.get('destination_url') or ''),active=True,starts_at=_parse_date(v.get('start_date')),ends_at=_parse_date(v.get('end_date'),True),created_by=user,updated_by=user); obj.save(); log(user,'Saved direct ad',brand); return {'id':obj.id}
    elif form=='pdf':
        require(is_super(user) or has_perm(user,'manage_pdfs')); rows=list(blob.get('pdfs') or []); rid=int(c.get('id') or 0); old=next((x for x in rows if int(x.get('id',0))==rid),None); title=str(v.get('title') or '').strip(); require(title,'PDF Title is required.'); download=str(v.get('pdf_file_data') or v.get('download_url') or (old or {}).get('download_url') or '').strip(); require(download,'Choose a PDF file or enter a Download URL.'); new={'id':rid or max([int(x.get('id',0)) for x in rows]+[0])+1,'title':title,'slug':slugify(title),'description':str(v.get('description') or ''),'download_url':download,'cover':str(v.get('cover_data') or v.get('cover') or (old or {}).get('cover') or ''),'active':True,'created_at':(old or {}).get('created_at') or now,'created_by':(old or {}).get('created_by') or user_name(user),'created_by_id':(old or {}).get('created_by_id') or user.id,'updated_at':now,'updated_by':user_name(user),'updated_by_id':user.id}
        rows=[new if int(x.get('id',0))==new['id'] else x for x in rows] if old else [new]+rows; blob['pdfs']=rows
    elif form=='latest-job':
        require(is_super(user) or has_perm(user,'manage_latest_jobs')); rows=list(blob.get('latestJobs') or []); rid=int(c.get('id') or 0); old=next((x for x in rows if int(x.get('id',0))==rid),None); paper_id=int(v.get('paper_id') or 0); require(Paper.objects.filter(pk=paper_id).exists(),'Choose a valid Organization / Paper.'); title=str(v.get('title') or '').strip(); last=str(v.get('last_date') or '').strip(); require(title and last,'Job Title and Last Date are required.'); new={'id':rid or max([int(x.get('id',0)) for x in rows]+[0])+1,'paper_id':paper_id,'title':title,'slug':slugify(title),'last_date':last,'apply_url':str(v.get('apply_url') or ''),'published':'published' in fields,'created_at':(old or {}).get('created_at') or now,'created_by':(old or {}).get('created_by') or user_name(user),'created_by_id':(old or {}).get('created_by_id') or user.id,'updated_at':now,'updated_by':user_name(user),'updated_by_id':user.id}; rows=[new if int(x.get('id',0))==new['id'] else x for x in rows] if old else [new]+rows; blob['latestJobs']=rows
    elif form=='bulk-hierarchy':
        require(is_admin(user) and has_perm(user,'manage_papers') and has_perm(user,'manage_jobs') and has_perm(user,'manage_job_years')); count=0
        for raw in str(v.get('hierarchy') or '').splitlines():
            parts=[x.strip() for x in re.split(r'\s*(?:\||>)\s*',raw.strip()) if x.strip()]
            if len(parts)!=3: continue
            pn,jn,yn=parts; p=Paper.objects.filter(name__iexact=pn).first()
            if not p: p=Paper.objects.create(id=next_id(Paper),name=pn,country=s.country,icon='paper',created_by=user,updated_by=user)
            j=Job.objects.filter(paper=p,name__iexact=jn).first()
            if not j: j=Job.objects.create(id=next_id(Job),paper=p,name=jn,icon='grid',created_by=user,updated_by=user)
            if not JobYear.objects.filter(job=j,name__iexact=yn).exists(): JobYear.objects.create(id=next_id(JobYear),job=j,name=yn,icon='grid',created_by=user,updated_by=user)
            count+=1
        log(user,'Bulk hierarchy import',f'{count} line(s) processed'); return {'processed':count}
    else: raise ValueError('Unsupported site form.')
    _save_site_blob(s,blob); s.updated_by=user; s.save(); log(user,'Updated '+form,form); return True

def save_ad(user,payload):
    require(is_super(user)); fields,v,c,_=parse_fields(payload); rid=int(c.get('id') or 0) or None; obj=AdPlacement.objects.filter(pk=rid).first() if rid else AdPlacement(created_by=user)
    obj.name=str(v.get('name') or '').strip(); obj.provider=str(v.get('provider') or 'custom'); obj.placement=str(v.get('placement') or 'top_banner'); obj.title=str(v.get('title') or ''); obj.body=str(v.get('body') or ''); obj.image_url=str(v.get('image_url') or ''); obj.target_url=str(v.get('target_url') or ''); obj.adsense_slot=str(v.get('adsense_slot') or '').strip(); obj.priority=int(v.get('priority') or 0); obj.active='active' in fields; obj.updated_by=user
    if not obj.name: raise ValueError('Ad name is required.')
    if obj.provider=='adsense' and not obj.adsense_slot: raise ValueError('AdSense slot ID is required.')
    obj.save(); log(user,'Saved ad placement',obj.name); return {'ad':ad(obj)}

def command(user,action,payload):
    if action=='attempt':
        qid,answer=payload.get('args',[None,None]); q=MCQ.objects.filter(pk=qid,status='approved').first();
        if not q: raise ValueError('Question not available.')
        correct=str(q.correct_answer)==str(answer); Attempt.objects.create(user=user,mcq=q,answer=str(answer),correct=correct); return correct
    if action=='toggleBookmark':
        qid=(payload.get('args') or [None])[0]; q=MCQ.objects.get(pk=qid); obj,created=Bookmark.objects.get_or_create(user=user,mcq=q)
        if not created: obj.delete(); return False
        return True
    if action=='savePaper':
        pid=(payload.get('args') or [None])[0]; p=Paper.objects.get(pk=pid); obj,created=SavedPaper.objects.get_or_create(user=user,paper=p)
        if not created: obj.delete(); return False
        return True
    if action=='report':
        qid,reason=payload.get('args',[None,'']); require(str(reason).strip(),'Enter a report reason.'); r=Report.objects.create(user=user,mcq=MCQ.objects.get(pk=qid),reason=str(reason)); return {'report':{'id':r.id,'mcq_id':r.mcq_id,'reason':r.reason,'status':r.status,'by_id':user.id,'by':user_name(user),'at':iso(r.created_at)}}
    if action=='saveProfile':
        vals=(payload.get('args') or [{}])[0] or {}; user.first_name=str(vals.get('name') or user_name(user)); new_email=str(vals.get('email') or user.email).strip().lower(); require('@' in new_email,'Enter a valid email.'); require(not User.objects.exclude(pk=user.pk).filter(email=new_email).exists(),'That email is already in use.'); user.email=new_email; user.username=new_email; user.save(); prof=profile_for(user); prof.country=str(vals.get('country') or prof.country); _save_profile_payload(prof,vals); prof.save(); return user_profile_dict(user)
    if action=='changePassword':
        vals=(payload.get('args') or [{}])[0] or {}; require(user.check_password(vals.get('current_password','')),'Current password is incorrect.'); new=str(vals.get('new_password') or ''); require(new==vals.get('confirm_password'),'New passwords do not match.'); _validate_password(new,user); user.set_password(new); user.save(); return True
    if action=='form:mcq':
        obj=save_mcq(user,payload.get('draft') or {}); return {'mcq':mcq(MCQ.objects.select_related('category','created_by','submitted_by','reviewed_by','approved_by').get(pk=obj.pk))}
    if action=='form:review':
        _,v,c,_=parse_fields(payload); ids=[int(x) for x in str(c.get('ids','')).split(',') if str(x).strip().isdigit()]; review_mcqs(user,c.get('ids',''),c.get('status','pending'),v.get('reason','')); rows=MCQ.objects.filter(pk__in=ids).select_related('category','created_by','submitted_by','reviewed_by','approved_by'); return {'mcqs':[mcq(x) for x in rows]}
    if action=='form:entity': return save_entity(user,payload)
    if action=='form:user': return save_user(user,payload)
    if action=='form:guide': return save_guide(user,payload)
    if action=='form:post': return save_post(user,payload)
    if action=='form:config': return save_config(user,payload)
    if action in {'form:footer-settings','form:social-links','form:legal-page','form:ad-config','form:direct-ad','form:pdf','form:latest-job','form:bulk-hierarchy'}: return save_site_form(user,action[5:],payload)
    if action=='form:ad': return save_ad(user,payload)
    if action=='form:contact':
        _,v,_,_=parse_fields(payload); ContactMessage.objects.create(user=user,name=str(v.get('name') or user_name(user)),email=str(v.get('email') or user.email),message=str(v.get('message') or '')); return True
    if action in {'form:profile','form:password-change'}:
        _,v,_,_=parse_fields(payload); return command(user,'saveProfile' if action=='form:profile' else 'changePassword',{'args':[v]})
    if action=='action:report-resolve':
        require(is_super(user) or has_perm(user,'resolve_reports')); rid=int(payload.get('id')); r=Report.objects.get(pk=rid); r.status='resolved'; r.resolved_at=timezone.now(); r.resolved_by=user; r.save(); log(user,'Resolved report',rid); return {'report':{'id':r.id,'mcq_id':r.mcq_id,'reason':r.reason,'status':r.status,'by_id':r.user_id,'by':user_name(r.user) if r.user else 'Visitor','at':iso(r.created_at)}}
    if action=='action:user-status':
        require(is_super(user)); target=User.objects.get(pk=int(payload.get('id')))
        enabling=not target.is_active
        if not enabling:
            require(target.pk!=user.pk,'You cannot disable the account you are currently using.')
            if user_role(target)=='super-admin': require(_active_super_admins(exclude_id=target.pk),'At least one active Super Admin must remain.')
        target.is_active=enabling; target.save(update_fields=['is_active'])
        if not enabling: _invalidate_user_sessions(target.pk)
        return {'user':user_dict(target)}
    if action=='action:ad-toggle':
        require(is_super(user) or has_perm(user,'manage_ads')); obj=AdPlacement.objects.get(pk=int(payload.get('id'))); obj.active=not obj.active; obj.updated_by=user; obj.save(); return {'ad':ad(obj)}
    if action=='action:ad-delete':
        require(is_super(user) or has_perm(user,'manage_ads')); obj=AdPlacement.objects.get(pk=int(payload.get('id'))); rid=obj.id; name=obj.name; obj.delete(); log(user,'Deleted ad placement',name); return {'deleted':{'type':'ads','ids':[rid]}}
    if action=='action:post-delete':
        require(is_super(user) or has_perm(user,'delete_posts')); obj=Post.objects.get(pk=int(payload.get('id'))); rid=obj.id; title=obj.title; obj.delete(); log(user,'Deleted post',title); return {'deleted':{'type':'posts','ids':[rid]}}
    if action in {'action:pdf-delete','action:latest-job-delete','action:latest-job-toggle'}:
        form='pdfs' if action=='action:pdf-delete' else 'latestJobs'; perm='delete_pdfs' if form=='pdfs' else ('delete_latest_jobs' if action.endswith('delete') else 'manage_latest_jobs'); require(is_super(user) or has_perm(user,perm)); s=SiteSetting.get_solo(); blob=_site_blob(s); rows=list(blob.get(form) or []); rid=int(payload.get('id'))
        if action.endswith('toggle'):
            for x in rows:
                if int(x.get('id',0))==rid: x['published']=not bool(x.get('published',True)); x['updated_at']=timezone.now().isoformat()
        else: rows=[x for x in rows if int(x.get('id',0))!=rid]
        blob[form]=rows; _save_site_blob(s,blob); s.updated_by=user; s.save(); return True
    if action=='action:bulk-important':
        require(is_admin(user) and (has_perm(user,'edit_any_mcq') or is_super(user))); ids=[int(x) for x in payload.get('ids') or []]; MCQ.objects.filter(pk__in=ids).update(important=str(payload.get('value')).lower()=='true',updated_by=user); return {'updated':{'type':'mcqs','ids':ids,'fields':{'important':str(payload.get('value')).lower()=='true'}}}
    if action in {'action:entity-delete-confirm','action:entity-bulk-delete','action:hierarchy-bulk-delete'}:
        typ=payload.get('type'); ids=payload.get('ids') or [payload.get('id')]; count=0
        for rid in ids:
            if rid and ENTITY_MODELS.get(typ) and _delete_entity(user,typ,int(rid)) is not None: count+=1
        return {'deleted':{'type':typ,'ids':[int(x) for x in ids if x]}}
    if action in {'action:trash-restore','action:restore-trash'}: return _restore_trash(user,TrashRecord.objects.get(pk=int(payload.get('id'))))
    if action=='action:import-confirm':
        require(is_admin(user) and has_perm(user,'bulk_import_mcqs')); summary={'imported':0,'duplicates':0,'invalid':0,'failed':0}
        for row in payload.get('rows') or []:
            if row.get('status')!='valid' or not row.get('q'): continue
            try: save_mcq(user,row['q']); summary['imported']+=1
            except ValueError as e:
                if 'already exists' in str(e).lower(): summary['duplicates']+=1
                else: summary['failed']+=1
        return summary
    raise ValueError('Unsupported command.')

def _otp_hash(user,purpose,code):
    key=str(settings.SECRET_KEY).encode('utf-8')
    message=f'{user.pk}:{purpose}:{str(code)}'.encode('utf-8')
    return hmac.new(key,message,hashlib.sha256).hexdigest()

def create_token(user,purpose,minutes=10):
    if purpose not in {'verify','reset'}: raise ValueError('Invalid token purpose.')
    OneTimeToken.objects.filter(user=user,purpose=purpose,used_at__isnull=True).update(used_at=timezone.now())
    raw=f'{secrets.randbelow(1000000):06d}'
    OneTimeToken.objects.create(user=user,purpose=purpose,code_hash=_otp_hash(user,purpose,raw),expires_at=timezone.now()+timedelta(minutes=minutes))
    return raw

def consume_token(user,raw,purpose,max_attempts=5):
    if not user or purpose not in {'verify','reset'}: return None
    code=str(raw or '').strip()
    if not re.fullmatch(r'\d{6}',code): return None
    obj=OneTimeToken.objects.filter(user=user,purpose=purpose,used_at__isnull=True).order_by('-created_at').first()
    if not obj or obj.expires_at<=timezone.now() or obj.attempt_count>=max_attempts: return None
    if not hmac.compare_digest(obj.code_hash,_otp_hash(user,purpose,code)):
        obj.attempt_count+=1
        fields=['attempt_count']
        if obj.attempt_count>=max_attempts:
            obj.used_at=timezone.now(); fields.append('used_at')
        obj.save(update_fields=fields)
        return None
    obj.used_at=timezone.now(); obj.save(update_fields=['used_at'])
    OneTimeToken.objects.filter(user=user,purpose=purpose,used_at__isnull=True).exclude(pk=obj.pk).update(used_at=timezone.now())
    return obj.user
