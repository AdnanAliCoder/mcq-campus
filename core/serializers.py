import json
from .models import *

def iso(value): return value.isoformat().replace('+00:00','Z') if value else None
def _profile_extra(p):
    raw=str(p.avatar or '') if p else ''; extra={'avatar':raw}; prefix='__MCQ_PROFILE__:'
    if raw.startswith(prefix):
        try:
            parsed=json.loads(raw[len(prefix):]); extra=parsed if isinstance(parsed,dict) else {'avatar':''}
        except Exception: extra={'avatar':''}
    return extra

def user_identity_dict(u,session=None):
    p=profile_for(u); role=user_role(u); permissions=p.permissions or []; elevated=role=='super-admin' or 'super_admin_permission' in permissions; roles=['user']
    if role in {'admin','super-admin'}: roles.append('admin')
    if elevated: roles.append('super-admin')
    active=(session or {}).get('active_role') or ('super-admin' if role=='super-admin' else 'admin' if role=='admin' else 'user')
    if active not in roles: active=roles[-1]
    return {'id':u.id,'name':user_name(u),'email':u.email,'role':role,'roles':roles,'activeRole':active,'permissions':permissions,'country':p.country,'status':'active' if u.is_active else 'disabled'}

def user_admin_dict(u,session=None):
    return {**user_identity_dict(u,session),'created_at':iso(u.date_joined),'updated_at':iso(u.last_login or u.date_joined)}

def user_profile_dict(u,session=None):
    base=user_identity_dict(u,session); extra=_profile_extra(profile_for(u))
    return {**base,'avatar':extra.get('avatar',''),'exam_goal':extra.get('exam_goal','PPSC'),'interests':extra.get('interests',[]),'daily_goal':extra.get('daily_goal',25),'testsTaken':extra.get('testsTaken',0),'lastTestSummary':extra.get('lastTestSummary')}

# Backward-compatible name now deliberately stays lightweight for list/auth paths.
def user_dict(u,session=None): return user_identity_dict(u,session)

def entity_base(x):
    return {'id':x.id,'name':x.name,'icon':x.icon,'active':x.active,'created_at':iso(x.created_at),'updated_at':iso(x.updated_at),'created_by':user_name(x.created_by) if x.created_by else None,'created_by_id':x.created_by_id,'updated_by':user_name(x.updated_by) if x.updated_by else None,'updated_by_id':x.updated_by_id}
def category(x): return entity_base(x)
def subcategory(x): return {**entity_base(x),'category_id':x.category_id}
def child(x): return {**entity_base(x),'subcategory_id':x.subcategory_id}
def paper(x): return {**entity_base(x),'country':x.country,'paper_icon':x.icon}
def job(x):
    row={**entity_base(x),'paper_id':x.paper_id}
    if getattr(x,'paper',None): row['icon']=x.paper.icon
    return row
def year(x):
    row={**entity_base(x),'job_id':x.job_id}
    job_obj=getattr(x,'job',None)
    paper_obj=getattr(job_obj,'paper',None) if job_obj else None
    if paper_obj: row['icon']=paper_obj.icon
    return row
def _important_mcq(x):
    years=list(dict.fromkeys(x.job_year_ids or []))
    if len(years)<2: return False
    return JobYear.objects.filter(pk__in=years).values('job_id').distinct().count()>=2

def mcq(x):
    return {'id':x.id,'question':x.question,'option1':x.option1,'option2':x.option2,'option3':x.option3,'option4':x.option4,'correct_answer':x.correct_answer,'description':x.description,'category_id':x.category_id,'subcategory_ids':x.subcategory_ids or [],'child_subcategory_ids':x.child_subcategory_ids or [],'paper_id':x.paper_ids or [],'job_ids':x.job_ids or [],'job_years_ids':x.job_year_ids or [],'country':x.country,'status':x.status,'important':_important_mcq(x),'created_by':user_name(x.created_by) if x.created_by else 'Unknown','created_by_id':x.created_by_id,'reviewed_by':user_name(x.reviewed_by) if x.reviewed_by else '','approved_by':user_name(x.approved_by) if x.approved_by else '','rejection_reason':x.rejection_reason,'created_at':iso(x.created_at),'updated_at':iso(x.updated_at),'source':x.source,'seo_description':x.seo_description,'submission_type':x.submission_type,'submitted_by':user_name(x.submitted_by) if x.submitted_by else (user_name(x.created_by) if x.created_by else 'Unknown'),'submitted_by_id':x.submitted_by_id,'submitted_at':iso(x.submitted_at),'pending_update':x.pending_update,'audit_history':x.audit_history or []}
def mcq_list(x):
    return {'id':x.id,'question':x.question,'option1':x.option1,'option2':x.option2,'option3':x.option3,'option4':x.option4,'correct_answer':x.correct_answer,'description':x.description,'category_id':x.category_id,'subcategory_ids':x.subcategory_ids or [],'child_subcategory_ids':x.child_subcategory_ids or [],'paper_id':x.paper_ids or [],'job_ids':x.job_ids or [],'job_years_ids':x.job_year_ids or [],'country':x.country,'status':x.status,'important':_important_mcq(x),'created_by':user_name(x.created_by) if x.created_by else 'Unknown','created_by_id':x.created_by_id,'reviewed_by':user_name(x.reviewed_by) if x.reviewed_by else '','approved_by':user_name(x.approved_by) if x.approved_by else '','rejection_reason':x.rejection_reason,'created_at':iso(x.created_at),'updated_at':iso(x.updated_at),'submission_type':x.submission_type,'submitted_by':user_name(x.submitted_by) if x.submitted_by else (user_name(x.created_by) if x.created_by else 'Unknown'),'submitted_by_id':x.submitted_by_id,'submitted_at':iso(x.submitted_at),'pending_update':x.pending_update}

def guide(x): return {'id':x.id,'name':x.name,'tag':x.tag,'summary':x.summary,'body':x.body,'published':x.published,'created_at':iso(x.created_at),'updated_at':iso(x.updated_at),'created_by_id':x.created_by_id}
def post(x):
    links=x.links or []; image=next((r.get('url','') for r in links if isinstance(r,dict) and r.get('label')=='__featured_image_data'),x.featured_image); public_links=[r for r in links if not (isinstance(r,dict) and r.get('label')=='__featured_image_data')]
    return {'id':x.id,'title':x.title,'slug':x.slug,'excerpt':x.excerpt,'body':x.body,'featured_image':image,'category':x.category,'seo_title':x.seo_title,'seo_description':x.seo_description,'links':public_links,'status':x.status,'published':x.status=='published','created_at':iso(x.created_at),'updated_at':iso(x.updated_at),'created_by_id':x.created_by_id}
def ad(x): return {'id':x.id,'name':x.name,'provider':x.provider,'placement':x.placement,'title':x.title,'body':x.body,'image_url':x.image_url,'target_url':x.target_url,'adsense_slot':x.adsense_slot,'active':x.active,'starts_at':iso(x.starts_at),'ends_at':iso(x.ends_at),'priority':x.priority,'created_at':iso(x.created_at),'updated_at':iso(x.updated_at)}
