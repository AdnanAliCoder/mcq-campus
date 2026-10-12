import hashlib, hmac, json, re, secrets, unicodedata
from datetime import datetime, timedelta
from django.conf import settings
from django.contrib.auth import password_validation
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import connection, transaction
from django.db.models import Count, Q, Max, Window, Func, IntegerField, Case, When, Value, F
from django.db.models.functions import RowNumber
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

def next_id(model):
    current=(model.objects.order_by('-id').values_list('id',flat=True).first() or 0)
    kind={MCQ:'mcq',Paper:'paper',Job:'job',JobYear:'year',Category:'category'}.get(model)
    retired=0
    if kind:
        try:
            settings=SiteSetting.get_solo(); raw=_site_blob(settings).get('seoIndex') or {}
            for key in (raw.get('items') or {}):
                if not str(key).startswith(kind+':'): continue
                entity_key=str(key).split(':',1)[1]
                if entity_key.isdigit(): retired=max(retired,int(entity_key))
        except Exception:
            pass
    return max(int(current),retired)+1

def _site_blob(settings=None):
    settings=settings or SiteSetting.get_solo()
    raw=settings.admin_permissions if isinstance(settings.admin_permissions,dict) else {}
    blob=raw.get('_site') or {}
    return dict(blob) if isinstance(blob,dict) else {}

def _save_site_blob(settings,blob):
    root=dict(settings.admin_permissions or {})
    root['_site']=blob
    settings.admin_permissions=root

def _configured_country_entries():
    configured=_site_blob().get('countries')
    if not isinstance(configured,list): return None
    entries=[]; seen=set()
    for raw in configured:
        item=raw if isinstance(raw,dict) else {'name':raw}
        name=re.sub(r'\s+',' ',str(item.get('name') or '')).strip()[:80]
        key=name.casefold()
        if not name or key in seen: continue
        seen.add(key); entries.append({'name':name,'active':bool(item.get('active',True))})
    return entries

def country_catalog(user=None,include_counts=True,include_inactive=False):
    configured=_configured_country_entries()
    entries=configured if configured is not None else []
    known={item['name'].casefold() for item in entries}
    discovered={'Pakistan'}; counts={}
    if include_counts:
        rows=MCQ.objects.values('country').annotate(total=Count('id',filter=Q(status='approved')))
        for row in rows:
            name=re.sub(r'\s+',' ',str(row['country'] or '')).strip()[:80]
            if name:
                discovered.add(name); counts[name.casefold()]=int(row['total'] or 0)
    else:
        discovered.update(re.sub(r'\s+',' ',str(v or '')).strip()[:80] for v in MCQ.objects.values_list('country',flat=True).distinct() if str(v or '').strip())
    for values in (Paper.objects.values_list('country',flat=True).distinct(),Profile.objects.values_list('country',flat=True).distinct()):
        for value in values:
            name=re.sub(r'\s+',' ',str(value or '')).strip()[:80]
            if name: discovered.add(name)
    for name in sorted(discovered,key=lambda v:(v.casefold()!='pakistan',v.casefold())):
        if name.casefold() not in known:
            entries.append({'name':name,'active':True}); known.add(name.casefold())
    for item in entries:
        if item['name'].casefold()=='pakistan':
            item['active']=True; break
    else: entries.insert(0,{'name':'Pakistan','active':True})
    result=[]
    for item in entries:
        if not include_inactive and not item['active']: continue
        row={'name':item['name'],'active':bool(item['active'])}
        if include_counts: row['mcqCount']=counts.get(item['name'].casefold(),0)
        result.append(row)
    # Preserve the Super Admin's configured country order for the landing page.
    return result

def country_for_user(user):
    if not user or not getattr(user,'is_authenticated',False) or is_super(user): return ''
    profile=profile_for(user)
    return re.sub(r'\s+',' ',str(profile.country if profile else 'Pakistan')).strip()[:80] or 'Pakistan'

def country_for_write(user,value=None):
    current=country_for_user(user)
    if current: return current
    name=re.sub(r'\s+',' ',str(value or 'Pakistan')).strip()[:80] or 'Pakistan'
    active={row['name'].casefold():row['name'] for row in country_catalog(include_counts=False) if row['active']}
    if name.casefold() not in active: raise ValueError('Choose an active country from the country catalog.')
    return active[name.casefold()]

def _validate_hierarchy_country(country,paper_ids,job_ids,year_ids):
    name=str(country or 'Pakistan').strip() or 'Pakistan'
    if Paper.objects.filter(pk__in=paper_ids).exclude(country__iexact=name).exists():
        raise ValueError('Choose papers from the selected country.')
    if Job.objects.filter(pk__in=job_ids).exclude(paper__country__iexact=name).exists():
        raise ValueError('Choose jobs from the selected country.')
    if JobYear.objects.filter(pk__in=year_ids).exclude(job__paper__country__iexact=name).exists():
        raise ValueError('Choose job years from the selected country.')

PAGE_SEO_ENTITY_KINDS={'categories':'category','papers':'paper','jobs':'job','years':'year'}

def _canonical_brand_text(value):
    return re.sub(r'\bMCQs?\s*Campus\b','MCQCampus',str(value or ''),flags=re.I)

def _clean_public_seo_title(value):
    text=re.sub(r'\s+',' ',_canonical_brand_text(value)).strip()
    return re.sub(r'\s*(?:\||-|—|–)\s*MCQCampus\s*$','',text,flags=re.I).strip()

def page_seo_snapshot(settings=None):
    settings=settings or SiteSetting.get_solo()
    raw=_site_blob(settings).get('pageSeo') or {}
    return {str(k):{'title':_clean_public_seo_title((v or {}).get('title')),'description':_canonical_brand_text((v or {}).get('description'))} for k,v in raw.items() if isinstance(v,dict)}

def save_page_seo_entry(user,kind,key,title='',description='',settings=None):
    require(is_super(user),'Only the Super Admin can edit public page SEO content.')
    settings=settings or SiteSetting.get_solo(); blob=_site_blob(settings); rows=dict(blob.get('pageSeo') or {})
    compound=f'{str(kind)}:{str(key)}'
    title=_clean_public_seo_title(title)[:180]
    description=re.sub(r'\s+',' ',_canonical_brand_text(description)).strip()[:500]
    if title or description: rows[compound]={'title':title,'description':description}
    else: rows.pop(compound,None)
    blob['pageSeo']=rows; _save_site_blob(settings,blob); settings.updated_by=user
    settings.save(update_fields=['admin_permissions','updated_by','updated_at'])
    return page_seo_snapshot(settings)

# Permanent global SEO indexes live in the existing SiteSetting JSON blob so the
# production database needs no schema migration. Assigned numbers are never reused.
SEO_INDEX_ORDER=('mcq','paper','job','year','pdf','category','latest-job','post')

def next_catalog_id(rows,kind,settings=None):
    current=max([int(x.get('id',0)) for x in (rows or []) if isinstance(x,dict)]+[0])
    retired=0
    try:
        settings=settings or SiteSetting.get_solo(); raw=_site_blob(settings).get('seoIndex') or {}
        for key in (raw.get('items') or {}):
            if not str(key).startswith(kind+':'): continue
            entity_key=str(key).split(':',1)[1]
            if entity_key.isdigit(): retired=max(retired,int(entity_key))
    except Exception:
        pass
    return max(current,retired)+1

def seo_catalog_key(row):
    value=row.get('id') if isinstance(row,dict) else None
    if value not in (None,''): return str(value)
    value=(row.get('slug') or row.get('title') or row.get('name') or '') if isinstance(row,dict) else ''
    return slugify(str(value))[:120] or 'item'

def _seo_visible_keys(settings):
    keys=[]
    keys.extend(('mcq',str(x)) for x in MCQ.objects.filter(status='approved').order_by('id').values_list('id',flat=True))
    keys.extend(('paper',str(x)) for x in Paper.objects.filter(active=True).order_by('id').values_list('id',flat=True))
    keys.extend(('job',str(x)) for x in Job.objects.filter(active=True,paper__active=True).order_by('id').values_list('id',flat=True))
    keys.extend(('year',str(x)) for x in JobYear.objects.filter(active=True,job__active=True,job__paper__active=True).order_by('id').values_list('id',flat=True))
    site=_site_blob(settings)
    keys.extend(('pdf',seo_catalog_key(x)) for x in (site.get('pdfs') or []) if isinstance(x,dict) and x.get('active',True) is not False)
    keys.extend(('category',str(x)) for x in Category.objects.filter(active=True).order_by('id').values_list('id',flat=True))
    keys.extend(('latest-job',seo_catalog_key(x)) for x in (site.get('latestJobs') or []) if isinstance(x,dict) and x.get('published',False) is not False)
    keys.extend(('post',str(x)) for x in Post.objects.filter(status='published').order_by('id').values_list('id',flat=True))
    return [f'{kind}:{key}' for kind,key in keys]

def ensure_seo_indexes():
    with transaction.atomic():
        settings=SiteSetting.objects.select_for_update().filter(pk=1).first()
        if settings is None: settings=SiteSetting.objects.create(pk=1)
        blob=_site_blob(settings)
        raw=blob.get('seoIndex') or {}
        items=dict(raw.get('items') or {})
        used={int(v) for v in items.values() if str(v).isdigit() and int(v)>0}
        next_value=max([int(raw.get('next') or 1),max(used,default=0)+1])
        changed=False
        for key in _seo_visible_keys(settings):
            if key in items: continue
            while next_value in used: next_value+=1
            items[key]=next_value;used.add(next_value);next_value+=1;changed=True
        registry={'next':next_value,'items':items}
        if changed or raw!=registry:
            blob['seoIndex']=registry
            _save_site_blob(settings,blob)
            settings.save(update_fields=['admin_permissions','updated_at'])
        return registry

def seo_index_snapshot():
    registry=ensure_seo_indexes()
    return {'next':int(registry.get('next') or 1),'items':dict(registry.get('items') or {})}

def seo_index_number(kind,key):
    registry=ensure_seo_indexes()
    value=(registry.get('items') or {}).get(f'{kind}:{key}')
    return int(value) if value else None

PIN_ENTITY_TYPES={'categories','papers','jobs','years'}
def _pinned_entities(settings=None):
    blob=_site_blob(settings or SiteSetting.get_solo())
    raw=blob.get('pinnedEntities') or {}
    out={}
    for typ in PIN_ENTITY_TYPES:
        vals=[]
        for value in raw.get(typ) or []:
            try:
                ident=int(value)
                if ident>0 and ident not in vals: vals.append(ident)
            except (TypeError,ValueError): pass
        out[typ]=vals[:10]
    return out

def _set_entity_pin(user,typ,rid,mode):
    require(is_super(user),'Only the Super Admin can manage pinned records.')
    require(typ in PIN_ENTITY_TYPES,'This record type cannot be pinned.')
    model=ENTITY_MODELS[typ]; rid=int(rid); require(model.objects.filter(pk=rid).exists(),'Record not found.')
    settings=SiteSetting.get_solo(); blob=_site_blob(settings); pins=_pinned_entities(settings); rows=list(pins.get(typ) or [])
    rows=[x for x in rows if x!=rid]
    if mode=='pin':
        require(len(rows)<10,'You can pin up to 10 records in this section.')
        rows.append(rid)
    elif mode=='up':
        old=list(pins.get(typ) or []); require(rid in old,'Pin this record first.'); i=old.index(rid); rows=old[:]
        if i>0: rows[i-1],rows[i]=rows[i],rows[i-1]
    elif mode=='down':
        old=list(pins.get(typ) or []); require(rid in old,'Pin this record first.'); i=old.index(rid); rows=old[:]
        if i<len(rows)-1: rows[i+1],rows[i]=rows[i],rows[i+1]
    elif mode!='unpin':
        raise ValueError('Invalid pin action.')
    pins[typ]=rows[:10]; blob['pinnedEntities']=pins; _save_site_blob(settings,blob); settings.updated_by=user; settings.save(update_fields=['admin_permissions','updated_by','updated_at'])
    return pins

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
    data={'id':x.id,'brand':x.name,'provider':'direct' if x.provider=='custom' else x.provider,'placement':x.placement,'text':x.body or x.title,'image_url':x.image_url,'destination_url':x.target_url,'enabled':x.active,'start_date':x.starts_at.date().isoformat() if x.starts_at else '','end_date':x.ends_at.date().isoformat() if x.ends_at else '','priority':x.priority,'created_at':iso(x.created_at),'updated_at':iso(x.updated_at)}
    if x.provider=='custom_code': data['code']=x.body
    return data

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

def _delete_mcqs_to_trash(user,ids):
    require(is_super(user),'Only the Super Admin can move MCQs to Trash.')
    clean=[]
    for value in ids or []:
        try:
            rid=int(value)
            if rid>0 and rid not in clean: clean.append(rid)
        except (TypeError,ValueError):
            pass
    require(clean,'Select at least one MCQ.')
    rows=list(MCQ.objects.filter(pk__in=clean).order_by('id'))
    require(rows,'No matching MCQs were found.')
    payload=[_serialize_mcq(x) for x in rows]
    label=rows[0].question[:120] if len(rows)==1 else f'{len(rows)} MCQs'
    tr=TrashRecord.objects.create(kind='mcqs',name=label,payload={'entities':{},'mcqs':payload},deleted_by=user)
    MCQ.objects.filter(pk__in=[x.id for x in rows]).delete()
    log(user,'Deleted MCQs',f'{len(rows)} MCQ(s) moved to Trash')
    return tr,[x.id for x in rows]

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
    if typ in PIN_ENTITY_TYPES:
        settings=SiteSetting.get_solo(); blob=_site_blob(settings); pins=_pinned_entities(settings)
        pins[typ]=[x for x in (pins.get(typ) or []) if int(x)!=int(rid)]
        blob['pinnedEntities']=pins; _save_site_blob(settings,blob); settings.updated_by=user; settings.save(update_fields=['admin_permissions','updated_by','updated_at'])
    tr=TrashRecord.objects.create(kind=typ,name=root.name,payload={'entities':entities,'mcqs':mcq_rows},deleted_by=user)
    log(user,'Deleted '+typ,f'{root.name} · {len(mcq_rows)} MCQ(s) moved to recovery')
    return tr

def _restore_trash_many(user,ids):
    require(is_super(user))
    clean=[]
    for value in ids or []:
        try:
            rid=int(value)
            if rid>0 and rid not in clean: clean.append(rid)
        except (TypeError,ValueError):
            pass
    require(clean,'Select at least one Trash record.')
    restored=0
    for tr in list(TrashRecord.objects.filter(pk__in=clean).order_by('deleted_at')):
        _restore_trash(user,tr); restored+=1
    return {'restored':restored,'ids':clean,'deleted':{'type':'trash','ids':clean}}

def _delete_trash_permanently(user,ids):
    require(is_super(user))
    clean=[]
    for value in ids or []:
        try:
            rid=int(value)
            if rid>0 and rid not in clean: clean.append(rid)
        except (TypeError,ValueError):
            pass
    require(clean,'Select at least one Trash record.')
    qs=TrashRecord.objects.filter(pk__in=clean)
    found=list(qs.values_list('id',flat=True))
    qs.delete()
    if found: log(user,'Permanently deleted Trash',f'{len(found)} recovery record(s) permanently deleted')
    return {'deleted':{'type':'trash','ids':found},'count':len(found)}

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
      'pdfs':site.get('pdfs') or [],'latestJobs':site.get('latestJobs') or [],'currentAffairsConfig':current,'pinnedEntities':_pinned_entities(settings),'pageSeo':page_seo_snapshot(settings),
    }

def _startup_site_state(settings):
    return {
      'settings':{'siteName':settings.site_name,'description':settings.description,'country':settings.country,'mcqEntryCountry':settings.country},
      'seo':{'title':settings.seo_title,'description':settings.seo_description},
    }

def startup_payload(user,session):
    settings=SiteSetting.objects.only('singleton','site_name','description','country','seo_title','seo_description').filter(pk=1).first()
    if settings is None: settings=SiteSetting.objects.create(pk=1)
    authenticated=bool(user and getattr(user,'is_authenticated',False))
    return {'snapshot':{'schemaVersion':13,**_startup_site_state(settings),
                        'totalApprovedMcqs':MCQ.objects.filter(status='approved').count(),
                        'countries':country_catalog(user,include_counts=True,include_inactive=is_super(user))},
            'user':user_identity_dict(user,session) if authenticated else None}

def public_content_data():
    now=timezone.now()
    ads_q=AdPlacement.objects.filter(active=True).filter(Q(starts_at__isnull=True)|Q(starts_at__lte=now)).filter(Q(ends_at__isnull=True)|Q(ends_at__gte=now)).order_by('-priority','id')
    return {
      'posts':[post(x) for x in Post.objects.filter(status='published').order_by('-updated_at')[:50]],
      'guides':[guide(x) for x in Guide.objects.filter(published=True).order_by('-updated_at')[:50]],
      'ads':[_client_ad(x) for x in ads_q[:50]],
    }

def public_resources_data(user=None):
    settings=SiteSetting.get_solo()
    state=_client_site_state(settings)
    data={k:state[k] for k in ['settings','seo','rolePermissions','adSettings','pinnedEntities','pageSeo']}
    # Send hierarchy/catalog indexes, but keep the large MCQ registry paginated.
    registry=seo_index_snapshot()
    data['seoIndex']=registry if is_admin(user) else {
        'next':registry['next'],
        'items':{k:v for k,v in registry['items'].items() if not k.startswith('mcq:')},
    }
    return data

def public_catalog_data():
    settings=SiteSetting.get_solo(); state=_client_site_state(settings)
    return {k:state[k] for k in ['pdfs','latestJobs','currentAffairsConfig']}

def public_legal_data():
    settings=SiteSetting.get_solo(); state=_client_site_state(settings)
    return {'content':state['content']}


def _json_array_length(qs,field,alias):
    function='jsonb_array_length' if connection.vendor=='postgresql' else 'json_array_length'
    return qs.annotate(**{alias:Func(F(field),function=function,output_field=IntegerField())})

def _approved_public_counts(country=None):
    approved=MCQ.objects.filter(status='approved')
    papers=Paper.objects.filter(active=True); jobs=Job.objects.filter(active=True); years=JobYear.objects.filter(active=True)
    categories=Category.objects.filter(active=True)
    if country:
        approved=approved.filter(country__iexact=country)
        papers=papers.filter(country__iexact=country)
        jobs=jobs.filter(paper__country__iexact=country)
        years=years.filter(job__paper__country__iexact=country)
        categories=categories.filter(pk__in=approved.values('category_id').distinct())
    important=_json_array_length(approved,'job_ids','_job_count').filter(_job_count__gte=2).count()
    category_rows=approved.values('category_id').annotate(total=Count('id'))
    return {'approvedMcqs':approved.count(),'importantMcqs':important,'categories':categories.count(),
            'papers':papers.count(),'jobs':jobs.count(),'years':years.count(),
            'categoryMcqs':{str(row['category_id']):int(row['total'] or 0) for row in category_rows}}

def _entity_mcq_counts(kind,ids,public_only=False,country=None):
    ids=[int(x) for x in ids if int(x)>0]
    if not ids: return {}
    base=MCQ.objects.filter(status='approved') if public_only else MCQ.objects.all()
    if country: base=base.filter(country__iexact=country)
    if kind=='categories':
        rows=base.filter(category_id__in=ids).values('category_id').annotate(total=Count('id'))
        return {int(row['category_id']):int(row['total'] or 0) for row in rows}
    field={'papers':'paper_ids','jobs':'job_ids','years':'job_year_ids'}.get(kind)
    if not field: return {}
    if connection.vendor=='postgresql':
        return {ident:base.filter(**{field+'__contains':[ident]}).count() for ident in ids}
    values=list(base.values_list(field,flat=True))
    out={ident:0 for ident in ids}
    wanted=set(ids)
    for raw in values:
        for value in raw or []:
            try: ident=int(value)
            except (TypeError,ValueError): continue
            if ident in wanted: out[ident]=out.get(ident,0)+1
    return out

def entity_page_data(user,kind,page=1,page_size=10,filters=None,public_only=False):
    require(kind in ENTITY_MODELS,'Unknown record type.')
    page=max(1,int(page or 1)); page_size=10
    filters=filters or {}
    model=ENTITY_MODELS[kind]; qs=model.objects.all(); country=country_for_user(user)
    if country:
        if kind=='papers': qs=qs.filter(country__iexact=country)
        elif kind=='jobs': qs=qs.filter(paper__country__iexact=country)
        elif kind=='years': qs=qs.filter(job__paper__country__iexact=country)
    if public_only:
        qs=qs.filter(active=True)
        if kind=='jobs': qs=qs.filter(paper__active=True)
        if kind=='years': qs=qs.filter(job__active=True,job__paper__active=True)
    parent=filters.get('parent')
    rel=ENTITY_PARENT.get(kind)
    if parent and rel:
        try: qs=qs.filter(**{rel[0]:int(parent)})
        except (TypeError,ValueError): pass
    if not country and kind=='papers' and filters.get('country'):
        qs=qs.filter(country__iexact=str(filters['country']))
    if not country and kind=='years' and filters.get('all_papers') and filters.get('country'):
        qs=qs.filter(job__paper__country__iexact=str(filters['country']))
    if filters.get('search'):
        qs=qs.filter(name__icontains=str(filters['search']).strip())
    pins=_pinned_entities().get(kind,[]) if kind in PIN_ENTITY_TYPES else []
    if pins:
        ordering=Case(*[When(pk=ident,then=Value(index)) for index,ident in enumerate(pins)],default=Value(9999),output_field=IntegerField())
        qs=qs.annotate(_pin_order=ordering)
    if filters.get('all_papers') and kind=='years':
        qs=qs.select_related('job__paper').annotate(
            _agency_round=Window(
                expression=RowNumber(),
                partition_by=[F('job__paper_id')],
                order_by=[F('job_id').asc(),F('name').desc(),F('id').asc()],
            )
        ).order_by('_agency_round','job__paper__name','job__name','-name','id')
    elif filters.get('sort')=='new':
        qs=qs.order_by('-id')
    elif pins:
        qs=qs.order_by('_pin_order','name','id')
    else:
        qs=qs.order_by('name','id')
    total=qs.count(); start=(page-1)*page_size
    objects=list(qs[start:start+page_size])
    serializers={'categories':category,'subcategories':subcategory,'children':child,'papers':paper,'jobs':job,'years':year}
    counts=_entity_mcq_counts(kind,[x.id for x in objects],public_only=public_only,country=country or None)
    items=[]
    for obj in objects:
        row=serializers[kind](obj)
        row['mcq_count']=counts.get(int(obj.id),0)
        items.append(row)
    return {'type':kind,'items':items,'page':page,'pageSize':page_size,'total':total,'hasNext':start+len(items)<total,'filters':filters}

def visible_mcqs(user):
    if is_super(user): return MCQ.objects.all()
    if user_role(user)=='admin': return MCQ.objects.filter(Q(status='approved')|Q(created_by=user)|Q(submitted_by=user)).distinct()
    return MCQ.objects.filter(status='approved')

def mcq_page(user,page=1,page_size=50,filters=None):
    filters=filters or {}; page=max(1,int(page or 1)); country=country_for_user(user)
    # Admin list endpoints are deliberately capped so a stale URL cannot pull thousands
    # of full MCQ rows and drive database/network egress. The UI uses 10-row pages;
    # 50 remains available for the on-demand post-import review page.
    max_page_size=50 if is_admin(user) else (100 if user and getattr(user,'is_authenticated',False) else 30)
    page_size=max(1,min(int(page_size or 50),max_page_size))
    qs=MCQ.objects.filter(status='approved') if filters.get('public') else visible_mcqs(user)
    if country: qs=qs.filter(country__iexact=country)
    if filters.get('ids'):
        requested_ids=[]
        for raw in str(filters['ids']).split(',')[:50]:
            try:
                value=int(raw)
                if value>0 and value not in requested_ids: requested_ids.append(value)
            except (TypeError,ValueError):
                pass
        qs=qs.filter(pk__in=requested_ids) if requested_ids else qs.none()
    if filters.get('owner')=='me' and user and getattr(user,'is_authenticated',False):
        qs=qs.filter(created_by=user)
    if filters.get('status'):
        status=str(filters['status'])
        if status=='pending': qs=qs.filter(Q(status='pending')|Q(pending_update__isnull=False)).distinct()
        elif status in {'approved','rejected'}: qs=qs.filter(status=status,pending_update__isnull=True)
    if filters.get('category'):
        try: qs=qs.filter(category_id=int(filters['category']))
        except (TypeError,ValueError): pass
    if filters.get('country') and not country:
        qs=qs.filter(country__iexact=str(filters['country']))
    if filters.get('important'):
        qs=_json_array_length(qs,'job_ids','_job_count').filter(_job_count__gte=2)
    if filters.get('repeated'):
        qs=_json_array_length(qs,'job_year_ids','_year_count').filter(_year_count__gte=2)
    for key,field in [('subcategory','subcategory_ids'),('child','child_subcategory_ids')]:
        if filters.get(key):
            try: qs=qs.filter(**{field+'__contains':[int(filters[key])]})
            except (TypeError,ValueError): pass
    if filters.get('author'):
        if str(filters['author'])=='unknown': qs=qs.filter(created_by__isnull=True)
        else:
            try: qs=qs.filter(created_by_id=int(filters['author']))
            except (TypeError,ValueError): pass
    if filters.get('from'): qs=qs.filter(created_at__date__gte=str(filters['from']))
    if filters.get('to'): qs=qs.filter(created_at__date__lte=str(filters['to']))
    if filters.get('id'):
        try: qs=qs.filter(pk=int(filters['id']))
        except (TypeError,ValueError): pass
    if filters.get('search'):
        term=str(filters['search']).strip()
        if term:
            paper_ids=list(Paper.objects.filter(name__icontains=term).values_list('id',flat=True)[:500])
            job_ids=list(Job.objects.filter(name__icontains=term).values_list('id',flat=True)[:500])
            year_ids=list(JobYear.objects.filter(name__icontains=term).values_list('id',flat=True)[:500])
            search_q=(
                Q(question__icontains=term)|Q(option1__icontains=term)|Q(option2__icontains=term)|
                Q(option3__icontains=term)|Q(option4__icontains=term)|Q(correct_answer__icontains=term)|
                Q(description__icontains=term)|Q(category__name__icontains=term)|
                Q(created_by__first_name__icontains=term)|Q(created_by__last_name__icontains=term)|
                Q(created_by__email__icontains=term)|Q(submitted_by__first_name__icontains=term)|
                Q(submitted_by__last_name__icontains=term)|Q(submitted_by__email__icontains=term)
            )
            if connection.vendor=='postgresql':
                if paper_ids: search_q|=Q(paper_ids__overlap=paper_ids)
                if job_ids: search_q|=Q(job_ids__overlap=job_ids)
                if year_ids: search_q|=Q(job_year_ids__overlap=year_ids)
            qs=qs.filter(search_q).distinct()
    # JSON membership filters are supported by PostgreSQL/Supabase. Keep them optional.
    for key,field in [('paper','paper_ids'),('job','job_ids'),('year','job_year_ids')]:
        if filters.get(key):
            try: qs=qs.filter(**{field+'__contains':[int(filters[key])]})
            except (TypeError,ValueError): pass
    order=['-created_at','-id'] if filters.get('latest') else ['-id']
    qs=qs.select_related('category','created_by','submitted_by','reviewed_by','approved_by').defer('source','seo_description','audit_history').annotate(_page_total=Window(expression=Count('id'))).order_by(*order)
    start=(page-1)*page_size
    objects=list(qs[start:start+page_size])
    _attach_important_flags(objects)
    total=int(objects[0]._page_total) if objects else (qs.count() if page>1 else 0)
    rows=[mcq_list(x) for x in objects]
    keys={f"mcq:{x['id']}" for x in rows}
    registry=_site_blob().get('seoIndex') or {}
    if any(key not in (registry.get('items') or {}) for key in keys): registry=seo_index_snapshot()
    indexes={'next':int(registry.get('next') or 1),'items':{k:v for k,v in (registry.get('items') or {}).items() if k in keys}}
    return {'items':rows,'page':page,'pageSize':page_size,'total':total,'hasNext':start+len(rows)<total,'seoIndex':indexes}

def _attach_important_flags(objects):
    """Apply the final Important rule from distinct linked Job IDs without extra queries."""
    for obj in objects:
        jobs=set()
        for value in obj.job_ids or []:
            try: jobs.add(int(value))
            except (TypeError,ValueError): pass
        obj._important_value=len(jobs)>=2

def snapshot(user):
    country=country_for_user(user)
    cats_qs=Category.objects.select_related('created_by','updated_by').all()
    subs_qs=Subcategory.objects.select_related('created_by','updated_by').all()
    childs_qs=ChildCategory.objects.select_related('created_by','updated_by').all()
    papers_qs=Paper.objects.select_related('created_by','updated_by').all()
    jobs_qs=Job.objects.select_related('paper','created_by','updated_by').all()
    years_qs=JobYear.objects.select_related('job__paper','created_by','updated_by').all()
    if country:
        papers_qs=papers_qs.filter(country__iexact=country)
        jobs_qs=jobs_qs.filter(paper__country__iexact=country)
        years_qs=years_qs.filter(job__paper__country__iexact=country)
    cats=list(cats_qs.order_by('id')); subs=list(subs_qs.order_by('id')); childs=list(childs_qs.order_by('id'))
    papers=list(papers_qs.order_by('id')); jobs=list(jobs_qs.order_by('id')); years=list(years_qs.order_by('id'))
    # Public/admin list rows are loaded only for the page the visitor opens.
    # Bootstrap keeps exact totals and lightweight hierarchy/reference metadata,
    # but does not preload MCQ rows from other pages.
    site_counts=_approved_public_counts(country or None)
    rows=[]
    total=site_counts['approvedMcqs']
    data={
      'schemaVersion':12,
      'countries':country_catalog(user,include_counts=True,include_inactive=is_super(user)),
      'categories':[category(x) for x in cats],'subcategories':[subcategory(x) for x in subs],'children':[child(x) for x in childs],
      'papers':[paper(x) for x in papers],'jobs':[job(x) for x in jobs],'years':[year(x) for x in years],
      'pinnedEntities':_pinned_entities(),
      'pageSeo':page_seo_snapshot(),
      'mcqs':rows,'mcqPage':{'page':1,'pageSize':0,'total':total,'hasNext':total>0},'siteCounts':site_counts,
    }
    # The permanent SEO index registry is admin-only client data. Public SEO routes
    # resolve indexes on the server and do not need this large map in bootstrap JSON.
    if is_admin(user): data['seoIndex']=seo_index_snapshot()
    return data

def learner_dashboard_data(user):
    require(bool(user and getattr(user,'is_authenticated',False)))
    country=country_for_user(user)
    attempts_qs=Attempt.objects.filter(user=user); bookmarks_qs=Bookmark.objects.filter(user=user); saved_qs=SavedPaper.objects.filter(user=user)
    if country:
        attempts_qs=attempts_qs.filter(mcq__country__iexact=country)
        bookmarks_qs=bookmarks_qs.filter(mcq__country__iexact=country)
        saved_qs=saved_qs.filter(paper__country__iexact=country)
    attempts=list(attempts_qs.order_by('-created_at')[:100])
    bookmarks=list(bookmarks_qs.values_list('mcq_id',flat=True))
    saved=list(saved_qs.values_list('paper_id',flat=True))
    return {
        'attempts':[{'id':a.mcq_id,'answer':a.answer,'correct':a.correct,'at':iso(a.created_at),'by_id':user.id,'by':user_name(user)} for a in attempts],
        'bookmarks':bookmarks,
        'savedPapers':saved,
    }

def admin_overview_data(user,active_role=None):
    require(is_admin(user))
    super_view=is_super(user) and active_role=='super-admin'
    qs=MCQ.objects.all() if super_view else MCQ.objects.filter(created_by=user)
    mine_qs=MCQ.objects.filter(created_by=user)
    country=country_for_user(user)
    if country and not super_view:
        qs=qs.filter(country__iexact=country)
        mine_qs=mine_qs.filter(country__iexact=country)
    counts=qs.aggregate(
        total=Count('id'),
        pending=Count('id',filter=Q(status='pending')|Q(pending_update__isnull=False)),
        approved=Count('id',filter=Q(status='approved',pending_update__isnull=True)),
        rejected=Count('id',filter=Q(status='rejected',pending_update__isnull=True)),
    )
    recent=[mcq_list(x) for x in qs.select_related('category','created_by','submitted_by','reviewed_by','approved_by').order_by('-updated_at','-id')[:5]]
    mine_counts=mine_qs.aggregate(total=Count('id'),pending=Count('id',filter=Q(status='pending')|Q(pending_update__isnull=False)),approved=Count('id',filter=Q(status='approved',pending_update__isnull=True)),rejected=Count('id',filter=Q(status='rejected',pending_update__isnull=True)))
    data={'mcqs':counts,'mine':mine_counts,'recent':recent,'openReports':0,'staff':0,'staffPreview':[],'staffCounts':{},'staffStats':{},'unassigned':{},'learners':0,'trash':0}
    if super_view:
        data['openReports']=Report.objects.exclude(status__in=['resolved','closed']).count()
        people=User.objects.aggregate(total=Count('id'),staff=Count('id',filter=Q(profile__role__in=['admin','super-admin'])))
        data['staff']=people['staff'] or 0; data['learners']=(people['total'] or 0)-data['staff']; data['trash']=TrashRecord.objects.count()
        staff=User.objects.select_related('profile').filter(profile__role__in=['admin','super-admin']).order_by('id')[:4]
        data['staffPreview']=[{'id':x.id,'name':user_name(x),'email':x.email,'role':user_role(x)} for x in staff]
        staff_rows=MCQ.objects.exclude(created_by_id__isnull=True).values('created_by_id').annotate(
            total=Count('id'),
            pending=Count('id',filter=Q(status='pending')|Q(pending_update__isnull=False)),
            approved=Count('id',filter=Q(status='approved',pending_update__isnull=True)),
            rejected=Count('id',filter=Q(status='rejected',pending_update__isnull=True)),
        )
        data['staffStats']={str(row['created_by_id']):{key:int(row[key] or 0) for key in ['total','pending','approved','rejected']} for row in staff_rows}
        data['staffCounts']={key:value['total'] for key,value in data['staffStats'].items()}
        data['unassigned']=MCQ.objects.filter(created_by_id__isnull=True).aggregate(
            total=Count('id'),
            pending=Count('id',filter=Q(status='pending')|Q(pending_update__isnull=False)),
            approved=Count('id',filter=Q(status='approved',pending_update__isnull=True)),
            rejected=Count('id',filter=Q(status='rejected',pending_update__isnull=True)),
        )
    elif has_perm(user,'view_reports'):
        data['openReports']=Report.objects.exclude(status__in=['resolved','closed']).count()
    return data

def admin_users_data(user,page=1,page_size=50):
    require(is_super(user) or has_perm(user,'manage_users') or has_perm(user,'manage_admins'))
    page=max(1,int(page or 1)); page_size=max(1,min(int(page_size or 50),100))
    qs=User.objects.select_related('profile').order_by('id')
    country=country_for_user(user)
    if country: qs=qs.filter(profile__country__iexact=country)
    total=qs.count(); start=(page-1)*page_size
    return {'items':[user_admin_dict(x) for x in qs[start:start+page_size]],'page':page,'pageSize':page_size,'total':total,'hasNext':start+page_size<total}

def admin_reports_data(user,page=1,page_size=50):
    require(is_super(user) or has_perm(user,'view_reports'))
    page=max(1,int(page or 1)); page_size=max(1,min(int(page_size or 50),100))
    qs=Report.objects.select_related('user','mcq').order_by('-created_at')
    country=country_for_user(user)
    if country: qs=qs.filter(mcq__country__iexact=country)
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

def _bulk_question_key(question):
    text=unicodedata.normalize('NFKC',str(question or '')).replace('\u00a0',' ')
    return re.sub(r'\s+',' ',text).strip().casefold()

def _bulk_duplicate_mcq(question,country=None):
    question=str(question or '').strip()
    if not question: return None
    base=MCQ.objects.all()
    if country: base=base.filter(country__iexact=str(country))
    exact=base.filter(question__iexact=question).first()
    if exact: return exact
    parts=[x for x in re.split(r'\s+',question) if x]
    if parts:
        pattern=r'^\s*'+r'\s+'.join(re.escape(x) for x in parts)+r'\s*$'
        loose=base.filter(question__iregex=pattern).first()
        if loose: return loose
    target=_bulk_question_key(question)
    anchor=next((x for x in re.findall(r'[\w]+',question,flags=re.UNICODE) if len(x)>=3),'')
    candidates=base.filter(question__icontains=anchor)[:200] if anchor else MCQ.objects.none()
    return next((row for row in candidates if _bulk_question_key(row.question)==target),None)

def _mcq_hierarchy_from_years(year_ids, paper_ids=None, job_ids=None):
    """Return only real database IDs and rebuild parent hierarchy from those IDs."""
    requested_years=normalize_ids(year_ids)
    requested_jobs=normalize_ids(job_ids)
    requested_papers=normalize_ids(paper_ids)

    year_rows=list(JobYear.objects.filter(pk__in=requested_years).select_related('job__paper'))
    valid_year_ids={int(y.id) for y in year_rows}
    years=[x for x in requested_years if x in valid_year_ids]

    job_rows=list(Job.objects.filter(pk__in=requested_jobs).select_related('paper'))
    valid_job_ids={int(j.id) for j in job_rows}
    jobs=[x for x in requested_jobs if x in valid_job_ids]

    valid_paper_ids=set(Paper.objects.filter(pk__in=requested_papers).values_list('id',flat=True))
    papers=[x for x in requested_papers if x in valid_paper_ids]

    # Job IDs imply their real parent Paper IDs.
    for job in job_rows:
        if job.id in jobs and job.paper_id not in papers:
            papers.append(job.paper_id)

    # Job Year IDs are the strongest source of truth: each one implies its Job and Paper.
    for year in year_rows:
        if year.id not in years:
            continue
        if year.job_id not in jobs:
            jobs.append(year.job_id)
        if year.job.paper_id not in papers:
            papers.append(year.job.paper_id)

    return papers,jobs,years

def _is_important_hierarchy(job_year_ids):
    years=normalize_ids(job_year_ids)
    if len(set(years)) < 2:
        return False
    parent_jobs=set(JobYear.objects.filter(pk__in=years).values_list('job_id',flat=True))
    return len(parent_jobs) >= 2

def _merge_bulk_mcq_hierarchy(user,existing,draft):
    # Accept both frontend/API naming and model naming so no hierarchy link is lost.
    incoming_year_source=draft.get('job_years_ids')
    if incoming_year_source in (None,''):
        incoming_year_source=draft.get('job_year_ids')
    incoming_paper_source=draft.get('paper_id')
    if incoming_paper_source in (None,''):
        incoming_paper_source=draft.get('paper_ids')
    incoming_papers,incoming_jobs,incoming_years=_mcq_hierarchy_from_years(
        incoming_year_source,incoming_paper_source,draft.get('job_ids')
    )
    incoming={'paper_ids':incoming_papers,'job_ids':incoming_jobs,'job_year_ids':incoming_years}
    changed=[]
    for field,values in incoming.items():
        current=normalize_ids(getattr(existing,field,None))
        merged=current+[x for x in values if x not in current]
        if merged!=current:
            setattr(existing,field,merged)
            changed.append(field)
    # Rebuild parent Job/Paper mappings from every saved Job Year as well.
    papers,jobs,years=_mcq_hierarchy_from_years(existing.job_year_ids,existing.paper_ids,existing.job_ids)
    for field,values in [('paper_ids',papers),('job_ids',jobs),('job_year_ids',years)]:
        if normalize_ids(getattr(existing,field,None))!=values:
            setattr(existing,field,values)
            if field not in changed: changed.append(field)
    important=_is_important_hierarchy(existing.job_year_ids)
    if existing.important!=important:
        existing.important=important
        changed.append('important')
    if changed:
        existing.save(update_fields=changed)
        log(user,'Merged bulk MCQ hierarchy',f'{existing.question} · papers={existing.paper_ids} · jobs={existing.job_ids} · years={existing.job_year_ids}')
        return 'merged'
    return 'duplicate'

def _stage_bulk_mcq_hierarchy_update(user,existing,draft):
    """Keep approved MCQs live as-is while staging imported hierarchy changes for review."""
    incoming_year_source=draft.get('job_years_ids')
    if incoming_year_source in (None,''):
        incoming_year_source=draft.get('job_year_ids')
    incoming_paper_source=draft.get('paper_id')
    if incoming_paper_source in (None,''):
        incoming_paper_source=draft.get('paper_ids')
    incoming_papers,incoming_jobs,incoming_years=_mcq_hierarchy_from_years(
        incoming_year_source,incoming_paper_source,draft.get('job_ids')
    )

    current_papers=normalize_ids(existing.paper_ids)
    current_jobs=normalize_ids(existing.job_ids)
    current_years=normalize_ids(existing.job_year_ids)
    merged_papers=current_papers+[x for x in incoming_papers if x not in current_papers]
    merged_jobs=current_jobs+[x for x in incoming_jobs if x not in current_jobs]
    merged_years=current_years+[x for x in incoming_years if x not in current_years]
    merged_papers,merged_jobs,merged_years=_mcq_hierarchy_from_years(
        merged_years,merged_papers,merged_jobs
    )

    changed=(merged_papers!=current_papers or merged_jobs!=current_jobs or merged_years!=current_years)
    if not changed:
        return 'duplicate'

    # Pending MCQs are not public yet, so merge directly into the pending record.
    if existing.status!='approved':
        existing.paper_ids=merged_papers
        existing.job_ids=merged_jobs
        existing.job_year_ids=merged_years
        existing.important=_is_important_hierarchy(merged_years)
        existing.status='pending'
        existing.submission_type='update' if existing.pk else 'new'
        existing.submitted_by=user
        existing.submitted_at=timezone.now()
        existing.updated_by=user
        existing.save(update_fields=['paper_ids','job_ids','job_year_ids','important','status','submission_type','submitted_by','submitted_at','updated_by','updated_at'])
        log(user,'Merged pending bulk MCQ hierarchy',existing.question)
        return 'pending'

    # Approved/live MCQs keep their public data unchanged until manual approval.
    proposed=mcq(existing)
    proposed.update({
        'paper_id':merged_papers,
        'job_ids':merged_jobs,
        'job_years_ids':merged_years,
        'important':_is_important_hierarchy(merged_years),
        'updated_at':iso(timezone.now()),
        'updated_by':user_name(user),
        'updated_by_id':user.id,
    })
    existing.pending_update={
        'proposed':proposed,
        'submitted_by':user_name(user),
        'submitted_by_id':user.id,
        'submitted_at':iso(timezone.now()),
        'approval_status':'pending',
        'reason':'',
    }
    existing.submission_type='update'
    existing.submitted_by=user
    existing.submitted_at=timezone.now()
    existing.updated_by=user
    existing.save(update_fields=['pending_update','submission_type','submitted_by','submitted_at','updated_by','updated_at'])
    log(user,'Staged bulk MCQ hierarchy update',existing.question)
    return 'pending-update'

def _import_hierarchy(draft):
    years=draft.get('job_years_ids')
    if years in (None,''): years=draft.get('job_year_ids')
    papers=draft.get('paper_id')
    if papers in (None,''): papers=draft.get('paper_ids')
    return _mcq_hierarchy_from_years(years,papers,draft.get('job_ids'))

def _combine_import_rows(rows):
    """Group same-question rows before saving so hierarchy from later rows cannot be lost."""
    groups=[]
    by_key={}
    invalid=0
    for row in rows or []:
        if not isinstance(row,dict):
            invalid+=1
            continue
        if row.get('status')=='invalid':
            invalid+=1
            continue
        # Frontend preview rows use {"q": {...}}. API/tests may also send the
        # normalized MCQ draft directly. Support both shapes.
        source=row.get('q') if isinstance(row.get('q'),dict) else row
        draft=dict(source or {})
        question=str(draft.get('question') or '').strip()
        key=_bulk_question_key(question)
        if not key:
            invalid+=1
            continue
        papers,jobs,years=_import_hierarchy(draft)
        signature=(tuple(sorted(papers)),tuple(sorted(jobs)),tuple(sorted(years)))
        if key not in by_key:
            draft['paper_id']=papers
            draft['job_ids']=jobs
            draft['job_years_ids']=years
            group={'draft':draft,'signatures':{signature},'extra_merges':0,'duplicates':0}
            by_key[key]=group
            groups.append(group)
            continue
        group=by_key[key]
        if signature in group['signatures']:
            group['duplicates']+=1
            continue
        before=(
            set(normalize_ids(group['draft'].get('paper_id'))),
            set(normalize_ids(group['draft'].get('job_ids'))),
            set(normalize_ids(group['draft'].get('job_years_ids'))),
        )
        added=(
            any(x not in before[0] for x in papers) or
            any(x not in before[1] for x in jobs) or
            any(x not in before[2] for x in years)
        )
        if added:
            group['draft']['paper_id']=normalize_ids(group['draft'].get('paper_id'))+[x for x in papers if x not in before[0]]
            group['draft']['job_ids']=normalize_ids(group['draft'].get('job_ids'))+[x for x in jobs if x not in before[1]]
            group['draft']['job_years_ids']=normalize_ids(group['draft'].get('job_years_ids'))+[x for x in years if x not in before[2]]
            group['extra_merges']+=1
        else:
            group['duplicates']+=1
        group['signatures'].add(signature)
    return groups,invalid


def _create_bulk_pending_mcq(user,draft):
    """Create one new Pending MCQ after bulk duplicate detection has already found no website match."""
    require(is_admin(user) and has_perm(user,'bulk_import_mcqs'))
    cid=validate_mcq_data(draft)
    paper_ids,job_ids,job_year_ids=_mcq_hierarchy_from_years(
        draft.get('job_years_ids'),draft.get('paper_id'),draft.get('job_ids')
    )
    write_country=country_for_write(user,draft.get('country'))
    _validate_hierarchy_country(write_country,paper_ids,job_ids,job_year_ids)
    now=timezone.now()
    obj=MCQ(
        id=next_id(MCQ),
        question=str(draft.get('question') or '').strip(),
        option1=str(draft.get('option1') or '').strip(),
        option2=str(draft.get('option2') or '').strip(),
        option3=str(draft.get('option3') or '').strip(),
        option4=str(draft.get('option4') or '').strip(),
        correct_answer=str(draft.get('correct_answer') or '').strip(),
        description=str(draft.get('description') or '').strip(),
        source=str(draft.get('source') or '').strip(),
        seo_description=str(draft.get('seo_description') or '').strip(),
        category_id=cid,
        subcategory_ids=normalize_ids(draft.get('subcategory_ids')),
        child_subcategory_ids=normalize_ids(draft.get('child_subcategory_ids')),
        paper_ids=paper_ids,
        job_ids=job_ids,
        job_year_ids=job_year_ids,
        important=_is_important_hierarchy(job_year_ids),
        country=write_country,
        status='pending',
        submission_type='new',
        created_by=user,
        updated_by=user,
        submitted_by=user,
        submitted_at=now,
    )
    obj.save()
    log(user,'Bulk imported new pending MCQ',obj.question)
    return obj

def save_mcq(user,draft):
    require(is_admin(user) and has_perm(user,'add_mcq'))
    cid=validate_mcq_data(draft); qid=int(draft.get('id') or 0) or None
    existing=MCQ.objects.filter(pk=qid).first() if qid else None
    write_country=country_for_write(user,draft.get('country'))
    if existing:
        require(is_super(user) or (existing.created_by_id==user.id and existing.status!='approved'))
        if not is_super(user):
            require(str(existing.country or '').casefold()==write_country.casefold(),'This MCQ belongs to another country.')
    dup=MCQ.objects.filter(question__iexact=str(draft['question']).strip(),country__iexact=write_country)
    if existing: dup=dup.exclude(pk=existing.pk)
    duplicate=dup.first()
    if duplicate:
        # Manual entry follows the same rule as bulk import: one question record,
        # with every Paper / Job / Job Year occurrence merged into its hierarchy.
        # Never overwrite the canonical answer/explanation from a duplicate entry.
        _merge_bulk_mcq_hierarchy(user,duplicate,draft)
        return duplicate
    common={k:str(draft.get(k,'')).strip() for k in ['question','option1','option2','option3','option4','correct_answer','description','source','seo_description']}
    paper_ids,job_ids,job_year_ids=_mcq_hierarchy_from_years(draft.get('job_years_ids'),draft.get('paper_id'),draft.get('job_ids'))
    _validate_hierarchy_country(write_country,paper_ids,job_ids,job_year_ids)
    common.update(category_id=cid,subcategory_ids=normalize_ids(draft.get('subcategory_ids')),child_subcategory_ids=normalize_ids(draft.get('child_subcategory_ids')),paper_ids=paper_ids,job_ids=job_ids,job_year_ids=job_year_ids,important=_is_important_hierarchy(job_year_ids),country=write_country)
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
    if isinstance(ids,(list,tuple,set)):
        ids=[int(x) for x in ids if str(x).strip().isdigit()]
    else:
        ids=[int(x) for x in str(ids).split(',') if str(x).strip().isdigit()]
    if status not in {'approved','rejected','pending'}: raise ValueError('Invalid review status.')
    if status!='approved' and not str(reason).strip(): raise ValueError('A reason is required.')
    country=country_for_user(user)
    review_qs=MCQ.objects.filter(id__in=ids)
    if country: review_qs=review_qs.filter(country__iexact=country)
    for q in review_qs:
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
        q.important=_is_important_hierarchy(q.job_year_ids)
        q.reviewed_by=user
        if status=='approved': q.approved_by=user
        hist=q.audit_history or []; hist.insert(0,{'type':q.submission_type,'reviewed_by':user_name(user),'reviewed_by_id':user.id,'reviewed_at':iso(timezone.now()),'approval_status':status,'reason':reason}); q.audit_history=hist[:100]
        q.save(); log(user,f'MCQ {status}',q.question)

def save_entity(user,payload):
    fields,values,ctx,_=parse_fields(payload); typ=ctx.get('type'); require(typ in ENTITY_MODELS,'Invalid entity type.'); perm={'categories':'manage_categories','subcategories':'manage_subcategories','children':'manage_child_categories','papers':'manage_papers','jobs':'manage_jobs','years':'manage_job_years'}[typ]; require(is_admin(user) and has_perm(user,perm))
    model=ENTITY_MODELS[typ]; rid=int(ctx.get('id') or 0) or None; name=str(values.get('entity-name') or '').strip();
    if not name: raise ValueError('Name is required.')
    icon_url=str(values.get('entity-icon-url') or '').strip()
    if icon_url and not re.match(r'^https?://',icon_url,re.I): raise ValueError('Icon URL must start with http:// or https://.')
    icon=str(icon_url or values.get('entity-icon-data') or values.get('entity-icon') or 'grid').strip() or 'grid'; active='entity-active' in fields
    obj=model.objects.filter(pk=rid).first() if rid else None
    country=country_for_user(user)
    if country and rid and obj:
        if typ=='papers': require(str(obj.country or '').casefold()==country.casefold(),'This paper belongs to another country.')
        elif typ=='jobs': require(str(obj.paper.country or '').casefold()==country.casefold(),'This job belongs to another country.')
        elif typ=='years': require(str(obj.job.paper.country or '').casefold()==country.casefold(),'This job year belongs to another country.')
    if not obj: obj=model(id=next_id(model),created_by=user)
    obj.name=name; obj.icon=icon; obj.active=active; obj.updated_by=user
    if typ=='papers': obj.country=country_for_write(user,values.get('entity-country'))
    if typ in ENTITY_PARENT:
        fk,_=ENTITY_PARENT[typ]; pid=int(values.get('entity-parent') or 0); require(pid>0,'Choose a valid parent.')
        if country and typ=='jobs': require(Paper.objects.filter(pk=pid,country__iexact=country).exists(),'Choose a paper from your assigned country.')
        if country and typ=='years': require(Job.objects.filter(pk=pid,paper__country__iexact=country).exists(),'Choose a job from your assigned country.')
        setattr(obj,fk,pid)
    obj.save()
    if typ=='papers':
        now=timezone.now()
        Job.objects.filter(paper_id=obj.id).update(icon=obj.icon,updated_by=user,updated_at=now)
        JobYear.objects.filter(job__paper_id=obj.id).update(icon=obj.icon,updated_by=user,updated_at=now)
    page_seo=None
    if is_super(user) and typ in PAGE_SEO_ENTITY_KINDS and ('entity-seo-title' in values or 'entity-seo-description' in values):
        page_seo=save_page_seo_entry(user,PAGE_SEO_ENTITY_KINDS[typ],obj.id,values.get('entity-seo-title'),values.get('entity-seo-description'))
    log(user,f'Saved {typ}',name); return {'type':typ,'entity':_serialize_entity(typ,obj),**({'pageSeo':page_seo} if page_seo is not None else {})}

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
    obj.body=str(v.get('body') or '').strip(); require(obj.body,'Blog content is required.'); obj.excerpt=re.sub(r'\s+',' ',obj.body).strip()[:180]; image_data=str(v.get('featured_image_data') or ''); image_url=str(v.get('featured_image') or ''); obj.featured_image=image_url if image_url.startswith(('http://','https://')) else ''; obj.category=obj.category or 'Exam preparation'; obj.seo_title=(str(v.get('seo_title') or '').strip() or obj.title)[:80]; obj.seo_description=(str(v.get('seo_description') or '').strip() or obj.excerpt)[:300]; obj.status='published'; links=[]
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
        s.site_name=_canonical_brand_text(v.get('siteName') or 'MCQCampus')[:120]; s.description=_canonical_brand_text(v.get('description') or ''); s.country=str(v.get('country') or 'Pakistan')[:80]; blob['mcqEntryCountry']=str(v.get('country') or s.country)[:80]
    elif view=='seo': s.seo_title=_clean_public_seo_title(v.get('title') or 'MCQCampus')[:160]; s.seo_description=_canonical_brand_text(v.get('description') or '')
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
    m=re.match(r'^\{([^}]+)\}\s*(.+)$',text)
    if m: return m.group(2).strip(),m.group(1).strip()
    m=re.match(r'^\[([^\]]+)\]\s*(.+)$',text)
    if m: return m.group(2).strip(),m.group(1).strip()[:32]
    bits=text.split(None,1)
    if len(bits)==2 and any(ord(ch)>127 for ch in bits[0]): return bits[1].strip(),bits[0][:32]
    return text,default_icon

def _bulk_blocks(raw):
    text=str(raw or '').replace('\r\n','\n').replace('\r','\n').strip()
    if not text: return []
    starts=list(re.finditer(r'(?im)^(?:title|pdf title|paper|organization)\s*:',text))
    if len(starts)>1:
        return [text[m.start():(starts[i+1].start() if i+1<len(starts) else len(text))].strip() for i,m in enumerate(starts)]
    return [block.strip() for block in re.split(r'\n\s*\n+',text) if block.strip()]

def _bulk_labeled(block):
    out={}; free=[]; current=None
    aliases={
        'title':'title','pdf title':'title','job':'title','job title':'title','paper':'paper','organization':'paper',
        'description':'description','content':'content','body':'content','url':'url','download url':'url','download link':'url',
        'apply url':'apply_url','apply link':'apply_url','last date':'last_date','date':'last_date',
        'preparation url':'prep_url','preparation link':'prep_url','prepare url':'prep_url','prepare link':'prep_url','blog url':'url'
    }
    for raw_line in block.splitlines():
        line=raw_line.strip()
        m=re.match(r'^([A-Za-z][A-Za-z ]{1,30})\s*:\s*(.*)$',line)
        if m and m.group(1).strip().lower() in aliases:
            current=aliases[m.group(1).strip().lower()]
            value=m.group(2).strip()
            if value: out[current]=(out.get(current,'')+'\n'+value).strip()
        elif current in {'description','content'}:
            out[current]=(out.get(current,'')+'\n'+raw_line.strip()).strip()
        elif line:
            free.append(line)
    out['_free']=free
    return out

def _bulk_date(value):
    value=str(value or '').strip()
    if not value: return ''
    for fmt in ('%Y-%m-%d','%d-%m-%Y','%d/%m/%Y','%d %b %Y','%d %B %Y','%b %d, %Y','%B %d, %Y'):
        try: return datetime.strptime(value,fmt).date().isoformat()
        except Exception: pass
    return value

def _bulk_safe_url(value):
    return str(value or '').strip() if re.match(r'^https?://',str(value or '').strip(),re.I) else ''

def _unique_slug(rows,title,prefix,new_id):
    base=slugify(title) or f'{prefix}-{new_id}'
    used={str(x.get('slug') or '').strip().lower() for x in rows}
    return base if base.lower() not in used else f'{base}-{new_id}'

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
        require(is_super(user) or has_perm(user,'manage_pdfs'))
        rows=list(blob.get('pdfs') or [])
        rid=int(c.get('id') or 0)
        old=next((x for x in rows if int(x.get('id',0))==rid),None)
        title=str(v.get('title') or '').strip()
        require(title,'PDF Title is required.')
        download=str(v.get('pdf_file_data') or v.get('download_url') or (old or {}).get('download_url') or '').strip()
        require(download,'Choose a PDF file or enter a Download URL.')
        new_id=rid or next_catalog_id(rows,'pdf',s)
        base_slug=slugify(title) or f'pdf-{new_id}'
        used_slugs={str(x.get('slug') or '').strip().lower() for x in rows if int(x.get('id',0))!=new_id}
        item_slug=base_slug if base_slug.lower() not in used_slugs else f'{base_slug}-{new_id}'
        new={'id':new_id,'title':title,'slug':item_slug,'description':str(v.get('description') or ''),'seo_title':str(v.get('seo_title') or (old or {}).get('seo_title') or '').strip()[:180],'seo_description':str(v.get('seo_description') or (old or {}).get('seo_description') or '').strip()[:500],'download_url':download,'cover':str(v.get('cover_data') or v.get('cover') or (old or {}).get('cover') or ''),'active':True,'created_at':(old or {}).get('created_at') or now,'created_by':(old or {}).get('created_by') or user_name(user),'created_by_id':(old or {}).get('created_by_id') or user.id,'updated_at':now,'updated_by':user_name(user),'updated_by_id':user.id}
        rows=[new if int(x.get('id',0))==new['id'] else x for x in rows] if old else [new]+rows
        blob['pdfs']=rows
    elif form=='latest-job':
        require(is_super(user) or has_perm(user,'manage_latest_jobs'))
        rows=list(blob.get('latestJobs') or [])
        rid=int(c.get('id') or 0)
        old=next((x for x in rows if int(x.get('id',0))==rid),None)
        paper_id=int(v.get('paper_id') or 0)
        require(Paper.objects.filter(pk=paper_id).exists(),'Choose a valid Organization / Paper.')
        title=str(v.get('title') or '').strip()
        last=str(v.get('last_date') or '').strip()
        require(title and last,'Job Title and Last Date are required.')
        new_id=rid or next_catalog_id(rows,'latest-job',s)
        base_slug=slugify(title) or f'latest-job-{new_id}'
        used_slugs={str(x.get('slug') or '').strip().lower() for x in rows if int(x.get('id',0))!=new_id}
        item_slug=base_slug if base_slug.lower() not in used_slugs else f'{base_slug}-{new_id}'
        new={'id':new_id,'paper_id':paper_id,'title':title,'slug':item_slug,'description':str(v.get('description') or (old or {}).get('description') or '').strip(),'seo_title':str(v.get('seo_title') or (old or {}).get('seo_title') or '').strip()[:180],'seo_description':str(v.get('seo_description') or (old or {}).get('seo_description') or '').strip()[:500],'last_date':last,'apply_url':str(v.get('apply_url') or ''),'prep_url':str(v.get('prep_url') or ''),'published':'published' in fields,'created_at':(old or {}).get('created_at') or now,'created_by':(old or {}).get('created_by') or user_name(user),'created_by_id':(old or {}).get('created_by_id') or user.id,'updated_at':now,'updated_by':user_name(user),'updated_by_id':user.id}
        rows=[new if int(x.get('id',0))==new['id'] else x for x in rows] if old else [new]+rows
        blob['latestJobs']=rows
    elif form=='bulk-pdfs':
        require(is_super(user) or has_perm(user,'manage_pdfs'))
        rows=list(blob.get('pdfs') or []); count=0
        for block in _bulk_blocks(v.get('bulk_text')):
            d=_bulk_labeled(block); free=d.pop('_free',[])
            title=str(d.get('title') or (free[0] if free else '')).strip()
            url=_bulk_safe_url(d.get('url') or (free[-1] if free and re.match(r'^https?://',free[-1],re.I) else ''))
            description=str(d.get('description') or '').strip()
            if not description and free:
                middle=free[1:-1] if url and len(free)>1 else free[1:]
                description='\n'.join(middle).strip()
            if not title or not url: raise ValueError('Each PDF block needs a title and a valid http/https download URL.')
            old=next((x for x in rows if str(x.get('title') or '').strip().casefold()==title.casefold()),None)
            new_id=int((old or {}).get('id') or next_catalog_id(rows,'pdf',s))
            new={'id':new_id,'title':title,'slug':(old or {}).get('slug') or _unique_slug(rows,title,'pdf',new_id),'description':description,'download_url':url,'cover':(old or {}).get('cover') or '','active':True,'created_at':(old or {}).get('created_at') or now,'created_by':(old or {}).get('created_by') or user_name(user),'created_by_id':(old or {}).get('created_by_id') or user.id,'updated_at':now,'updated_by':user_name(user),'updated_by_id':user.id}
            rows=[new if int(x.get('id',0))==new_id else x for x in rows] if old else [new]+rows; count+=1
        blob['pdfs']=rows
        log(user,'Bulk PDF import',f'{count} PDF(s) processed')
    elif form=='bulk-latest-jobs':
        require(is_super(user) or has_perm(user,'manage_latest_jobs'))
        rows=list(blob.get('latestJobs') or []); count=0
        for block in _bulk_blocks(v.get('bulk_text')):
            d=_bulk_labeled(block); free=d.pop('_free',[])
            paper_name=str(d.get('paper') or (free[0] if free else '')).strip()
            title=str(d.get('title') or (free[1] if len(free)>1 else '')).strip()
            last=_bulk_date(d.get('last_date') or (free[2] if len(free)>2 else ''))
            apply_url=_bulk_safe_url(d.get('apply_url') or d.get('url') or next((x for x in free[3:] if re.match(r'^https?://',x,re.I)),'')) 
            prep_url=_bulk_safe_url(d.get('prep_url') or '')
            require(paper_name and title and last,'Each Latest Job block needs Paper/Organization, Job Title and Last Date.')
            paper=Paper.objects.filter(name__iexact=paper_name).first()
            if not paper:
                paper=Paper.objects.create(id=next_id(Paper),name=paper_name,country=s.country,icon='briefcase',created_by=user,updated_by=user)
            old=next((x for x in rows if int(x.get('paper_id') or 0)==paper.id and str(x.get('title') or '').strip().casefold()==title.casefold() and str(x.get('last_date') or '')==last),None)
            new_id=int((old or {}).get('id') or next_catalog_id(rows,'latest-job',s))
            new={'id':new_id,'paper_id':paper.id,'title':title,'slug':(old or {}).get('slug') or _unique_slug(rows,title,'latest-job',new_id),'last_date':last,'apply_url':apply_url,'prep_url':prep_url,'published':True,'created_at':(old or {}).get('created_at') or now,'created_by':(old or {}).get('created_by') or user_name(user),'created_by_id':(old or {}).get('created_by_id') or user.id,'updated_at':now,'updated_by':user_name(user),'updated_by_id':user.id}
            rows=[new if int(x.get('id',0))==new_id else x for x in rows] if old else [new]+rows; count+=1
        blob['latestJobs']=rows
        log(user,'Bulk Latest Jobs import',f'{count} job(s) processed')
    elif form=='bulk-posts':
        require(is_super(user) or has_perm(user,'manage_posts')); count=0
        for block in _bulk_blocks(v.get('bulk_text')):
            d=_bulk_labeled(block); free=d.pop('_free',[])
            title=str(d.get('title') or (free[0] if free else '')).strip()
            url=_bulk_safe_url(d.get('url') or (free[-1] if free and re.match(r'^https?://',free[-1],re.I) else ''))
            content=str(d.get('content') or d.get('description') or '').strip()
            if not content and free:
                middle=free[1:-1] if url and len(free)>1 else free[1:]
                content='\n'.join(middle).strip()
            require(title and content,'Each Blog block needs a Title and Content.')
            obj=Post.objects.filter(title__iexact=title).first() or Post(created_by=user)
            obj.title=title; obj.slug=slugify(title)[:120] or f'post-{timezone.now().timestamp():.0f}'
            if Post.objects.exclude(pk=obj.pk).filter(slug=obj.slug).exists(): obj.slug=f'{obj.slug[:105]}-{int(timezone.now().timestamp())}'
            obj.body=content; obj.excerpt=re.sub(r'\s+',' ',content).strip()[:180]; obj.category=obj.category or 'Exam preparation'; obj.seo_title=obj.title[:80]; obj.seo_description=obj.excerpt[:300]; obj.status='published'
            old_links=[x for x in (obj.links or []) if x.get('label')!='__blog_url']
            if url: old_links.append({'label':'__blog_url','url':url})
            obj.links=old_links; obj.updated_by=user; obj.save(); count+=1
        log(user,'Bulk Blog import',f'{count} post(s) processed'); return {'processed':count}
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

def save_page_seo_form(user,payload):
    require(is_super(user),'Only the Super Admin can edit public page SEO content.')
    _,v,ctx,_=parse_fields(payload)
    kind=str(ctx.get('kind') or '').strip()
    key=str(ctx.get('key') or '').strip()
    require(kind and key,'Choose a valid public page.')
    allowed={'static','category','paper','job','year','mcq','pdf','latest-job','post'}
    require(kind in allowed,'Unsupported public page type.')
    rows=save_page_seo_entry(user,kind,key,v.get('seo_title'),v.get('seo_description'))
    log(user,'Updated page SEO',f'{kind}:{key}')
    return {'pageSeo':rows}

def save_ad(user,payload):
    require(is_super(user)); fields,v,c,_=parse_fields(payload); rid=int(c.get('id') or 0) or None; obj=AdPlacement.objects.filter(pk=rid).first() if rid else AdPlacement(created_by=user)
    obj.name=str(v.get('name') or '').strip(); obj.provider=str(v.get('provider') or 'custom'); obj.placement=str(v.get('placement') or 'top_banner'); obj.title=str(v.get('title') or ''); obj.body=str(v.get('body') or ''); obj.image_url=str(v.get('image_url') or ''); obj.target_url=str(v.get('target_url') or ''); obj.adsense_slot=str(v.get('adsense_slot') or '').strip(); obj.priority=int(v.get('priority') or 0); obj.active='active' in fields; obj.updated_by=user
    if not obj.name: raise ValueError('Ad name is required.')
    if obj.provider=='adsense' and not obj.adsense_slot: raise ValueError('AdSense slot ID is required.')
    if obj.provider=='custom_code' and not obj.body.strip(): raise ValueError('Custom ad code is required.')
    obj.save(); log(user,'Saved ad placement',obj.name); return {'ad':ad(obj)}

def command(user,action,payload):
    action=str(action or '').strip()
    # Backward-compatible admin command aliases. Old cached frontend builds and
    # newer buttons must resolve to the same server-side actions instead of
    # falling through to "Unsupported command".
    while action.startswith('action:action:'):
        action=action[len('action:'):]
    aliases={
        'mcq-delete':'action:mcq-delete',
        'delete-mcq':'action:mcq-delete',
        'delete-mcqs':'action:mcq-bulk-delete',
        'bulk-mcq-delete':'action:mcq-bulk-delete',
        'bulk-mcq-delete-confirm':'action:mcq-delete',
        'mcq-delete-confirm':'action:mcq-delete-confirm',
        'trash-restore':'action:trash-restore',
        'restore-trash':'action:restore-trash',
        'trash-bulk-restore':'action:trash-bulk-restore',
        'trash-restore-many':'action:trash-restore-many',
        'trash-permanent-delete':'action:trash-permanent-delete',
        'trash-bulk-delete':'action:trash-bulk-delete',
        'entity-delete-confirm':'action:entity-delete-confirm',
        'entity-bulk-delete':'action:entity-bulk-delete',
        'hierarchy-bulk-delete':'action:hierarchy-bulk-delete',
        'entity-pin':'action:entity-pin',
        'import-confirm':'action:import-confirm',
        'report-resolve':'action:report-resolve',
        'user-status':'action:user-status',
        'post-delete':'action:post-delete',
        'pdf-delete':'action:pdf-delete',
        'latest-job-toggle':'action:latest-job-toggle',
        'latest-job-delete':'action:latest-job-delete',
        'ad-toggle':'action:ad-toggle',
        'ad-delete':'action:ad-delete',
    }
    action=aliases.get(action,action)
    if action=='attempt':
        qid,answer=payload.get('args',[None,None]); qs=MCQ.objects.filter(pk=qid,status='approved')
        country=country_for_user(user)
        if country: qs=qs.filter(country__iexact=country)
        q=qs.first()
        if not q: raise ValueError('Question not available.')
        correct=str(q.correct_answer)==str(answer); Attempt.objects.create(user=user,mcq=q,answer=str(answer),correct=correct); return correct
    if action=='toggleBookmark':
        qid=(payload.get('args') or [None])[0]; qs=MCQ.objects.filter(pk=qid)
        country=country_for_user(user)
        if country: qs=qs.filter(country__iexact=country)
        q=qs.first()
        if not q: raise ValueError('Question not available.')
        obj,created=Bookmark.objects.get_or_create(user=user,mcq=q)
        if not created: obj.delete(); return False
        return True
    if action=='savePaper':
        pid=(payload.get('args') or [None])[0]; qs=Paper.objects.filter(pk=pid)
        country=country_for_user(user)
        if country: qs=qs.filter(country__iexact=country)
        p=qs.first()
        if not p: raise ValueError('Paper not available.')
        obj,created=SavedPaper.objects.get_or_create(user=user,paper=p)
        if not created: obj.delete(); return False
        return True
    if action=='report':
        qid,reason=payload.get('args',[None,'']); require(str(reason).strip(),'Enter a report reason.')
        qs=MCQ.objects.filter(pk=qid)
        country=country_for_user(user)
        if country: qs=qs.filter(country__iexact=country)
        q=qs.first()
        if not q: raise ValueError('Question not available.')
        r=Report.objects.create(user=user,mcq=q,reason=str(reason)); return {'report':{'id':r.id,'mcq_id':r.mcq_id,'reason':r.reason,'status':r.status,'by_id':user.id,'by':user_name(user),'at':iso(r.created_at)}}
    if action=='saveProfile':
        vals=(payload.get('args') or [{}])[0] or {}; user.first_name=str(vals.get('name') or user_name(user)); new_email=str(vals.get('email') or user.email).strip().lower(); require('@' in new_email,'Enter a valid email.'); require(not User.objects.exclude(pk=user.pk).filter(email=new_email).exists(),'That email is already in use.'); user.email=new_email; user.username=new_email; user.save(); prof=profile_for(user)
        if is_super(user) and vals.get('country'): prof.country=country_for_write(user,vals.get('country'))
        _save_profile_payload(prof,vals)
        if not is_super(user): prof.country=country_for_user(user) or prof.country
        prof.save(); return user_profile_dict(user)
    if action=='changePassword':
        raise ValueError('Use the secure password change flow with email verification.')
    if action=='form:mcq':
        draft=payload.get('draft') or {}
        obj=save_mcq(user,draft)
        result={'mcq':mcq(MCQ.objects.select_related('category','created_by','submitted_by','reviewed_by','approved_by').get(pk=obj.pk))}
        if is_super(user) and ('page_seo_title' in draft or 'page_seo_description' in draft):
            result['pageSeo']=save_page_seo_entry(user,'mcq',obj.pk,draft.get('page_seo_title'),draft.get('page_seo_description'))
        return result
    if action=='form:review':
        _,v,c,_=parse_fields(payload)
        status=c.get('status','pending'); reason=v.get('reason','')
        all_pending=str(c.get('allPending') or c.get('all_pending') or '').lower() in {'1','true','yes','on'}
        if all_pending:
            require(is_super(user),'Only the Super Admin can approve all pending MCQs.')
            require(status=='approved','Select-all pending can only be used for approval.')
            ids=list(MCQ.objects.filter(Q(status='pending')|Q(pending_update__isnull=False)).values_list('id',flat=True))
            review_mcqs(user,ids,status,reason)
            return {'mcqs':[],'reviewedCount':len(ids),'allPending':True,'status':status}
        ids=[int(x) for x in str(c.get('ids','')).split(',') if str(x).strip().isdigit()]
        review_mcqs(user,c.get('ids',''),status,reason)
        rows=MCQ.objects.filter(pk__in=ids).select_related('category','created_by','submitted_by','reviewed_by','approved_by')
        country=country_for_user(user)
        if country: rows=rows.filter(country__iexact=country)
        return {'mcqs':[mcq(x) for x in rows],'reviewedCount':len(ids),'status':status}
    if action=='form:entity': return save_entity(user,payload)
    if action=='form:user': return save_user(user,payload)
    if action=='form:guide': return save_guide(user,payload)
    if action=='form:post': return save_post(user,payload)
    if action=='form:config': return save_config(user,payload)
    if action=='form:page-seo': return save_page_seo_form(user,payload)
    if action=='form:pdf':
        save_site_form(user,'pdf',payload); return {'pdfs':_site_blob(SiteSetting.get_solo()).get('pdfs') or []}
    if action=='form:latest-job':
        save_site_form(user,'latest-job',payload); return {'latestJobs':_site_blob(SiteSetting.get_solo()).get('latestJobs') or []}
    if action=='form:bulk-pdfs':
        save_site_form(user,'bulk-pdfs',payload); return {'pdfs':_site_blob(SiteSetting.get_solo()).get('pdfs') or []}
    if action=='form:bulk-latest-jobs':
        save_site_form(user,'bulk-latest-jobs',payload); return {'latestJobs':_site_blob(SiteSetting.get_solo()).get('latestJobs') or []}
    if action=='form:bulk-posts':
        result=save_site_form(user,'bulk-posts',payload); return {'processed':(result or {}).get('processed',0),'posts':[post(x) for x in Post.objects.filter(status='published').order_by('-updated_at')[:100]]}
    if action in {'form:footer-settings','form:social-links','form:legal-page','form:ad-config','form:direct-ad','form:bulk-hierarchy','form:bulk-categories'}: return save_site_form(user,action[5:],payload)
    if action=='form:ad': return save_ad(user,payload)
    if action=='form:contact':
        _,v,_,_=parse_fields(payload); ContactMessage.objects.create(user=user,name=str(v.get('name') or user_name(user)),email=str(v.get('email') or user.email),message=str(v.get('message') or '')); return True
    if action=='form:profile':
        _,v,_,_=parse_fields(payload); return command(user,'saveProfile',{'args':[v]})
    if action=='form:password-change':
        raise ValueError('Use the secure password change flow with email verification.')
    if action=='action:report-resolve':
        require(is_super(user) or has_perm(user,'resolve_reports')); rid=int(payload.get('id')); qs=Report.objects.select_related('mcq').filter(pk=rid)
        country=country_for_user(user)
        if country: qs=qs.filter(mcq__country__iexact=country)
        r=qs.first()
        if not r: raise ValueError('Report not found.')
        r.status='resolved'; r.resolved_at=timezone.now(); r.resolved_by=user; r.save(); log(user,'Resolved report',rid); return {'report':{'id':r.id,'mcq_id':r.mcq_id,'reason':r.reason,'status':r.status,'by_id':r.user_id,'by':user_name(r.user) if r.user else 'Visitor','at':iso(r.created_at)}}
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
    if action=='action:latest-job-bulk-delete':
        require(is_super(user) or has_perm(user,'delete_latest_jobs'))
        ids=payload.get('ids') or []
        if not isinstance(ids,list) or not ids: raise ValueError('Select at least one job.')
        selected={int(value) for value in ids}
        with transaction.atomic():
            s=SiteSetting.objects.select_for_update().get(pk=SiteSetting.get_solo().pk)
            blob=_site_blob(s); rows=list(blob.get('latestJobs') or [])
            removed=[x for x in rows if int(x.get('id',0)) in selected]
            blob['latestJobs']=[x for x in rows if int(x.get('id',0)) not in selected]
            _save_site_blob(s,blob); s.updated_by=user; s.save()
            log(user,'Deleted latest jobs',', '.join(str(x.get('id')) for x in removed))
        return {'latestJobs':blob['latestJobs'],'count':len(removed)}
    if action in {'action:pdf-delete','action:latest-job-delete','action:latest-job-toggle'}:
        form='pdfs' if action=='action:pdf-delete' else 'latestJobs'; perm='delete_pdfs' if form=='pdfs' else ('delete_latest_jobs' if action.endswith('delete') else 'manage_latest_jobs'); require(is_super(user) or has_perm(user,perm)); s=SiteSetting.get_solo(); blob=_site_blob(s); rows=list(blob.get(form) or []); rid=int(payload.get('id'))
        if action.endswith('toggle'):
            for x in rows:
                if int(x.get('id',0))==rid: x['published']=not bool(x.get('published',True)); x['updated_at']=timezone.now().isoformat()
        else: rows=[x for x in rows if int(x.get('id',0))!=rid]
        blob[form]=rows; _save_site_blob(s,blob); s.updated_by=user; s.save(); return {form:rows}
    if action=='action:entity-pin':
        return {'pinnedEntities':_set_entity_pin(user,payload.get('type'),payload.get('id'),str(payload.get('mode') or 'pin'))}
    if action in {'action:mcq-delete','action:mcq-delete-confirm','action:mcq-bulk-delete'}:
        tr,deleted_ids=_delete_mcqs_to_trash(user,payload.get('ids') or [payload.get('id')])
        return {'deleted':{'type':'mcqs','ids':deleted_ids},'trashId':tr.id,'count':len(deleted_ids)}
    if action in {'action:trash-restore-many','action:trash-bulk-restore'}:
        return _restore_trash_many(user,payload.get('ids') or [payload.get('id')])
    if action in {'action:trash-permanent-delete','action:trash-bulk-delete'}:
        return _delete_trash_permanently(user,payload.get('ids') or [payload.get('id')])
    if action in {'action:entity-delete-confirm','action:entity-bulk-delete','action:hierarchy-bulk-delete'}:
        typ=payload.get('type'); ids=payload.get('ids') or [payload.get('id')]; count=0
        for rid in ids:
            if rid and ENTITY_MODELS.get(typ) and _delete_entity(user,typ,int(rid)) is not None: count+=1
        return {'deleted':{'type':typ,'ids':[int(x) for x in ids if x]}}
    if action in {'action:trash-restore','action:restore-trash'}:
        rid=int(payload.get('id')); _restore_trash(user,TrashRecord.objects.get(pk=rid)); return {'deleted':{'type':'trash','ids':[rid]},'restored':1}
    if action=='action:import-confirm':
        require(is_admin(user) and has_perm(user,'bulk_import_mcqs'))
        summary={'imported':0,'updated':0,'merged':0,'duplicates':0,'invalid':0,'failed':0,'errors':[]}
        imported_ids=[]
        results=[]
        input_rows=payload.get('rows') or []
        groups,invalid=_combine_import_rows(input_rows)
        summary['invalid']=invalid
        if input_rows and not groups:
            raise ValueError('Selected MCQs reached the server, but no importable MCQ data was found. Re-upload the file and try again.')
        for group in groups:
            draft=group['draft']
            summary['duplicates']+=group['duplicates']
            question=str(draft.get('question') or '')[:160]
            try:
                write_country=country_for_write(user,draft.get('country'))
                papers,jobs,years=_import_hierarchy(draft)
                _validate_hierarchy_country(write_country,papers,jobs,years)
                duplicate=_bulk_duplicate_mcq(draft.get('question'),write_country)
                if duplicate:
                    result=_stage_bulk_mcq_hierarchy_update(user,duplicate,draft)
                    if result in {'pending','pending-update'}:
                        imported_ids.append(duplicate.pk)
                        summary['updated']+=1
                        summary['merged']+=group['extra_merges']
                        results.append({'id':duplicate.pk,'question':question,'result':'pending-update'})
                    else:
                        summary['duplicates']+=1
                        imported_ids.append(duplicate.pk)
                        results.append({'id':duplicate.pk,'question':question,'result':'already-exists'})
                    continue

                # No website match exists: create exactly one NEW pending MCQ from the
                # already-consolidated upload group. Do not run duplicate detection a second time.
                obj=_create_bulk_pending_mcq(user,draft)
                imported_ids.append(obj.pk)
                summary['imported']+=1
                summary['merged']+=group['extra_merges']
                results.append({'id':obj.pk,'question':question,'result':'pending-new'})
            except ValueError as exc:
                summary['failed']+=1
                message=str(exc)
                if len(summary['errors'])<20:
                    summary['errors'].append({'question':question,'message':message})
                results.append({'question':question,'result':'failed','message':message})
        # Never send every imported MCQ back in one response. Keep the complete ID list
        # (small integers) so the browser can request 50 detail rows only when the user
        # opens the next import-result page.
        imported_ids=list(dict.fromkeys(imported_ids))
        imported=MCQ.objects.filter(pk__in=imported_ids).select_related('category','created_by','submitted_by','reviewed_by','approved_by').order_by('-id')[:50]
        return {
            'summary':summary,
            'results':results[:50],
            'resultTotal':len(results),
            'importedIds':imported_ids,
            'importPage':{'page':1,'pageSize':50,'total':len(imported_ids),'hasNext':len(imported_ids)>50},
            'mcqs':[mcq(x) for x in imported],
        }

    raise ValueError(f'Unsupported command: {action}')

def _otp_hash(user,purpose,code):
    key=str(settings.SECRET_KEY).encode('utf-8')
    message=f'{user.pk}:{purpose}:{str(code)}'.encode('utf-8')
    return hmac.new(key,message,hashlib.sha256).hexdigest()

def create_token(user,purpose,minutes=10):
    if purpose not in {'verify','reset','change'}: raise ValueError('Invalid token purpose.')
    OneTimeToken.objects.filter(user=user,purpose=purpose,used_at__isnull=True).update(used_at=timezone.now())
    raw=f'{secrets.randbelow(1000000):06d}'
    OneTimeToken.objects.create(user=user,purpose=purpose,code_hash=_otp_hash(user,purpose,raw),expires_at=timezone.now()+timedelta(minutes=minutes))
    return raw

def consume_token(user,raw,purpose,max_attempts=5):
    if not user or purpose not in {'verify','reset','change'}: return None
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

