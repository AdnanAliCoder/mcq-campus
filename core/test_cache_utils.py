from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from unittest.mock import patch

from .cache_utils import cached_value, invalidate_mcqcampus_cache
from .services import seo_index_number, seo_index_snapshot
from .views import _invalidate_caches_after_command


@override_settings(CACHES={
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'mcqcampus-cache-test',
        'TIMEOUT': 300,
    },
})
class CacheUtilityTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_value_is_reused_until_group_is_invalidated(self):
        calls = []

        def build():
            calls.append(len(calls) + 1)
            return {'count': calls[-1]}

        first = cached_value('test-group', {'country': 'Pakistan'}, build, timeout=60)
        second = cached_value('test-group', {'country': 'Pakistan'}, build, timeout=60)
        self.assertEqual(first, {'count': 1})
        self.assertEqual(second, {'count': 1})
        self.assertEqual(len(calls), 1)

        invalidate_mcqcampus_cache('test-group')
        third = cached_value('test-group', {'country': 'Pakistan'}, build, timeout=60)
        self.assertEqual(third, {'count': 2})
        self.assertEqual(len(calls), 2)

    def test_cache_identity_keeps_country_results_separate(self):
        calls = []

        def build(country):
            return lambda: calls.append(country) or {'country': country}

        pakistan = cached_value('test-country', {'country': 'Pakistan'}, build('Pakistan'), timeout=60)
        india = cached_value('test-country', {'country': 'India'}, build('India'), timeout=60)
        pakistan_again = cached_value('test-country', {'country': 'Pakistan'}, build('Pakistan'), timeout=60)
        self.assertEqual(pakistan, {'country': 'Pakistan'})
        self.assertEqual(india, {'country': 'India'})
        self.assertEqual(pakistan_again, {'country': 'Pakistan'})
        self.assertEqual(calls, ['Pakistan', 'India'])

    def test_seo_index_registry_is_cached_until_invalidated(self):
        registry = {
            'next': 3,
            'items': {'mcq:1': 1, 'job:2': 2},
        }
        with patch('core.services.ensure_seo_indexes', return_value=registry) as build:
            self.assertEqual(seo_index_snapshot(), {'next': 3, 'items': {'mcq:1': 1}})
            self.assertEqual(seo_index_number('mcq', '1'), 1)
            # Keep legacy IDs reserved for token stability, even though the
            # public snapshot intentionally hides the retired Job taxonomy.
            self.assertEqual(seo_index_number('job', '2'), 2)
            self.assertEqual(build.call_count, 1)

            invalidate_mcqcampus_cache('seo-index')
            self.assertEqual(seo_index_snapshot()['next'], 3)
            self.assertEqual(build.call_count, 2)

    def test_content_mutations_invalidate_the_seo_index_group(self):
        actions = [
            'form:mcq', 'form:review', 'form:entity', 'form:post',
            'form:pdf', 'form:latest-job', 'action:trash-restore',
            'action:latest-job-toggle', 'action:post-delete',
        ]
        for action in actions:
            with self.subTest(action=action):
                with patch('core.views.invalidate_mcqcampus_cache') as invalidate:
                    _invalidate_caches_after_command(action)
                    self.assertIsNotNone(invalidate.call_args)
                    self.assertIn('seo-index', invalidate.call_args.args)
