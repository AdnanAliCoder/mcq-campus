import json, re
from django.core import mail
from django.contrib.auth.models import User
from django.db import connection
from django.utils import timezone
from datetime import timedelta
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from .models import Category, Subcategory, ChildCategory, MCQ, Paper, Job, JobYear, Profile, Report, ContactMessage, SiteSetting, TrashRecord, OneTimeToken, PendingSignup, profile_for


@override_settings(SECURE_SSL_REDIRECT=False)
class IntegrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        SiteSetting.objects.create(singleton=1)
        cls.category=Category.objects.create(id=100,name='Computing',icon='grid')
        cls.paper=Paper.objects.create(id=200,name='PPSC',icon='paper')
        cls.learner=User.objects.create_user(username='learner@example.com',email='learner@example.com',password='LearnerPass123',first_name='Learner')
        cls.admin=User.objects.create_user(username='admin@example.com',email='admin@example.com',password='AdminPass123',first_name='Admin',is_staff=True)
        cls.owner=User.objects.create_superuser(username='owner@example.com',email='owner@example.com',password='OwnerPass123',first_name='Owner')
        for user,role in [(cls.learner,'user'),(cls.admin,'admin'),(cls.owner,'super-admin')]:
            p=profile_for(user);p.role=role;p.email_verified=True;p.save()
        cls.approved=MCQ.objects.create(id=1,question='Approved question?',option1='A',option2='B',option3='C',option4='D',correct_answer='A',category=cls.category,status='approved',created_by=cls.admin,submitted_by=cls.admin)
        cls.pending=MCQ.objects.create(id=2,question='Pending question?',option1='A',option2='B',option3='C',option4='D',correct_answer='B',category=cls.category,status='pending',created_by=cls.admin,submitted_by=cls.admin)
        cls.rejected=MCQ.objects.create(id=3,question='Rejected question?',option1='A',option2='B',option3='C',option4='D',correct_answer='C',category=cls.category,status='rejected',created_by=cls.admin,submitted_by=cls.admin)

    def setUp(self):
        # Most integration cases exercise authenticated content workflows.
        self.client.force_login(self.owner)

    def post_json(self,path,data):
        return self.client.post(path,data=json.dumps(data),content_type='application/json')

    def test_seo_sitemap_index_exposes_hierarchy_sitemaps(self):
        self.client.force_login(self.owner)
        response=self.client.get('/sitemap.xml')
        self.assertEqual(response.status_code,200)
        body=response.content.decode()
        self.assertIn('/sitemap-categories.xml',body)
        self.assertIn('/sitemap-papers.xml',body)
        self.assertIn('/sitemap-jobs.xml',body)
        self.assertIn('/sitemap-years.xml',body)
        self.assertIn('/sitemap-mcqs.xml',body)

    def test_category_subcategory_topic_pages_have_unique_server_seo(self):
        self.client.force_login(self.owner)
        sub=Subcategory.objects.create(id=110,name='Operating Systems',category=self.category)
        child=ChildCategory.objects.create(id=120,name='Process Management',subcategory=sub)
        self.approved.subcategory_ids=[sub.id]
        self.approved.child_subcategory_ids=[child.id]
        self.approved.save(update_fields=['subcategory_ids','child_subcategory_ids'])
        category=self.client.get('/category/computing').content.decode()
        subpage=self.client.get('/subcategory/operating-systems').content.decode()
        topic=self.client.get('/topic/process-management').content.decode()
        self.assertIn('Computing MCQs with Answers',category)
        self.assertIn('Operating Systems MCQs with Answers',subpage)
        self.assertIn('Process Management MCQs with Answers',topic)
        self.assertIn('/subcategory/operating-systems',self.client.get('/sitemap-categories.xml').content.decode())
        self.assertIn('/topic/process-management',self.client.get('/sitemap-categories.xml').content.decode())

    def test_paper_job_year_pages_have_distinct_search_titles_and_sitemaps(self):
        self.client.force_login(self.owner)
        job=Job.objects.create(id=300,name='Assistant',paper=self.paper)
        year=JobYear.objects.create(id=400,name='2026',job=job)
        self.approved.paper_ids=[self.paper.id]
        self.approved.job_ids=[job.id]
        self.approved.job_year_ids=[year.id]
        self.approved.save(update_fields=['paper_ids','job_ids','job_year_ids'])
        paper=self.client.get('/paper/ppsc').content.decode()
        jobpage=self.client.get('/paper/ppsc/job/assistant').content.decode()
        yearpage=self.client.get('/paper/ppsc/job/assistant/year/2026').content.decode()
        self.assertIn('PPSC Past Papers, Jobs & Solved MCQs',paper)
        self.assertIn('PPSC Assistant Past Papers & Solved MCQs',jobpage)
        self.assertIn('PPSC Assistant 2026 Solved Past Paper',yearpage)
        self.assertIn('rel="canonical" href="https://www.mcqcampus.com/ppsc-past-papers"',paper)
        self.assertIn('rel="canonical" href="https://www.mcqcampus.com/ppsc-assistant-past-papers"',jobpage)
        self.assertIn('/ppsc-past-papers',self.client.get('/sitemap-papers.xml').content.decode())
        self.assertIn('/ppsc-assistant-past-papers',self.client.get('/sitemap-jobs.xml').content.decode())
        self.assertIn('/paper/ppsc/job/assistant/year/2026',self.client.get('/sitemap-years.xml').content.decode())

    def test_unknown_public_entity_routes_are_404_and_noindex(self):
        self.client.force_login(self.owner)
        for path in [
            '/category/not-a-real-category',
            '/paper/not-a-real-paper',
            '/paper/ppsc/job/not-a-real-job',
            '/mcq/not-a-real-question',
            '/post/not-a-real-post',
            '/pdf/not-a-real-pdf',
            '/latest-job/not-a-real-job',
        ]:
            response=self.client.get(path)
            self.assertEqual(response.status_code,404,path)
            self.assertIn('name="robots" content="noindex,nofollow"',response.content.decode(),path)

    def test_private_routes_are_server_noindex(self):
        self.client.logout()
        body=self.client.get('/login').content.decode()
        self.assertIn('name="robots" content="noindex,nofollow"',body)

    def test_complete_frontend_entry_loads(self):
        self.client.logout()
        response=self.client.get('/')
        self.assertEqual(response.status_code,200)
        self.assertNotIn('X-Robots-Tag',response)
        response=self.client.get('/login')
        self.assertEqual(response.status_code,200)
        body=response.content.decode()
        self.assertIn('styles.css?v=20261011-country-entry-v3',body)
        self.assertIn('public.js?v=20261011-country-entry-v3',body)
        self.assertIn('auth.js?v=20261011-country-entry-v3',body)
        self.assertIn('assets/js/auth.js',body)
        self.assertIn('assets/js/seo.js',body)
        self.assertNotIn('assets/js/seed.js',body)

    def test_bootstrap_requires_authentication(self):
        self.client.logout()
        response=self.client.get('/api/bootstrap')
        self.assertEqual(response.status_code,401)
        self.assertTrue(response.json()['loginRequired'])
        self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        authenticated=self.client.get('/api/bootstrap')
        self.assertEqual(authenticated.status_code,200)
        data=authenticated.json()
        self.assertEqual(data['mcqPage']['total'],1)
        self.assertNotIn('users',data)
        self.assertNotIn('logs',data)
        self.assertNotIn('reports',data)

    def test_login_wall_redirects_pages_and_blocks_private_apis(self):
        self.client.logout()
        page=self.client.get('/')
        self.assertEqual(page.status_code,200)
        self.assertNotIn('X-Robots-Tag',page)
        private_page=self.client.get('/mcqs')
        self.assertEqual(private_page.status_code,302)
        self.assertEqual(private_page['Location'],'/login')
        self.assertEqual(self.client.get('/api/bootstrap').status_code,401)
        self.assertEqual(self.client.get('/api/public/content').status_code,401)
        self.assertEqual(self.client.get('/api/admin/countries').status_code,401)
        startup=self.client.get('/api/startup')
        self.assertEqual(startup.status_code,200)
        public_counts={row['name']:row.get('mcqCount') for row in startup.json()['snapshot']['countries']}
        self.assertIn('Pakistan',public_counts)
        self.assertIsNotNone(public_counts['Pakistan'])
        self.assertIsNone(self.client.get('/api/auth/session').json()['user'])
        self.assertEqual(self.client.get('/login').status_code,200)

    def test_country_isolation_applies_to_mcqs_and_live_country_totals(self):
        india=MCQ.objects.create(
            id=55,question='India-only question?',option1='A',option2='B',option3='C',option4='D',
            correct_answer='A',category=self.category,status='approved',country='India',
            created_by=self.admin,submitted_by=self.admin,
        )
        self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        response=self.client.get('/api/mcqs?page_size=50&country=India')
        self.assertEqual(response.status_code,200)
        rows=response.json()['items']
        self.assertIn(self.approved.id,{row['id'] for row in rows})
        self.assertNotIn(india.id,{row['id'] for row in rows})
        bootstrap=self.client.get('/api/bootstrap').json()
        self.assertEqual(bootstrap['siteCounts']['approvedMcqs'],1)
        counts={row['name']:row['mcqCount'] for row in bootstrap['countries']}
        self.assertEqual(counts.get('Pakistan'),1)
        self.assertEqual(counts.get('India'),1)
        self.post_json('/api/auth/logout',{})
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        global_rows=self.client.get('/api/mcqs?country=India&page_size=50').json()['items']
        self.assertIn(india.id,{row['id'] for row in global_rows})
        self.assertNotIn(self.approved.id,{row['id'] for row in global_rows})

    def test_super_admin_can_add_and_disable_country_for_signup(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        created=self.post_json('/api/admin/countries',{'action':'add','name':'Spain'})
        self.assertEqual(created.status_code,200)
        self.assertIn('Spain',{row['name'] for row in created.json()['countries']})
        configured=self.post_json('/api/admin/countries',{'action':'configure','name':'Spain','pinned':True,'sortOrder':0})
        self.assertEqual(configured.status_code,200)
        spain_configured=next(row for row in configured.json()['countries'] if row['name']=='Spain')
        self.assertTrue(spain_configured['pinned'])
        self.assertEqual(spain_configured['sortOrder'],0)
        disabled=self.post_json('/api/admin/countries',{'action':'toggle','name':'Spain','active':False})
        self.assertEqual(disabled.status_code,200)
        spain=next(row for row in disabled.json()['countries'] if row['name']=='Spain')
        self.assertFalse(spain['active'])
        signup=self.post_json('/api/auth/register',{'first_name':'Spain','last_name':'Learner','email':'spain@example.com','password':'StrongPass!246','confirm':'StrongPass!246','terms':'on','country':'Spain'})
        self.assertEqual(signup.status_code,422)

    def test_country_catalog_pinning_order_and_global_mcq_total(self):
        settings=SiteSetting.objects.get(pk=1)
        root=dict(settings.admin_permissions or {})
        site=dict(root.get('_site') or {})
        site['countries']=[
            {'name':'Pakistan','active':True,'pinned':False,'sortOrder':20},
            {'name':'India','active':True,'pinned':True,'sortOrder':100},
        ]
        root['_site']=site
        settings.admin_permissions=root
        settings.save(update_fields=['admin_permissions'])
        response=self.client.get('/api/startup')
        self.assertEqual(response.status_code,200)
        snapshot=response.json()['snapshot']
        self.assertEqual(snapshot['totalMcqCount'],MCQ.objects.filter(status='approved').count())
        countries=snapshot['countries']
        self.assertEqual(countries[0]['name'],'India')
        self.assertTrue(countries[0]['pinned'])
        self.assertEqual(countries[0]['sortOrder'],100)
        self.assertEqual(next(row for row in countries if row['name']=='Pakistan')['mcqCount'],1)

    def test_super_admin_overview_scopes_statistics_by_country(self):
        MCQ.objects.create(
            id=56,question='India-specific dashboard question?',option1='A',option2='B',option3='C',option4='D',
            correct_answer='A',category=self.category,status='approved',country='India',
            created_by=self.admin,submitted_by=self.admin,
        )
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        scoped=self.client.get('/api/admin/overview?country=India')
        self.assertEqual(scoped.status_code,200)
        scoped_data=scoped.json()
        self.assertEqual(scoped_data['activeCountry'],'India')
        self.assertEqual(scoped_data['mcqs']['total'],1)
        self.assertEqual(scoped_data['mcqs']['approved'],1)
        overall=self.client.get('/api/admin/overview')
        self.assertEqual(overall.status_code,200)
        overall_data=overall.json()
        self.assertEqual(overall_data['activeCountry'],'')
        self.assertEqual(overall_data['mcqs']['total'],4)
        self.assertEqual(overall_data['mcqs']['approved'],2)

    def test_protected_commands_require_login(self):
        self.client.logout()
        response=self.post_json('/api/commands',{'action':'toggleBookmark','payload':{'args':[self.approved.id]}})
        self.assertEqual(response.status_code,401)

    def test_learner_login_and_logout(self):
        response=self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['user']['activeRole'],'user')
        self.assertEqual(self.client.get('/api/bootstrap').json()['mcqPage']['total'],1)
        self.assertEqual(self.post_json('/api/auth/logout',{}).status_code,200)
        self.assertIsNone(self.client.get('/api/auth/session').json()['user'])

    def test_admin_and_super_admin_visibility(self):
        self.post_json('/api/auth/login',{'email':'admin@example.com','password':'AdminPass123'})
        admin_data=self.client.get('/api/bootstrap').json()
        self.assertEqual(admin_data['mcqPage']['total'],1)
        self.assertNotIn('users',admin_data)
        admin_mcqs=self.client.get('/api/mcqs?page_size=50').json()
        self.assertEqual({row['id'] for row in admin_mcqs['items']},{1,2,3})
        self.client.logout()
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        owner_data=self.client.get('/api/bootstrap').json()
        self.assertEqual(owner_data['mcqPage']['total'],1)
        self.assertNotIn('users',owner_data)
        users=self.client.get('/api/admin/users').json()
        self.assertEqual(len(users['items']),3)
        overview=self.client.get('/api/admin/overview').json()
        self.assertEqual(overview['mcqs']['total'],3)

    def test_super_admin_can_switch_workspace_without_role_loss(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        switched=self.post_json('/api/auth/switch-role',{'role':'user'})
        self.assertEqual(switched.status_code,200)
        self.assertEqual(switched.json()['activeRole'],'user')
        self.assertNotIn('user',switched.json())

    def test_switch_role_response_is_small_and_has_no_snapshot(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        response=self.post_json('/api/auth/switch-role',{'role':'admin'})
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertNotIn('snapshot',data)
        self.assertEqual(data['activeRole'],'admin')
        self.assertNotIn('user',data)

    def test_command_response_is_delta_only(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        response=self.post_json('/api/commands',{'action':'toggleBookmark','payload':{'args':[self.approved.id]}})
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertNotIn('snapshot',data)
        self.assertTrue(data['success'])
        self.assertTrue(data['result'])

    def test_delete_entity_keeps_recovery_behavior(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        doomed=Category.objects.create(id=999,name='Delete Me',icon='grid')
        MCQ.objects.create(id=999,question='Delete-linked?',option1='A',option2='B',option3='C',option4='D',correct_answer='A',category=doomed,status='approved',created_by=self.owner,submitted_by=self.owner)
        response=self.post_json('/api/commands',{'action':'action:entity-delete-confirm','payload':{'type':'categories','id':'999'}})
        self.assertEqual(response.status_code,200)
        self.assertFalse(Category.objects.filter(pk=999).exists())
        self.assertFalse(MCQ.objects.filter(pk=999).exists())

    def test_category_and_paper_create_return_entities(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        category_payload={'action':'form:entity','payload':{'fields':[['entity-active','on']], 'values':{'entity-name':'Networks','entity-icon':'grid','entity-country':'Pakistan'}, 'context':{'type':'categories'}}}
        category_response=self.post_json('/api/commands',category_payload)
        self.assertEqual(category_response.status_code,200)
        category_result=category_response.json()['result']
        self.assertEqual(category_result['type'],'categories')
        self.assertEqual(category_result['entity']['name'],'Networks')
        paper_payload={'action':'form:entity','payload':{'fields':[['entity-active','on']], 'values':{'entity-name':'FPSC','entity-icon':'paper','entity-country':'Pakistan'}, 'context':{'type':'papers'}}}
        paper_response=self.post_json('/api/commands',paper_payload)
        self.assertEqual(paper_response.status_code,200)
        paper_result=paper_response.json()['result']
        self.assertEqual(paper_result['type'],'papers')
        self.assertEqual(paper_result['entity']['name'],'FPSC')
        self.assertNotIn('snapshot',paper_response.json())

    def test_super_admin_bulk_mcq_delete_moves_to_trash_and_recovers(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        ids=[self.pending.id,self.rejected.id]
        response=self.post_json('/api/commands',{'action':'action:mcq-delete','payload':{'ids':ids}})
        self.assertEqual(response.status_code,200)
        result=response.json()['result']
        self.assertEqual(set(result['deleted']['ids']),set(ids))
        self.assertFalse(MCQ.objects.filter(pk__in=ids).exists())
        trash=TrashRecord.objects.get(pk=result['trashId'])
        self.assertEqual(trash.kind,'mcqs')
        self.assertEqual(len((trash.payload or {}).get('mcqs') or []),2)
        restored=self.post_json('/api/commands',{'action':'action:trash-restore','payload':{'id':trash.id}})
        self.assertEqual(restored.status_code,200)
        self.assertEqual(MCQ.objects.filter(pk__in=ids).count(),2)
        self.assertFalse(TrashRecord.objects.filter(pk=trash.id).exists())

    def test_dedicated_admin_mcq_delete_endpoint(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        q=MCQ.objects.create(
            id=720,question='Dedicated delete endpoint?',option1='A',option2='B',option3='C',option4='D',
            correct_answer='A',description='Dedicated endpoint',category=self.category,status='approved',
            created_by=self.owner,submitted_by=self.owner,
        )
        response=self.post_json('/api/admin/mcqs/delete',{'ids':[q.id]})
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertEqual(data['deletedIds'],[q.id])
        self.assertFalse(MCQ.objects.filter(pk=q.id).exists())
        self.assertTrue(TrashRecord.objects.filter(pk=data['trashId']).exists())

    def test_dedicated_trash_restore_and_delete_endpoints(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        first=self.post_json('/api/admin/mcqs/delete',{'ids':[self.pending.id]}).json()
        restored=self.post_json('/api/admin/trash/restore',{'ids':[first['trashId']]})
        self.assertEqual(restored.status_code,200)
        self.assertTrue(MCQ.objects.filter(pk=self.pending.id).exists())
        second=self.post_json('/api/admin/mcqs/delete',{'ids':[self.rejected.id]}).json()
        deleted=self.post_json('/api/admin/trash/delete',{'ids':[second['trashId']]})
        self.assertEqual(deleted.status_code,200)
        self.assertFalse(TrashRecord.objects.filter(pk=second['trashId']).exists())

    def test_legacy_admin_delete_command_aliases_do_not_fall_through(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        aliases=['mcq-delete','action:mcq-delete-confirm','action:mcq-bulk-delete']
        created=[]
        for index,action in enumerate(aliases,1):
            q=MCQ.objects.create(
                id=700+index,question=f'Alias delete {index}?',option1='A',option2='B',option3='C',option4='D',
                correct_answer='A',description='Alias compatibility',category=self.category,status='approved',
                created_by=self.owner,submitted_by=self.owner,
            )
            created.append(q.id)
            response=self.post_json('/api/commands',{'action':action,'payload':{'ids':[q.id]}})
            self.assertEqual(response.status_code,200,action)
            self.assertFalse(MCQ.objects.filter(pk=q.id).exists(),action)
            trash_id=response.json()['result']['trashId']
            self.post_json('/api/commands',{'action':'trash-restore','payload':{'id':trash_id}})
            self.assertTrue(MCQ.objects.filter(pk=q.id).exists(),action)

    def test_double_action_prefix_is_normalized(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        q=MCQ.objects.create(
            id=710,question='Double action prefix?',option1='A',option2='B',option3='C',option4='D',
            correct_answer='A',description='Compatibility',category=self.category,status='approved',
            created_by=self.owner,submitted_by=self.owner,
        )
        response=self.post_json('/api/commands',{'action':'action:action:mcq-delete','payload':{'id':q.id}})
        self.assertEqual(response.status_code,200)
        self.assertFalse(MCQ.objects.filter(pk=q.id).exists())

    def test_bulk_import_same_question_different_paper_job_year_merges_hierarchy(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        paper2=Paper.objects.create(id=303,name='Second Agency',country='Pakistan')
        job1=Job.objects.create(id=304,name='First Job',paper=self.paper)
        job2=Job.objects.create(id=305,name='Second Job',paper=paper2)
        year1=JobYear.objects.create(id=404,name='2022',job=job1)
        year2=JobYear.objects.create(id=405,name='2023',job=job2)
        base={'question':'Hierarchy merge example?','option1':'A','option2':'B','option3':'C','option4':'D','correct_answer':'A','description':'Test','category_id':self.category.id}
        rows=[
            {'status':'valid','q':{**base,'paper_id':[self.paper.id],'job_ids':[job1.id],'job_years_ids':[year1.id]}},
            {'status':'merge','q':{**base,'paper_id':[paper2.id],'job_ids':[job2.id],'job_years_ids':[year2.id]}},
        ]
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':rows}})
        self.assertEqual(response.status_code,200)
        self.assertEqual(MCQ.objects.filter(question=base['question']).count(),1)
        q=MCQ.objects.get(question=base['question'])
        self.assertEqual(set(q.paper_ids),{self.paper.id,paper2.id})
        self.assertEqual(set(q.job_ids),{job1.id,job2.id})
        self.assertEqual(set(q.job_year_ids),{year1.id,year2.id})
        self.assertTrue(q.important)

    def test_bulk_import_visually_same_question_merges_different_jobs(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        paper2=Paper.objects.create(id=330,name='Unicode Merge Paper',country='Pakistan')
        job1=Job.objects.create(id=331,name='Unicode Job One',paper=self.paper)
        job2=Job.objects.create(id=332,name='Unicode Job Two',paper=paper2)
        year1=JobYear.objects.create(id=431,name='Unicode Year One',job=job1)
        year2=JobYear.objects.create(id=432,name='Unicode Year Two',job=job2)
        base={'option1':'A','option2':'B','option3':'C','option4':'D','correct_answer':'A','description':'Test','category_id':self.category.id}
        rows=[
            {'status':'valid','q':{**base,'question':'Same visible question?','paper_id':[self.paper.id],'job_ids':[job1.id],'job_years_ids':[year1.id]}},
            {'status':'valid','q':{**base,'question':'Same\u00a0visible   question?','paper_id':[paper2.id],'job_ids':[job2.id],'job_years_ids':[year2.id]}},
        ]
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':rows}})
        self.assertEqual(response.status_code,200)
        self.assertEqual(MCQ.objects.filter(question__icontains='Same').count(),1)
        q=MCQ.objects.get(question__icontains='Same')
        self.assertEqual(set(q.paper_ids),{self.paper.id,paper2.id})
        self.assertEqual(set(q.job_ids),{job1.id,job2.id})
        self.assertEqual(set(q.job_year_ids),{year1.id,year2.id})
        self.assertTrue(q.important)

    def test_bulk_import_exact_same_hierarchy_is_duplicate_not_second_mcq(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        job=Job.objects.create(id=306,name='Duplicate Job',paper=self.paper)
        year=JobYear.objects.create(id=406,name='2024',job=job)
        base={'question':'Exact duplicate hierarchy?','option1':'A','option2':'B','option3':'C','option4':'D','correct_answer':'A','description':'Test','category_id':self.category.id,'paper_id':[self.paper.id],'job_ids':[job.id],'job_years_ids':[year.id]}
        rows=[{'status':'valid','q':base},{'status':'duplicate','q':base}]
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':rows}})
        self.assertEqual(response.status_code,200)
        data=response.json()['result']
        self.assertEqual(MCQ.objects.filter(question=base['question']).count(),1)
        self.assertEqual(data['summary']['duplicates'],1)
        q=MCQ.objects.get(question=base['question'])
        self.assertEqual(q.paper_ids,[self.paper.id])
        self.assertEqual(q.job_ids,[job.id])
        self.assertEqual(q.job_year_ids,[year.id])

    def test_existing_website_mcq_merges_new_unique_hierarchy_ids_without_duplicate(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        paper2=Paper.objects.create(id=320,name='Second Existing Paper',country='Pakistan')
        job1=Job.objects.create(id=321,name='Existing Job One',paper=self.paper)
        job2=Job.objects.create(id=322,name='Existing Job Two',paper=paper2)
        year1=JobYear.objects.create(id=421,name='Existing Year One',job=job1)
        year2=JobYear.objects.create(id=422,name='Existing Year Two',job=job2)

        existing=MCQ.objects.create(
            id=820,question='Existing website merge target?',option1='A',option2='B',option3='C',option4='D',
            correct_answer='A',description='Keep this canonical MCQ',category=self.category,status='approved',
            paper_ids=[self.paper.id],job_ids=[job1.id],job_year_ids=[year1.id],
            created_by=self.owner,submitted_by=self.owner,approved_by=self.owner,
        )
        draft={
            'question':existing.question,'option1':'A','option2':'B','option3':'C','option4':'D',
            'correct_answer':'A','description':'Duplicate row description must not replace canonical content',
            'category_id':self.category.id,'paper_id':[paper2.id],'job_ids':[job2.id],'job_years_ids':[year2.id],
        }
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':[{'status':'merge','q':draft}]}})
        self.assertEqual(response.status_code,200)
        existing.refresh_from_db()
        self.assertEqual(MCQ.objects.filter(question=existing.question).count(),1)
        self.assertEqual(set(existing.paper_ids),{self.paper.id,paper2.id})
        self.assertEqual(set(existing.job_ids),{job1.id,job2.id})
        self.assertEqual(set(existing.job_year_ids),{year1.id,year2.id})
        self.assertEqual(existing.description,'Keep this canonical MCQ')

    def test_hierarchy_merge_ignores_nonexistent_ids_and_derives_real_parents(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        paper2=Paper.objects.create(id=323,name='Hierarchy Source Paper',country='Pakistan')
        job=Job.objects.create(id=324,name='Hierarchy Source Job',paper=paper2)
        year=JobYear.objects.create(id=423,name='Hierarchy Source Year',job=job)
        q=MCQ.objects.create(
            id=821,question='ID source of truth?',option1='A',option2='B',option3='C',option4='D',
            correct_answer='A',description='Test',category=self.category,status='approved',
            paper_ids=[],job_ids=[],job_year_ids=[],
            created_by=self.owner,submitted_by=self.owner,approved_by=self.owner,
        )
        rows=[{'status':'merge','q':{
            'question':q.question,'option1':'A','option2':'B','option3':'C','option4':'D',
            'correct_answer':'A','description':'Test','category_id':self.category.id,
            'paper_id':[999999],'job_ids':[999998],'job_years_ids':[year.id,999997],
        }}]
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':rows}})
        self.assertEqual(response.status_code,200)
        q.refresh_from_db()
        self.assertEqual(q.paper_ids,[paper2.id])
        self.assertEqual(q.job_ids,[job.id])
        self.assertEqual(q.job_year_ids,[year.id])

    def test_bulk_merge_accepts_model_style_job_year_ids_alias(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        job=Job.objects.create(id=312,name='Alias Merge Job',paper=self.paper)
        year1=JobYear.objects.create(id=412,name='Alias Merge Year 1',job=job)
        year2=JobYear.objects.create(id=413,name='Alias Merge Year 2',job=job)
        q=MCQ.objects.create(
            id=812,question='Alias hierarchy merge?',option1='A',option2='B',option3='C',option4='D',
            correct_answer='A',description='Test',category=self.category,status='approved',
            paper_ids=[self.paper.id],job_ids=[job.id],job_year_ids=[year1.id],
            created_by=self.owner,submitted_by=self.owner,approved_by=self.owner,
        )
        rows=[{'status':'merge','q':{
            'question':q.question,'option1':'A','option2':'B','option3':'C','option4':'D',
            'correct_answer':'A','description':'Test','category_id':self.category.id,
            'paper_ids':[self.paper.id],'job_ids':[job.id],'job_year_ids':[year2.id],
        }}]
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':rows}})
        self.assertEqual(response.status_code,200)
        q.refresh_from_db()
        self.assertEqual(set(q.job_year_ids),{year1.id,year2.id})

    def test_super_admin_bulk_import_is_directly_approved(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        job=Job.objects.create(id=308,name='Direct Approved Job',paper=self.paper)
        year1=JobYear.objects.create(id=409,name='Direct Approved Year 1',job=job)
        year2=JobYear.objects.create(id=410,name='Direct Approved Year 2',job=job)
        base={
            'question':'Direct approved consolidated import?',
            'option1':'A','option2':'B','option3':'C','option4':'D','correct_answer':'A',
            'description':'Test','category_id':self.category.id,'paper_id':[self.paper.id],'job_ids':[job.id],
        }
        rows=[
            {'status':'valid','q':{**base,'job_years_ids':[year1.id]}},
            {'status':'merge','q':{**base,'job_years_ids':[year2.id]}},
        ]
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':rows}})
        self.assertEqual(response.status_code,200)
        data=response.json()['result']
        self.assertEqual(len(data['mcqs']),1)
        q=MCQ.objects.get(question=base['question'])
        self.assertEqual(q.status,'approved')
        self.assertEqual(set(q.job_year_ids),{year1.id,year2.id})
        self.assertEqual(q.approved_by_id,self.owner.id)

    def test_exact_existing_import_duplicate_is_ignored_from_imported_results(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        job=Job.objects.create(id=309,name='Existing Duplicate Job',paper=self.paper)
        year=JobYear.objects.create(id=411,name='Existing Duplicate Year',job=job)
        q=MCQ.objects.create(
            id=799,question='Existing exact duplicate?',option1='A',option2='B',option3='C',option4='D',
            correct_answer='A',description='Test',category=self.category,status='approved',
            paper_ids=[self.paper.id],job_ids=[job.id],job_year_ids=[year.id],
            created_by=self.owner,submitted_by=self.owner,approved_by=self.owner,
        )
        draft={
            'question':q.question,'option1':'A','option2':'B','option3':'C','option4':'D',
            'correct_answer':'A','description':'Test','category_id':self.category.id,
            'paper_id':[self.paper.id],'job_ids':[job.id],'job_years_ids':[year.id],
        }
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':[{'status':'duplicate','q':draft}]}})
        self.assertEqual(response.status_code,200)
        data=response.json()['result']
        self.assertEqual(data['summary']['duplicates'],1)
        self.assertEqual(data['mcqs'],[])
        self.assertEqual(MCQ.objects.filter(question=q.question).count(),1)

    def test_bulk_import_groups_same_upload_before_saving_two_job_years(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        job=Job.objects.create(id=307,name='Family Welfare Assistant',paper=self.paper)
        year1=JobYear.objects.create(id=407,name='[ATS] KPK - Family Welfare Assistant Past Paper [13 Aug 2022]',job=job)
        year2=JobYear.objects.create(id=408,name='[ATS] KPK - Family Welfare Assistant Past Paper [30 Jul 2022]',job=job)
        base={
            'question':'Pulitzer prize is awarded for outstanding work in the field of _____?',
            'option1':'Film Industry','option2':'Journalism','option3':'Science & Tech','option4':'Scuba',
            'correct_answer':'Journalism',
            'description':'The Pulitzer Prize recognizes distinguished achievements in journalism, alongside separate awards for literature, drama, and musical composition.',
            'category_id':self.category.id,'paper_id':[self.paper.id],'job_ids':[job.id],
        }
        rows=[
            {'status':'valid','q':{**base,'job_years_ids':[year1.id]}},
            {'status':'merge','q':{**base,'job_years_ids':[year2.id]}},
        ]
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':rows}})
        self.assertEqual(response.status_code,200)
        data=response.json()['result']
        self.assertEqual(MCQ.objects.filter(question=base['question']).count(),1)
        q=MCQ.objects.get(question=base['question'])
        self.assertEqual(set(q.job_year_ids),{year1.id,year2.id})
        self.assertEqual(data['summary']['imported'],1)
        self.assertEqual(data['summary']['merged'],1)
        self.assertEqual(data['summary']['duplicates'],0)

    def test_bulk_import_same_question_same_job_two_years_stays_one_mcq(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        job=Job.objects.create(id=302,name='Computer Operator',paper=self.paper)
        year1=JobYear.objects.create(id=402,name='2022-A',job=job)
        year2=JobYear.objects.create(id=403,name='2022-B',job=job)
        base={'question':'Pulitzer prize is awarded for outstanding work in the field of _____?','option1':'Journalism','option2':'Sports','option3':'Medicine','option4':'Physics','correct_answer':'Journalism','description':'Pulitzer Prizes recognize achievements including journalism.','category_id':self.category.id,'paper_id':[self.paper.id],'job_ids':[job.id]}
        rows=[
            {'status':'valid','q':{**base,'job_years_ids':[year1.id]}},
            {'status':'merge','q':{**base,'job_years_ids':[year2.id]}},
        ]
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':rows}})
        self.assertEqual(response.status_code,200)
        qs=MCQ.objects.filter(question=base['question'])
        self.assertEqual(qs.count(),1)
        q=qs.get()
        self.assertEqual(set(q.job_year_ids),{year1.id,year2.id})
        self.assertEqual(set(q.job_ids),{job.id})
        self.assertEqual(set(q.paper_ids),{self.paper.id})
        self.assertFalse(q.important)
        self.assertFalse(mcq(q)['important'])


    def test_bulk_import_new_repeated_question_creates_one_pending_mcq(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        job=Job.objects.create(id=880,name='New Import Job',paper=self.paper)
        year1=JobYear.objects.create(id=881,name='2025-A',job=job)
        year2=JobYear.objects.create(id=882,name='2025-B',job=job)
        base={
            'question':'Brand new repeated bulk import?',
            'option1':'A','option2':'B','option3':'C','option4':'D',
            'correct_answer':'A','description':'New pending import',
            'category_id':self.category.id,'paper_id':[self.paper.id],'job_ids':[job.id],
        }
        rows=[
            {'status':'valid','q':{**base,'job_years_ids':[year1.id]}},
            {'status':'merge','q':{**base,'job_years_ids':[year2.id]}},
        ]
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':rows}})
        self.assertEqual(response.status_code,200)
        data=response.json()['result']
        qs=MCQ.objects.filter(question=base['question'])
        self.assertEqual(qs.count(),1)
        q=qs.get()
        self.assertEqual(q.status,'pending')
        self.assertEqual(q.submission_type,'new')
        self.assertEqual(set(q.job_year_ids),{year1.id,year2.id})
        self.assertEqual(data['summary']['imported'],1)
        self.assertEqual(data['summary']['updated'],0)
        self.assertEqual(data['results'][0]['result'],'pending-new')

    def test_bulk_import_existing_question_stages_update_without_new_record(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        paper2=Paper.objects.create(id=883,name='Existing Update Paper',country='Pakistan')
        job1=Job.objects.create(id=884,name='Existing Base Job',paper=self.paper)
        job2=Job.objects.create(id=885,name='Existing New Job',paper=paper2)
        year1=JobYear.objects.create(id=886,name='2024',job=job1)
        year2=JobYear.objects.create(id=887,name='2025',job=job2)
        existing=MCQ.objects.create(
            id=888,question='Existing bulk update target?',option1='A',option2='B',option3='C',option4='D',
            correct_answer='A',description='Keep canonical',category=self.category,status='approved',
            paper_ids=[self.paper.id],job_ids=[job1.id],job_year_ids=[year1.id],
            created_by=self.owner,submitted_by=self.owner,approved_by=self.owner,
        )
        draft={
            'question':existing.question,'option1':'A','option2':'B','option3':'C','option4':'D',
            'correct_answer':'A','description':'Incoming copy','category_id':self.category.id,
            'paper_id':[paper2.id],'job_ids':[job2.id],'job_years_ids':[year2.id],
        }
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':[{'status':'update','q':draft}]}})
        self.assertEqual(response.status_code,200)
        data=response.json()['result']
        self.assertEqual(MCQ.objects.filter(question=existing.question).count(),1)
        existing.refresh_from_db()
        self.assertEqual(existing.status,'approved')
        self.assertEqual(existing.paper_ids,[self.paper.id])
        self.assertIsNotNone(existing.pending_update)
        proposed=existing.pending_update['proposed']
        self.assertEqual(set(proposed['paper_id']),{self.paper.id,paper2.id})
        self.assertEqual(set(proposed['job_ids']),{job1.id,job2.id})
        self.assertEqual(set(proposed['job_years_ids']),{year1.id,year2.id})
        self.assertEqual(data['summary']['imported'],0)
        self.assertEqual(data['summary']['updated'],1)
        self.assertEqual(data['results'][0]['result'],'pending-update')

    def test_trash_bulk_restore_and_permanent_delete(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        first=self.post_json('/api/commands',{'action':'action:mcq-delete-confirm','payload':{'ids':[self.pending.id]}}).json()['result']
        second=self.post_json('/api/commands',{'action':'action:mcq-bulk-delete','payload':{'ids':[self.rejected.id]}}).json()['result']
        restored=self.post_json('/api/commands',{'action':'action:trash-restore-many','payload':{'ids':[first['trashId']]}})
        self.assertEqual(restored.status_code,200)
        self.assertTrue(MCQ.objects.filter(pk=self.pending.id).exists())
        deleted=self.post_json('/api/commands',{'action':'action:trash-permanent-delete','payload':{'ids':[second['trashId']]}})
        self.assertEqual(deleted.status_code,200)
        self.assertFalse(TrashRecord.objects.filter(pk=second['trashId']).exists())
        self.assertFalse(MCQ.objects.filter(pk=self.rejected.id).exists())

    def test_bulk_import_merges_only_hierarchy_for_repeated_question(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        paper2=Paper.objects.create(id=201,name='FPSC',icon='paper')
        job1=Job.objects.create(id=300,name='Assistant',paper=self.paper)
        year1=JobYear.objects.create(id=400,name='2025',job=job1)
        job2=Job.objects.create(id=301,name='Inspector',paper=paper2)
        year2=JobYear.objects.create(id=401,name='2026',job=job2)
        q=MCQ.objects.create(
            id=50,question='Repeated hierarchy question?',option1='A',option2='B',option3='C',option4='D',
            correct_answer='A',description='Keep this description',category=self.category,status='approved',
            paper_ids=[self.paper.id],job_ids=[job1.id],job_year_ids=[year1.id],
            created_by=self.owner,submitted_by=self.owner,
        )
        row={'status':'merge','q':{
            'question':q.question,'option1':'CHANGED','option2':'B','option3':'C','option4':'D',
            'correct_answer':'CHANGED','description':'Do not overwrite','category_id':self.category.id,
            'paper_id':[paper2.id],'job_ids':[job2.id],'job_years_ids':[year2.id],
        }}
        response=self.post_json('/api/commands',{'action':'action:import-confirm','payload':{'rows':[row]}})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['result']['summary']['merged'],1)
        q.refresh_from_db()
        self.assertEqual(q.option1,'A')
        self.assertEqual(q.correct_answer,'A')
        self.assertEqual(q.description,'Keep this description')
        self.assertEqual(set(q.paper_ids),{self.paper.id,paper2.id})
        self.assertEqual(set(q.job_ids),{job1.id,job2.id})
        self.assertEqual(set(q.job_year_ids),{year1.id,year2.id})
        self.assertTrue(q.important)

    def test_mcq_match_finds_database_question_for_single_add(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        response=self.client.get('/api/mcqs/match',{'question':'  Approved   question?  '})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['match']['id'],self.approved.id)

    def test_mcq_endpoint_is_paginated_and_bootstrap_is_bounded(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        more=[MCQ(id=1000+i,question=f'Bulk question {i}?',option1='A',option2='B',option3='C',option4='D',correct_answer='A',category=self.category,status='approved',created_by=self.admin,submitted_by=self.admin) for i in range(60)]
        MCQ.objects.bulk_create(more)
        response=self.client.get('/api/mcqs?page=1&page_size=20')
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertEqual(len(data['items']),20)
        self.assertEqual(data['pageSize'],20)
        self.assertGreaterEqual(data['total'],61)
        self.assertTrue(data['hasNext'])
        capped=self.client.get('/api/mcqs?page=1&page_size=1000').json()
        self.assertEqual(capped['pageSize'],50)
        with CaptureQueriesContext(connection) as list_queries:
            self.client.get('/api/mcqs?page=1&page_size=20')
        self.assertLessEqual(len(list_queries),5)
        bootstrap=self.client.get('/api/bootstrap').json()
        self.assertLessEqual(len(bootstrap['mcqs']),5)
        self.assertGreaterEqual(bootstrap['mcqPage']['total'],61)
        self.assertIn('mcqPage',bootstrap)

    def test_public_mcq_pages_load_ten_rows_with_exact_database_total(self):
        self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        more=[MCQ(id=2100+i,question=f'Public page question {i}?',option1='A',option2='B',option3='C',option4='D',correct_answer='A',category=self.category,status='approved',created_by=self.admin,submitted_by=self.admin) for i in range(24)]
        MCQ.objects.bulk_create(more)
        data=self.client.get('/api/mcqs?public=1&page=2&page_size=10').json()
        self.assertEqual(data['pageSize'],10)
        self.assertEqual(len(data['items']),10)
        self.assertEqual(data['total'],MCQ.objects.filter(status='approved').count())
        self.assertTrue(all(row['status']=='approved' for row in data['items']))

    def test_public_important_pages_use_two_distinct_job_ids(self):
        self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        job1=Job.objects.create(id=710,name='Important Job One',paper=self.paper)
        job2=Job.objects.create(id=711,name='Important Job Two',paper=self.paper)
        self.approved.job_ids=[job1.id,job2.id]
        self.approved.save(update_fields=['job_ids'])
        data=self.client.get('/api/mcqs?public=1&important=1&page=1&page_size=10').json()
        self.assertIn(self.approved.id,{row['id'] for row in data['items']})
        self.assertEqual(data['total'],1)
        row=next(row for row in data['items'] if row['id']==self.approved.id)
        self.assertTrue(row['important'])

    def test_public_entity_pages_load_ten_records_and_keep_total(self):
        self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        Category.objects.bulk_create([Category(id=3000+i,name=f'Category {i}',icon='grid') for i in range(15)])
        first=self.client.get('/api/entities?type=categories&scope=public&page=1').json()
        second=self.client.get('/api/entities?type=categories&scope=public&page=2').json()
        self.assertEqual(first['pageSize'],10)
        self.assertEqual(len(first['items']),10)
        self.assertEqual(first['total'],Category.objects.filter(active=True).count())
        self.assertEqual(second['total'],first['total'])
        self.assertLessEqual(len(second['items']),10)

    def test_admin_mcq_endpoint_caps_large_page_sizes_and_owner_filter(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        response=self.client.get('/api/mcqs?page=1&page_size=500')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['pageSize'],50)
        self.assertLessEqual(len(response.json()['items']),50)
        mine=self.client.get('/api/mcqs?page=1&page_size=500&owner=me').json()
        self.assertEqual(mine['pageSize'],50)
        self.assertTrue(all(row.get('created_by_id')==self.owner.id for row in mine['items']))

    def test_admin_mcq_endpoint_supports_bounded_id_batches(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        ids=[self.approved.id,self.pending.id]
        data=self.client.get('/api/mcqs?ids='+','.join(str(x) for x in ids)+'&page_size=50').json()
        self.assertEqual(data['pageSize'],50)
        self.assertEqual(data['total'],2)
        self.assertEqual({row['id'] for row in data['items']},set(ids))

    def test_admin_overview_keeps_exact_counts_and_only_five_recent_rows(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        self.post_json('/api/auth/switch-role',{'role':'super-admin'})
        data=self.client.get('/api/admin/overview').json()
        self.assertEqual(data['mcqs']['total'],MCQ.objects.count())
        self.assertLessEqual(len(data['recent']),5)
        self.assertIn('staffStats',data)

    def test_mcq_endpoint_filters_pending_updates_as_pending(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        self.approved.pending_update={'proposed':{'question':self.approved.question},'changes':[]}
        self.approved.save(update_fields=['pending_update'])
        data=self.client.get('/api/mcqs?status=pending&page_size=500').json()
        self.assertIn(self.approved.id,{row['id'] for row in data['items']})

    def test_hot_responses_stay_small_and_query_counts_bounded(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        with CaptureQueriesContext(connection) as switch_queries:
            switched=self.post_json('/api/auth/switch-role',{'role':'admin'})
        self.assertLess(len(switch_queries),15)
        self.assertLess(len(switched.content),10000)
        category_payload={'action':'form:entity','payload':{'fields':[['entity-active','on']], 'values':{'entity-name':'Fast Category','entity-icon':'grid','entity-country':'Pakistan'}, 'context':{'type':'categories'}}}
        with CaptureQueriesContext(connection) as command_queries:
            response=self.post_json('/api/commands',category_payload)
        self.assertLess(len(command_queries),15)
        self.assertLess(len(response.content),10000)
        self.assertNotIn('snapshot',response.json())

    def test_bootstrap_excludes_admin_only_collections(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        data=self.client.get('/api/bootstrap').json()
        for key in ['users','reports','contacts','logs','trash','adminPerformance','posts','guides','ads','attempts','bookmarks','savedPapers']:
            self.assertNotIn(key,data)

    def test_admin_data_is_lazy_and_permission_protected(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        self.assertEqual(self.client.get('/api/admin/users').status_code,200)
        self.assertEqual(self.client.get('/api/admin/reports').status_code,200)
        self.assertEqual(self.client.get('/api/admin/trash').status_code,200)
        self.client.logout()
        self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        self.assertEqual(self.client.get('/api/admin/users').status_code,403)
        self.assertEqual(self.client.get('/api/admin/trash').status_code,403)

    @override_settings(PERFORMANCE_LOGGING=True)
    def test_performance_health_is_super_admin_only(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        response=self.client.get('/api/health/performance')
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertIn('databaseMs',data)
        self.assertIn(data['db_backend'],{'sqlite','postgresql'})
        self.client.logout()
        self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        self.assertEqual(self.client.get('/api/health/performance').status_code,404)

    def test_learner_dashboard_is_focused_and_authenticated(self):
        self.client.logout()
        self.assertEqual(self.client.get('/api/learner/dashboard').status_code,401)
        self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        data=self.client.get('/api/learner/dashboard').json()
        self.assertIn('attempts',data)
        self.assertIn('bookmarks',data)
        self.assertIn('savedPapers',data)
        self.assertNotIn('user',data)
        self.assertNotIn('users',data)
        self.assertNotIn('logs',data)
        self.assertNotIn('trash',data)

    def test_startup_and_auth_identity_payloads_exclude_large_avatar(self):
        profile=profile_for(self.owner)
        profile.avatar='data:image/png;base64,'+('A'*140000)
        profile.save(update_fields=['avatar'])
        startup=self.client.get('/api/startup')
        self.assertEqual(startup.status_code,200)
        self.assertLess(len(startup.content),5000)
        login=self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        self.assertEqual(login.status_code,200)
        self.assertLess(len(login.content),5000)
        self.assertNotIn('avatar',login.json()['user'])
        authenticated_startup=self.client.get('/api/startup')
        self.assertLess(len(authenticated_startup.content),10000)
        self.assertNotIn('avatar',authenticated_startup.json()['user'])
        session=self.client.get('/api/auth/session')
        self.assertLess(len(session.content),5000)
        self.assertNotIn('avatar',session.json()['user'])
        switched=self.post_json('/api/auth/switch-role',{'role':'admin'})
        self.assertLess(len(switched.content),5000)
        self.assertEqual(switched.json()['activeRole'],'admin')
        self.assertNotIn('user',switched.json())
        learner=self.client.get('/api/learner/dashboard')
        self.assertLess(len(learner.content),20000)
        profile_response=self.client.get('/api/profile')
        self.assertTrue(profile_response.json()['user']['avatar'].startswith('data:image/png;base64,'))

    def test_public_bootstrap_query_count_is_bounded(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        with CaptureQueriesContext(connection) as queries:
            response=self.client.get('/api/bootstrap')
        self.assertEqual(response.status_code,200)
        self.assertLessEqual(len(queries),10)
        data=response.json()
        for key in ['posts','guides','ads','attempts','bookmarks','savedPapers','pdfs','latestJobs']:
            self.assertNotIn(key,data)

    def test_public_content_is_lazy(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        data=self.client.get('/api/public/content').json()
        self.assertIn('posts',data)
        self.assertIn('guides',data)
        self.assertIn('ads',data)
        resources_response=self.client.get('/api/public/resources')
        resources=resources_response.json()
        self.assertIn('settings',resources)
        self.assertNotIn('pdfs',resources)
        self.assertIn('seoIndex',resources)
        self.assertFalse(any(key.startswith('mcq:') for key in resources['seoIndex']['items']))
        self.assertIn('private, no-store',resources_response['Cache-Control'])
        catalog=self.client.get('/api/public/catalog').json()
        self.assertIn('pdfs',catalog)
        self.assertIn('latestJobs',catalog)
        legal=self.client.get('/api/public/legal').json()
        self.assertIn('content',legal)

    def test_empty_content_bootstrap_remains_well_formed(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        MCQ.objects.all().delete()
        Category.objects.all().delete()
        Paper.objects.all().delete()
        data=self.client.get('/api/bootstrap').json()
        self.assertEqual(data['mcqs'],[])
        self.assertEqual(data['categories'],[])
        self.assertEqual(data['papers'],[])
        self.assertEqual(data['mcqPage']['total'],0)
        self.assertFalse(data['mcqPage']['hasNext'])

    def test_social_footer_email_is_optional_and_persisted(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        payload={'action':'form:social-links','payload':{'fields':[['footer_email_enabled','on']], 'values':{'footer_email':'hello@example.com'}, 'context':{}}}
        response=self.post_json('/api/commands',payload)
        self.assertEqual(response.status_code,200)
        settings=self.client.get('/api/public/resources').json()['settings']
        self.assertEqual(settings['socialLinks']['email']['address'],'hello@example.com')
        self.assertTrue(settings['socialLinks']['email']['enabled'])


    def test_public_contact_and_report(self):
        self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        self.assertEqual(self.post_json('/api/contact',{'name':'Visitor','email':'visitor@example.com','message':'Please help.'}).status_code,200)
        self.assertEqual(self.post_json('/api/report',{'id':self.approved.id,'reason':'Check wording.'}).status_code,200)
        self.assertEqual(ContactMessage.objects.count(),1)
        self.assertEqual(Report.objects.count(),1)

    def test_read_and_auth_flows_do_not_delete_existing_data(self):
        before=(Category.objects.count(),Paper.objects.count(),MCQ.objects.count())
        self.client.get('/api/bootstrap')
        self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        self.client.get('/api/bootstrap')
        self.assertEqual((Category.objects.count(),Paper.objects.count(),MCQ.objects.count()),before)


@override_settings(
    SECURE_SSL_REDIRECT=False,
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    AUTH_RATE_LIMIT_ENABLED=False,
    EMAIL_VERIFICATION_RESEND_SECONDS=0,
)
class AuthSecurityTests(TestCase):
    def post_json(self,path,data):
        return self.client.post(path,data=json.dumps(data),content_type='application/json')

    def code_from_last_email(self):
        match=re.search(r'\b(\d{6})\b',mail.outbox[-1].body)
        self.assertIsNotNone(match)
        return match.group(1)

    def register(self,email='newlearner@example.com',password='StrongPass!246',**extra):
        payload={'first_name':'New','last_name':'Learner','email':email,'password':password,'confirm':password,'terms':'on',**extra}
        return self.post_json('/api/auth/register',payload)

    def verified_user(self,email,role='user',is_staff=False,is_superuser=False):
        u=User.objects.create_user(username=email,email=email,password='StrongPass!246',is_staff=is_staff,is_superuser=is_superuser)
        p=profile_for(u); p.role=role; p.email_verified=True; p.permissions=[]; p.save()
        return u

    def login(self,email,password='StrongPass!246'):
        return self.post_json('/api/auth/login',{'email':email,'password':password})

    def save_user_payload(self,target,role,status='active',permissions=()):
        return {'action':'form:user','payload':{
            'fields':[[f'perm_{p}','on'] for p in permissions],
            'values':{'name':target.first_name or 'User','email':target.email,'role':role,'status':status},
            'context':{'id':str(target.id)}
        }}

    def test_signup_is_pending_until_verified_and_creates_learner_only_after_otp(self):
        settings=SiteSetting.get_solo()
        admin_permissions=dict(settings.admin_permissions or {})
        site=dict(admin_permissions.get('_site') or {})
        site['countries']=[{'name':'Pakistan','active':True},{'name':'India','active':True}]
        admin_permissions['_site']=site
        settings.admin_permissions=admin_permissions
        settings.save(update_fields=['admin_permissions'])
        response=self.register(country='India',role='super-admin',is_superuser=True,is_staff=True)
        self.assertEqual(response.status_code,200)
        self.assertTrue(response.json()['verificationRequired'])
        self.assertFalse(User.objects.filter(email='newlearner@example.com').exists())
        pending=PendingSignup.objects.get(email='newlearner@example.com')
        self.assertEqual(pending.first_name,'New')
        self.assertEqual(pending.last_name,'Learner')
        self.assertEqual(pending.country,'India')
        code=self.code_from_last_email()
        verified=self.post_json('/api/auth/verify',{'email':pending.email,'code':code})
        self.assertEqual(verified.status_code,200)
        self.assertFalse(PendingSignup.objects.filter(email=pending.email).exists())
        user=User.objects.get(email='newlearner@example.com')
        profile=profile_for(user)
        self.assertEqual(profile.role,'user')
        self.assertEqual(profile.country,'India')
        self.assertTrue(profile.email_verified)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_pending_signup_cannot_login_before_verification(self):
        self.register()
        self.assertFalse(User.objects.filter(email='newlearner@example.com').exists())
        response=self.login('newlearner@example.com')
        self.assertEqual(response.status_code,422)
        self.assertIsNone(self.client.get('/api/auth/session').json()['user'])

    def test_valid_wrong_expired_and_used_verification_codes(self):
        self.register()
        email='newlearner@example.com'
        code=self.code_from_last_email()
        wrong=self.post_json('/api/auth/verify',{'email':email,'code':'000000' if code!='000000' else '999999'})
        self.assertEqual(wrong.status_code,422)
        self.assertFalse(User.objects.filter(email=email).exists())
        valid=self.post_json('/api/auth/verify',{'email':email,'code':code})
        self.assertEqual(valid.status_code,200)
        user=User.objects.get(email=email)
        self.assertTrue(profile_for(user).email_verified)
        reused=self.post_json('/api/auth/verify',{'email':email,'code':code})
        self.assertEqual(reused.status_code,422)

        self.register(email='expired@example.com')
        expired_code=self.code_from_last_email()
        PendingSignup.objects.filter(email='expired@example.com').update(expires_at=timezone.now()-timedelta(seconds=1))
        expired=self.post_json('/api/auth/verify',{'email':'expired@example.com','code':expired_code})
        self.assertEqual(expired.status_code,422)
        self.assertFalse(User.objects.filter(email='expired@example.com').exists())

    def test_resend_invalidates_previous_otp_and_cooldown(self):
        self.register()
        email='newlearner@example.com'
        first=self.code_from_last_email()
        response=self.post_json('/api/auth/resend-verification',{'email':email})
        self.assertEqual(response.status_code,200)
        second=self.code_from_last_email()
        self.assertNotEqual(first,second)
        self.assertEqual(self.post_json('/api/auth/verify',{'email':email,'code':first}).status_code,422)
        self.assertEqual(self.post_json('/api/auth/verify',{'email':email,'code':second}).status_code,200)

    @override_settings(EMAIL_VERIFICATION_RESEND_SECONDS=60)
    def test_resend_cooldown_works(self):
        self.register()
        count=len(mail.outbox)
        self.post_json('/api/auth/resend-verification',{'email':'newlearner@example.com'})
        self.assertEqual(len(mail.outbox),count)

    @override_settings(EMAIL_VERIFICATION_MAX_ATTEMPTS=5)
    def test_otp_attempt_limit_works(self):
        self.register()
        code=self.code_from_last_email()
        wrong='000000' if code!='000000' else '999999'
        for _ in range(5):
            self.assertEqual(self.post_json('/api/auth/verify',{'email':'newlearner@example.com','code':wrong}).status_code,422)
        self.assertEqual(self.post_json('/api/auth/verify',{'email':'newlearner@example.com','code':code}).status_code,422)
        pending=PendingSignup.objects.get(email='newlearner@example.com')
        self.assertEqual(pending.attempt_count,5)
        self.assertFalse(User.objects.filter(email='newlearner@example.com').exists())

    def test_signup_requires_names_and_matching_passwords(self):
        missing=self.post_json('/api/auth/register',{'first_name':'','last_name':'Learner','email':'fields@example.com','password':'StrongPass!246','confirm':'StrongPass!246','terms':'on'})
        self.assertEqual(missing.status_code,422)
        mismatch=self.post_json('/api/auth/register',{'first_name':'New','last_name':'Learner','email':'fields@example.com','password':'StrongPass!246','confirm':'DifferentPass!246','terms':'on'})
        self.assertEqual(mismatch.status_code,422)
        self.assertFalse(User.objects.filter(email='fields@example.com').exists())
        self.assertFalse(PendingSignup.objects.filter(email='fields@example.com').exists())

    def test_verification_email_is_html_and_welcome_email_is_sent(self):
        response=self.register()
        self.assertEqual(response.status_code,200)
        self.assertFalse(User.objects.filter(email='newlearner@example.com').exists())
        self.assertEqual(mail.outbox[-1].subject,'Your MCQCampus verification code')
        self.assertTrue(mail.outbox[-1].alternatives)
        self.assertIn('Verify your email',mail.outbox[-1].alternatives[0].content)
        code=self.code_from_last_email()
        verified=self.post_json('/api/auth/verify',{'email':'newlearner@example.com','code':code})
        self.assertEqual(verified.status_code,200)
        self.assertTrue(User.objects.filter(email='newlearner@example.com').exists())
        self.assertEqual(mail.outbox[-1].subject,'Welcome to MCQCampus')
        self.assertTrue(mail.outbox[-1].alternatives)
        self.assertIn('Welcome to MCQCampus',mail.outbox[-1].alternatives[0].content)

    def test_password_change_requires_current_password_and_email_otp(self):
        user=self.verified_user('securechange@example.com')
        self.login(user.email)
        wrong=self.post_json('/api/auth/password-change/start',{
            'current_password':'WrongPass!999','new_password':'NewSecure!852','confirm_password':'NewSecure!852'
        })
        self.assertEqual(wrong.status_code,422)
        same=self.post_json('/api/auth/password-change/start',{
            'current_password':'StrongPass!246','new_password':'StrongPass!246','confirm_password':'StrongPass!246'
        })
        self.assertEqual(same.status_code,422)
        started=self.post_json('/api/auth/password-change/start',{
            'current_password':'StrongPass!246','new_password':'NewSecure!852','confirm_password':'NewSecure!852'
        })
        self.assertEqual(started.status_code,200)
        user.refresh_from_db()
        self.assertTrue(user.check_password('StrongPass!246'))
        self.assertFalse(user.check_password('NewSecure!852'))
        self.assertEqual(mail.outbox[-1].subject,'Confirm your MCQCampus password change')
        code=self.code_from_last_email()
        bad=self.post_json('/api/auth/password-change/confirm',{'code':'000000' if code!='000000' else '999999'})
        self.assertEqual(bad.status_code,422)
        confirmed=self.post_json('/api/auth/password-change/confirm',{'code':code})
        self.assertEqual(confirmed.status_code,200)
        user.refresh_from_db()
        self.assertFalse(user.check_password('StrongPass!246'))
        self.assertTrue(user.check_password('NewSecure!852'))

    def test_password_reset_otp_single_use_and_django_validators(self):
        user=self.verified_user('reset@example.com')
        forgot=self.post_json('/api/auth/forgot',{'email':user.email})
        self.assertEqual(forgot.status_code,200)
        code=self.code_from_last_email()
        weak=self.post_json('/api/auth/reset',{'email':user.email,'code':code,'password':'password','confirm':'password'})
        self.assertEqual(weak.status_code,422)
        good='AnotherStrong!579'
        ok=self.post_json('/api/auth/reset',{'email':user.email,'code':code,'password':good,'confirm':good})
        self.assertEqual(ok.status_code,200)
        user.refresh_from_db(); self.assertTrue(user.check_password(good))
        reuse=self.post_json('/api/auth/reset',{'email':user.email,'code':code,'password':'ThirdStrong!852','confirm':'ThirdStrong!852'})
        self.assertEqual(reuse.status_code,422)

    def test_malformed_email_rejected_and_raw_otp_not_returned_or_stored(self):
        bad=self.register(email='not-an-email')
        self.assertEqual(bad.status_code,422)
        response=self.register()
        code=self.code_from_last_email()
        self.assertNotIn(code,response.content.decode())
        pending=PendingSignup.objects.get(email='newlearner@example.com')
        self.assertNotEqual(pending.code_hash,code)
        self.assertNotIn(code,repr(pending))

    def test_super_admin_promote_and_demote_preserve_content(self):
        owner=self.verified_user('owner2@example.com','super-admin',True,True)
        learner=self.verified_user('worker@example.com')
        category=Category.objects.create(id=501,name='Retention',icon='grid')
        mcq=MCQ.objects.create(id=501,question='Keep me?',option1='A',option2='B',option3='C',option4='D',correct_answer='A',category=category,status='pending',created_by=learner,submitted_by=learner)
        self.login(owner.email)
        promoted=self.post_json('/api/commands',self.save_user_payload(learner,'admin',permissions=['add_mcq']))
        self.assertEqual(promoted.status_code,200)
        learner.refresh_from_db(); p=profile_for(learner); p.refresh_from_db()
        self.assertTrue(learner.is_staff); self.assertFalse(learner.is_superuser); self.assertEqual(p.role,'admin')
        self.assertEqual(promoted.json()['result']['user']['roles'],['user','admin'])
        demoted=self.post_json('/api/commands',self.save_user_payload(learner,'user'))
        self.assertEqual(demoted.status_code,200)
        learner.refresh_from_db(); p.refresh_from_db()
        self.assertFalse(learner.is_staff); self.assertFalse(learner.is_superuser); self.assertEqual(p.role,'user'); self.assertEqual(p.permissions,[])
        mcq.refresh_from_db(); self.assertEqual(mcq.created_by_id,learner.id); self.assertEqual(mcq.submitted_by_id,learner.id)

    def test_disabling_preserves_content_and_last_super_admin_is_protected(self):
        owner=self.verified_user('owner3@example.com','super-admin',True,True)
        admin=self.verified_user('admin3@example.com','admin',True,False)
        category=Category.objects.create(id=502,name='Disable Retention',icon='grid')
        mcq=MCQ.objects.create(id=502,question='Stay?',option1='A',option2='B',option3='C',option4='D',correct_answer='A',category=category,status='pending',created_by=admin,submitted_by=admin)
        self.login(owner.email)
        disabled=self.post_json('/api/commands',{'action':'action:user-status','payload':{'id':str(admin.id)}})
        self.assertEqual(disabled.status_code,200)
        admin.refresh_from_db(); self.assertFalse(admin.is_active)
        mcq.refresh_from_db(); self.assertEqual(mcq.created_by_id,admin.id)
        self.assertEqual(self.post_json('/api/commands',{'action':'action:user-status','payload':{'id':str(owner.id)}}).status_code,403)
        demote=self.post_json('/api/commands',self.save_user_payload(owner,'user'))
        self.assertEqual(demote.status_code,403)

    def test_normal_admin_cannot_change_roles(self):
        admin=self.verified_user('normaladmin@example.com','admin',True,False)
        learner=self.verified_user('target@example.com')
        self.login(admin.email)
        response=self.post_json('/api/commands',self.save_user_payload(learner,'admin'))
        self.assertEqual(response.status_code,403)

    def test_auth_responses_stay_small(self):
        self.register()
        verify_response=self.post_json('/api/auth/verify',{'email':'newlearner@example.com','code':self.code_from_last_email()})
        self.assertLess(len(verify_response.content),5000)
        login_response=self.login('newlearner@example.com')
        self.assertLess(len(login_response.content),5000)
        self.assertNotIn('avatar',login_response.json()['user'])

    @override_settings(AUTH_RATE_LIMIT_ENABLED=True)
    def test_login_rate_limit_is_database_backed(self):
        user=self.verified_user('ratelimit@example.com')
        for _ in range(7):
            self.assertEqual(self.post_json('/api/auth/login',{'email':user.email,'password':'WrongPass!999'}).status_code,422)
        blocked=self.post_json('/api/auth/login',{'email':user.email,'password':'WrongPass!999'})
        self.assertEqual(blocked.status_code,429)

