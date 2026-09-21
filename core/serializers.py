from django.utils import timezone
from .models import *

def iso(value): return value.isoformat().replace('+00:00','Z') if value else None
def user_dict(u,session=None):
    p=profile_for(u); role=p.role if p else 'user'; roles=['user']
    if role in {'admin','super-admin'}: roles.append('admin')
    if role=='super-admin': roles.append('super-admin')
    active=(session or {}).get('active_role') or ('super-admin' if role=='super-admin' else 'admin' if role=='admin' else 'user')
    if active not in roles: active=roles[-1]
    return {'id':u.id,'name':user_name(u),'email':u.email,'role':role,'roles':roles,'activeRole':active,'permissions':p.permissions or [],'country':p.country,'avatar':p.avatar or '','status':'active' if u.is_active else 'disabled','expiresAt':iso(timezone.now()+timezone.timedelta(seconds=60*60*24*30))}

def entity_base(x):
    return {'id':x.id,'name':x.name,'icon':x.icon,'active':x.active,'created_at':iso(x.created_at),'updated_at':iso(x.updated_at),'created_by':user_name(x.created_by) if x.created_by else None,'created_by_id':x.created_by_id,'updated_by':user_name(x.updated_by) if x.updated_by else None,'updated_by_id':x.updated_by_id}
def category(x): return entity_base(x)
def subcategory(x): return {**entity_base(x),'category_id':x.category_id}
def child(x): return {**entity_base(x),'subcategory_id':x.subcategory_id}
def paper(x): return {**entity_base(x),'country':x.country,'paper_icon':x.icon}
def job(x): return {**entity_base(x),'paper_id':x.paper_id}
def year(x): return {**entity_base(x),'job_id':x.job_id}
def mcq(x):
    return {'id':x.id,'question':x.question,'option1':x.option1,'option2':x.option2,'option3':x.option3,'option4':x.option4,'correct_answer':x.correct_answer,'description':x.description,'category_id':x.category_id,'subcategory_ids':x.subcategory_ids or [],'child_subcategory_ids':x.child_subcategory_ids or [],'paper_id':x.paper_ids or [],'job_ids':x.job_ids or [],'job_years_ids':x.job_year_ids or [],'country':x.country,'status':x.status,'important':x.important,'created_by':user_name(x.created_by) if x.created_by else 'Unknown','created_by_id':x.created_by_id,'reviewed_by':user_name(x.reviewed_by) if x.reviewed_by else '','approved_by':user_name(x.approved_by) if x.approved_by else '','rejection_reason':x.rejection_reason,'created_at':iso(x.created_at),'updated_at':iso(x.updated_at),'source':x.source,'seo_description':x.seo_description,'submission_type':x.submission_type,'submitted_by':user_name(x.submitted_by) if x.submitted_by else (user_name(x.created_by) if x.created_by else 'Unknown'),'submitted_by_id':x.submitted_by_id,'submitted_at':iso(x.submitted_at),'pending_update':x.pending_update,'audit_history':x.audit_history or []}
def guide(x): return {'id':x.id,'name':x.name,'tag':x.tag,'summary':x.summary,'body':x.body,'published':x.published,'created_at':iso(x.created_at),'updated_at':iso(x.updated_at),'created_by_id':x.created_by_id}
def post(x): return {'id':x.id,'title':x.title,'slug':x.slug,'excerpt':x.excerpt,'body':x.body,'featured_image':x.featured_image,'category':x.category,'seo_title':x.seo_title,'seo_description':x.seo_description,'links':x.links or [],'status':x.status,'published':x.status=='published','created_at':iso(x.created_at),'updated_at':iso(x.updated_at),'created_by_id':x.created_by_id}
def ad(x): return {'id':x.id,'name':x.name,'provider':x.provider,'placement':x.placement,'title':x.title,'body':x.body,'image_url':x.image_url,'target_url':x.target_url,'adsense_slot':x.adsense_slot,'active':x.active,'starts_at':iso(x.starts_at),'ends_at':iso(x.ends_at),'priority':x.priority,'created_at':iso(x.created_at),'updated_at':iso(x.updated_at)}


def job_opening(x):
    today=timezone.localdate()
    if x.last_date:
        days=(x.last_date-today).days
        deadline_status='closed' if days<0 else 'closing-soon' if days<=7 else 'open'
    else:
        deadline_status='open'
    return {
        'id':x.id,'title':x.title,'slug':x.slug,'organization':x.organization,'category':x.category,
        'advertisement_number':x.advertisement_number,'total_vacancies':x.total_vacancies,'location':x.location,
        'qualification':x.qualification,'experience_requirement':x.experience_requirement,'age_limit':x.age_limit,
        'gender':x.gender,'domicile':x.domicile,'employment_type':x.employment_type,
        'advertisement_date':x.advertisement_date.isoformat() if x.advertisement_date else None,
        'last_date':x.last_date.isoformat() if x.last_date else None,
        'official_advertisement':x.official_advertisement,'official_apply_link':x.official_apply_link,
        'recruiting_authority':x.recruiting_authority,'syllabus':x.syllabus,
        'eligibility_details':x.eligibility_details,'important_instructions':x.important_instructions,
        'status':x.status,'deadline_status':deadline_status,'published':x.status=='published',
        'related_mcq_ids':list(x.related_mcqs.values_list('id',flat=True)),
        'related_category_ids':list(x.related_categories.values_list('id',flat=True)),
        'related_paper_ids':list(x.related_papers.values_list('id',flat=True)),
        'related_guide_ids':list(x.related_guides.values_list('id',flat=True)),
        'related_post_ids':list(x.related_posts.values_list('id',flat=True)),
        'related_job_ids':list(x.related_jobs.values_list('id',flat=True)),
        'created_at':iso(x.created_at),'updated_at':iso(x.updated_at),'created_by_id':x.created_by_id,
    }
