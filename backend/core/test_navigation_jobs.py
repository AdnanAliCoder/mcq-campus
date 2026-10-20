import json

from django.test import TestCase, override_settings
from django.contrib.auth.models import User

from .models import SiteSetting, Paper, Job, JobYear, profile_for
from .services import _site_blob, _save_site_blob
from .views import _seo_indexed_path
from .cache_utils import invalidate_mcqcampus_cache


@override_settings(SECURE_SSL_REDIRECT=False, PREPEND_WWW=False)
class OrganizationPastPaperNavigationTests(TestCase):
    def setUp(self):
        self.settings = SiteSetting.objects.create(singleton=1)
        self.paper = Paper.objects.create(id=200, name='PPSC', country='Pakistan')
        # A legacy row may exist before the one-time conversion command runs.
        self.legacy_job = Job.objects.create(id=400, name='Assistant', paper=self.paper)
        self.year = JobYear.objects.create(id=600, name='Past Paper 2025', paper=self.paper)
        self.owner = User.objects.create_superuser('owner', 'owner@example.com', 'OwnerPass123')
        profile = profile_for(self.owner)
        profile.role = 'super-admin'
        profile.save()
        invalidate_mcqcampus_cache('public-resources')

    def test_public_taxonomy_is_organization_to_past_paper_and_hides_legacy_jobs(self):
        for kind, obj in [('paper', self.paper), ('year', self.year)]:
            path = _seo_indexed_path(kind, obj)
            self.assertTrue(path)
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            html = response.content.decode()
            self.assertIn('id="seo-route"', html)
            self.assertIn('"base": "' + kind + '"', html)

        data = self.client.get(
            '/api/entities', {'scope': 'public', 'type': 'years', 'parent': self.paper.id}
        ).json()
        self.assertEqual([item['id'] for item in data['items']], [self.year.id])

        old_jobs = self.client.get(
            '/api/entities', {'scope': 'public', 'type': 'jobs', 'parent': self.paper.id}
        ).json()
        self.assertEqual(old_jobs['items'], [])

        resources = self.client.get('/api/public/resources').json()
        self.assertIn(f'paper:{self.paper.id}', resources['seoIndex']['items'])
        self.assertIn(f'year:{self.year.id}', resources['seoIndex']['items'])
        self.assertNotIn(f'job:{self.legacy_job.id}', resources['seoIndex']['items'])

    def test_latest_job_announcements_bulk_delete_preserves_unselected_rows(self):
        blob = _site_blob(self.settings)
        blob['latestJobs'] = [
            {'id': 1, 'title': 'One'},
            {'id': 2, 'title': 'Two'},
            {'id': 3, 'title': 'Three'},
        ]
        _save_site_blob(self.settings, blob)
        self.settings.save()
        payload = {'action': 'action:latest-job-bulk-delete', 'payload': {'ids': [1, 3]}}
        self.client.force_login(self.owner)
        response = self.client.post(
            '/api/commands',
            json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['result']['count'], 2)
        self.settings.refresh_from_db()
        self.assertEqual([x['id'] for x in _site_blob(self.settings)['latestJobs']], [2])
        self.client.logout()
        self.assertEqual(
            self.client.post('/api/commands', json.dumps(payload), content_type='application/json').status_code,
            401,
        )
