import json
from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from .models import Category, MCQ, Paper, Profile, Report, ContactMessage, profile_for


@override_settings(SECURE_SSL_REDIRECT=False)
class IntegrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
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

    def post_json(self,path,data):
        return self.client.post(path,data=json.dumps(data),content_type='application/json')

    def test_complete_frontend_entry_loads(self):
        response=self.client.get('/')
        self.assertEqual(response.status_code,200)
        body=response.content.decode()
        self.assertIn('assets/js/auth.js',body)
        self.assertIn('assets/js/seo.js',body)
        self.assertNotIn('assets/js/seed.js',body)

    def test_public_bootstrap_exposes_only_public_content(self):
        response=self.client.get('/api/bootstrap')
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertEqual([row['id'] for row in data['mcqs']],[self.approved.id])
        self.assertEqual(data['users'],[])
        self.assertEqual(data['logs'],[])
        self.assertEqual(data['reports'],[])

    def test_protected_commands_require_login(self):
        response=self.post_json('/api/commands',{'action':'toggleBookmark','payload':{'args':[self.approved.id]}})
        self.assertEqual(response.status_code,401)

    def test_learner_login_and_logout(self):
        response=self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['user']['activeRole'],'user')
        self.assertEqual(len(self.client.get('/api/bootstrap').json()['mcqs']),1)
        self.assertEqual(self.post_json('/api/auth/logout',{}).status_code,200)
        self.assertIsNone(self.client.get('/api/auth/session').json()['user'])

    def test_admin_and_super_admin_visibility(self):
        self.post_json('/api/auth/login',{'email':'admin@example.com','password':'AdminPass123'})
        admin_data=self.client.get('/api/bootstrap').json()
        self.assertEqual({row['id'] for row in admin_data['mcqs']},{1,2,3})
        self.assertEqual(admin_data['users'][0]['id'],self.admin.id)
        self.client.logout()
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        owner_data=self.client.get('/api/bootstrap').json()
        self.assertEqual({row['id'] for row in owner_data['mcqs']},{1,2,3})
        self.assertEqual(len(owner_data['users']),3)

    def test_super_admin_can_switch_workspace_without_role_loss(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        switched=self.post_json('/api/auth/switch-role',{'role':'user'})
        self.assertEqual(switched.status_code,200)
        self.assertEqual(switched.json()['user']['activeRole'],'user')
        self.assertIn('super-admin',switched.json()['user']['roles'])

    def test_switch_role_response_is_small_and_has_no_snapshot(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        response=self.post_json('/api/auth/switch-role',{'role':'admin'})
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertNotIn('snapshot',data)
        self.assertEqual(data['user']['activeRole'],'admin')

    def test_command_response_is_delta_only(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        response=self.post_json('/api/commands',{'action':'toggleBookmark','payload':{'args':[self.approved.id]}})
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertNotIn('snapshot',data)
        self.assertTrue(data['success'])
        self.assertTrue(data['result'])

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

    def test_mcq_endpoint_is_paginated_and_bootstrap_is_bounded(self):
        more=[MCQ(id=1000+i,question=f'Bulk question {i}?',option1='A',option2='B',option3='C',option4='D',correct_answer='A',category=self.category,status='approved',created_by=self.admin,submitted_by=self.admin) for i in range(60)]
        MCQ.objects.bulk_create(more)
        response=self.client.get('/api/mcqs?page=1&page_size=20')
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertEqual(len(data['items']),20)
        self.assertEqual(data['pageSize'],20)
        self.assertGreaterEqual(data['total'],61)
        self.assertTrue(data['hasNext'])
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        bootstrap=self.client.get('/api/bootstrap').json()
        self.assertLessEqual(len(bootstrap['mcqs']),50)
        self.assertIn('mcqPage',bootstrap)

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

    def test_public_contact_and_report(self):
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
