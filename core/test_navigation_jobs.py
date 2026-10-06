import json
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from .models import SiteSetting, Paper, Job, JobYear, profile_for
from .services import seo_index_snapshot, _site_blob, _save_site_blob
from .views import _seo_indexed_path


@override_settings(SECURE_SSL_REDIRECT=False)
class NavigationJobsTests(TestCase):
    def setUp(self):
        self.settings=SiteSetting.objects.create(singleton=1)
        self.paper=Paper.objects.create(id=200,name='PPSC')
        self.job=Job.objects.create(id=400,name='Assistant',paper=self.paper)
        self.year=JobYear.objects.create(id=600,name='Assistant [2025]',job=self.job)
        self.owner=User.objects.create_superuser('owner','owner@example.com','OwnerPass123')
        p=profile_for(self.owner);p.role='super-admin';p.save()

    def test_direct_indexed_hierarchy_exposes_route_identity_and_children(self):
        for kind,obj,child_type in [('paper',self.paper,'jobs'),('job',self.job,'years')]:
            response=self.client.get(_seo_indexed_path(kind,obj))
            self.assertEqual(response.status_code,200)
            html=response.content.decode()
            self.assertIn('id="seo-route"',html)
            self.assertIn('"base": "'+kind+'"',html)
            data=self.client.get('/api/entities',{'scope':'public','type':child_type,'parent':obj.id}).json()
            self.assertEqual(len(data['items']),1)
        resources=self.client.get('/api/public/resources').json()
        for kind,obj in [('paper',self.paper),('job',self.job),('year',self.year)]:
            self.assertIn(f'{kind}:{obj.id}',resources['seoIndex']['items'])

    def test_bulk_delete_persists_and_preserves_unselected_jobs(self):
        blob=_site_blob(self.settings)
        blob['latestJobs']=[{'id':1,'title':'One'},{'id':2,'title':'Two'},{'id':3,'title':'Three'}]
        _save_site_blob(self.settings,blob);self.settings.save()
        payload={'action':'action:latest-job-bulk-delete','payload':{'ids':[1,3]}}
        self.client.force_login(self.owner)
        response=self.client.post('/api/commands',json.dumps(payload),content_type='application/json')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['result']['count'],2)
        self.settings.refresh_from_db()
        self.assertEqual([x['id'] for x in _site_blob(self.settings)['latestJobs']],[2])
        self.client.logout()
        self.assertEqual(self.client.post('/api/commands',json.dumps(payload),content_type='application/json').status_code,401)
