import json
from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from .models import Category, MCQ, Paper, Profile, Report, ContactMessage, JobOpportunity, profile_for


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

    def test_public_contact_and_report(self):
        self.assertEqual(self.post_json('/api/contact',{'name':'Visitor','email':'visitor@example.com','message':'Please help.'}).status_code,200)
        self.assertEqual(self.post_json('/api/report',{'id':self.approved.id,'reason':'Check wording.'}).status_code,200)
        self.assertEqual(ContactMessage.objects.count(),1)
        self.assertEqual(Report.objects.count(),1)


    def test_job_opportunity_is_private_until_published_and_status_is_computed(self):
        job=JobOpportunity.objects.create(
            title='PPSC Computer Operator 2026',
            slug='ppsc-computer-operator-2026',
            organization='Punjab Public Service Commission',
            last_date=timezone.localdate()+timedelta(days=5),
            published=False,
            created_by=self.owner,
        )
        self.assertEqual(job.computed_status,'unpublished')
        self.assertEqual(self.client.get('/api/bootstrap').json()['jobOpportunities'],[])
        job.published=True
        job.save(update_fields=['published'])
        self.assertEqual(job.computed_status,'open')
        public=self.client.get('/api/bootstrap').json()['jobOpportunities']
        self.assertEqual([row['slug'] for row in public],['ppsc-computer-operator-2026'])

    def test_super_admin_can_publish_job_with_preparation_relations(self):
        self.post_json('/api/auth/login',{'email':'owner@example.com','password':'OwnerPass123'})
        payload={
            'action':'form:job-opportunity',
            'payload':{
                'values':{
                    'title':'Computer Operator',
                    'organization':'PPSC',
                    'category':'PPSC Jobs',
                    'last_date':str(timezone.localdate()+timedelta(days=2)),
                    'related_mcq_ids':str(self.approved.id),
                    'related_category_ids':str(self.category.id),
                    'related_paper_ids':str(self.paper.id),
                },
                'fields':[['published','on']],
                'context':{},
            },
        }
        response=self.post_json('/api/commands',payload)
        self.assertEqual(response.status_code,200)
        row=response.json()['snapshot']['jobOpportunities'][0]
        self.assertEqual(row['status'],'closing-soon')
        self.assertEqual(row['related_mcq_ids'],[self.approved.id])
        self.assertEqual(row['related_category_ids'],[self.category.id])
        self.assertEqual(row['related_paper_ids'],[self.paper.id])

    def test_read_and_auth_flows_do_not_delete_existing_data(self):
        before=(Category.objects.count(),Paper.objects.count(),MCQ.objects.count())
        self.client.get('/api/bootstrap')
        self.post_json('/api/auth/login',{'email':'learner@example.com','password':'LearnerPass123'})
        self.client.get('/api/bootstrap')
        self.assertEqual((Category.objects.count(),Paper.objects.count(),MCQ.objects.count()),before)
