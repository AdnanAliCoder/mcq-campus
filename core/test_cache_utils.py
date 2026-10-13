from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from .cache_utils import cached_value, invalidate_mcqcampus_cache


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
