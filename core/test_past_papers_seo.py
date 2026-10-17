import json
import re
from html import unescape
import xml.etree.ElementTree as ET

from django.test import TestCase, override_settings
from django.utils.html import escape

from .models import Job, JobYear, Paper, SiteSetting
from .views import _seo_indexed_path, _seo_past_papers_catalog, _seo_past_papers_record
from .cache_utils import invalidate_mcqcampus_cache


@override_settings(SECURE_SSL_REDIRECT=False, PREPEND_WWW=False)
class PastPapersSEOTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        SiteSetting.objects.create(singleton=1)
        cls.ppsc = Paper.objects.create(
            id=9801, name='Punjab Public Service Commission [PPSC]', country='Pakistan'
        )
        cls.spsc = Paper.objects.create(
            id=9802, name='Sindh Public Service Commission [SPSC]', country='Pakistan'
        )
        cls.ppsc_2024 = JobYear.objects.create(
            id=98100, name='Past Paper 2024', paper=cls.ppsc
        )
        cls.spsc_2025 = JobYear.objects.create(
            id=98200, name='Past Paper 2025', paper=cls.spsc
        )
        # A legacy Job row is intentionally present to confirm it is not part
        # of public navigation or the SEO index before the one-time DB cleanup.
        cls.legacy_job = Job.objects.create(id=98010, name='Assistant', paper=cls.ppsc)
        invalidate_mcqcampus_cache('public-resources')

    def page(self, path, status=200):
        response = self.client.get(path)
        self.assertEqual(response.status_code, status, getattr(response, 'url', path))
        html = response.content.decode()
        title = re.search(r'<title>(.*?)</title>', html, re.S)
        canonical = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        heading = re.search(r'<h1>(.*?)</h1>', html, re.S)
        self.assertIsNotNone(title, f'No page title on {path}')
        self.assertIsNotNone(canonical, f'No canonical URL on {path}')
        self.assertIsNotNone(heading, f'No SEO heading on {path}')
        links = [
            (unescape(label), unescape(href))
            for href, label in re.findall(r'<a[ ]+[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.S)
        ]
        data = {
            'title': unescape(title.group(1)),
            'canonical': unescape(canonical.group(1)),
            'heading': unescape(re.sub(r'<[^>]+>', '', heading.group(1))),
            'links': links,
        }
        self.assertIn(data['title'], html)
        return data, html

    def urls(self, path):
        response = self.client.get(path, follow=True)
        return [
            node.text for node in ET.fromstring(response.content).iter()
            if node.tag.endswith('}loc')
        ]

    def test_organization_pages_are_canonical_and_directly_list_past_papers(self):
        canonical_path = _seo_indexed_path('paper', self.ppsc)
        page, html = self.page(canonical_path)
        self.assertEqual(page['canonical'], 'https://www.mcqcampus.com' + canonical_path)
        self.assertEqual(page['heading'], 'PPSC Past Papers')
        self.assertEqual(page['title'], 'PPSC Past Papers & Solved MCQs')
        linked_urls = [url for _, url in page['links']]
        self.assertIn(_seo_indexed_path('year', self.ppsc_2024), linked_urls)
        self.assertIn('PPSC Past Papers is organized', html)
        urls = self.urls('/sitemap.xml')
        self.assertIn(page['canonical'], urls)
        self.assertFalse(any('/mcqs/' in url for url in urls))

    def test_organization_catalog_does_not_expose_legacy_job_landings(self):
        catalog = _seo_past_papers_catalog()
        self.assertEqual(catalog['jobs'], [])
        self.assertEqual(catalog['job_paths'], {})
        self.assertEqual(catalog['group_paths'], {})
        ppsc_record = _seo_past_papers_record('/ppsc-past-papers', catalog)
        self.assertEqual(ppsc_record['paper'].id, self.ppsc.id)
        self.assertIsNone(ppsc_record['job'])
        self.assertEqual(ppsc_record['jobs'], [])

    def test_public_entity_api_exposes_boards_and_direct_past_papers_only(self):
        papers = self.client.get(
            '/api/entities', {'scope': 'public', 'type': 'papers', 'country': 'Pakistan'}
        ).json()
        self.assertEqual({row['id'] for row in papers['items']}, {self.ppsc.id, self.spsc.id})

        ppsc_years = self.client.get(
            '/api/entities', {'scope': 'public', 'type': 'years', 'parent': self.ppsc.id}
        ).json()
        self.assertEqual([row['id'] for row in ppsc_years['items']], [self.ppsc_2024.id])

        jobs = self.client.get(
            '/api/entities', {'scope': 'public', 'type': 'jobs', 'parent': self.ppsc.id}
        ).json()
        self.assertEqual(jobs['items'], [])

        resources = self.client.get('/api/public/resources').json()
        self.assertIn(f'paper:{self.ppsc.id}', resources['seoIndex']['items'])
        self.assertIn(f'year:{self.ppsc_2024.id}', resources['seoIndex']['items'])
        self.assertNotIn(f'job:{self.legacy_job.id}', resources['seoIndex']['items'])

    def test_indexed_organization_and_year_routes_keep_their_record_identity(self):
        for kind, obj in [('paper', self.ppsc), ('year', self.ppsc_2024)]:
            path = _seo_indexed_path(kind, obj)
            self.assertTrue(path)
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertIn('id="seo-route"', response.content.decode())

    def test_public_browsing_without_login_and_noindex_support(self):
        client = self.client.__class__()
        for path in ['/', '/mcqs', '/past-papers', '/categories', '/blog', '/latest-jobs', '/past-papers/pdfs']:
            response = client.get(path)
            self.assertNotEqual(response.status_code, 302, path)
            self.assertNotEqual(response.status_code, 401, path)
        public_mcqs = client.get('/api/mcqs', {'public': '1', 'page_size': 10})
        self.assertEqual(public_mcqs.status_code, 200, public_mcqs.content.decode())
        for path in ['/about', '/contact']:
            response = client.get(path)
            self.assertEqual(response.status_code, 200, path)
            self.assertIn('noindex', response.content.decode().lower())

    def test_root_favicon_ico_is_served_from_the_existing_asset(self):
        response = self.client.get('/favicon.ico')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response['Content-Type'].startswith('image/x-icon'))
        icon = b''.join(response.streaming_content)
        self.assertTrue(icon.startswith(b'\x00\x00\x01\x00'))

    def test_root_favicon_svg_is_served_as_svg(self):
        response = self.client.get('/favicon.svg')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response['Content-Type'].startswith('image/svg+xml'))
        svg = ''.join(chunk.decode() if isinstance(chunk, bytes) else chunk for chunk in response.streaming_content).lower()
        self.assertIn('<svg', svg)

    def test_old_jobs_exams_url_redirects_to_past_papers(self):
        response = self.client.get('/jobs-exams')
        self.assertEqual(response.status_code, 301)
        self.assertTrue(response['Location'].endswith('/past-papers'))

    def test_new_past_papers_are_automatically_discoverable(self):
        board = Paper.objects.create(
            id=9803, name='National Testing Service [NTS]', country='Pakistan'
        )
        year = JobYear.objects.create(id=98300, name='Past Paper 2026', paper=board)
        catalog = _seo_past_papers_catalog()
        self.assertIn(board.id, catalog['paper_paths'])
        self.assertEqual(catalog['paper_paths'][board.id], '/nts-past-papers')
        self.assertTrue(_seo_indexed_path('year', year))
