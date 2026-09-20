import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_datetime
from core.models import *

class Command(BaseCommand):
    help='Import bundled private-data/seed.json without overwriting existing records.'
    def handle(self,*args,**opts):
        path=Path(__file__).resolve().parents[3]/'private-data'/'seed.json'
        if not path.exists(): self.stdout.write(self.style.WARNING('Seed file not found; skipping.')); return
        d=json.loads(path.read_text(encoding='utf-8'))
        for x in d.get('categories',[]): Category.objects.get_or_create(id=x['id'],defaults={'name':x['name'],'icon':x.get('icon','grid'),'active':x.get('active',True)})
        for x in d.get('subcategories',[]): Subcategory.objects.get_or_create(id=x['id'],defaults={'name':x['name'],'icon':x.get('icon','grid'),'active':x.get('active',True),'category_id':x['category_id']})
        for x in d.get('children',[]): ChildCategory.objects.get_or_create(id=x['id'],defaults={'name':x['name'],'icon':x.get('icon','grid'),'active':x.get('active',True),'subcategory_id':x['subcategory_id']})
        for x in d.get('papers',[]): Paper.objects.get_or_create(id=x['id'],defaults={'name':x['name'],'icon':x.get('icon') or x.get('paper_icon') or 'paper','active':x.get('active',True),'country':x.get('country','Pakistan')})
        for x in d.get('jobs',[]): Job.objects.get_or_create(id=x['id'],defaults={'name':x['name'],'icon':x.get('icon','grid'),'active':x.get('active',True),'paper_id':x['paper_id']})
        for x in d.get('years',[]): JobYear.objects.get_or_create(id=x['id'],defaults={'name':x['name'],'icon':x.get('icon','grid'),'active':x.get('active',True),'job_id':x['job_id']})
        for x in d.get('mcqs',[]):
            MCQ.objects.get_or_create(id=x['id'],defaults={'question':x['question'],'option1':x['option1'],'option2':x['option2'],'option3':x['option3'],'option4':x['option4'],'correct_answer':x['correct_answer'],'description':x.get('description',''),'category_id':x['category_id'],'subcategory_ids':x.get('subcategory_ids',[]),'child_subcategory_ids':x.get('child_subcategory_ids',[]),'paper_ids':x.get('paper_id',[]),'job_ids':x.get('job_ids',[]),'job_year_ids':x.get('job_years_ids',[]),'country':x.get('country','Pakistan'),'status':x.get('status','pending'),'important':x.get('important',False),'source':x.get('source',''),'submission_type':x.get('submission_type','new'),'audit_history':x.get('audit_history',[]),'created_at':parse_datetime(x.get('created_at','')) or None,'submitted_at':parse_datetime(x.get('submitted_at','')) or None})
        SiteSetting.get_solo()
        self.stdout.write(self.style.SUCCESS('Bundled taxonomy and MCQs imported.'))
