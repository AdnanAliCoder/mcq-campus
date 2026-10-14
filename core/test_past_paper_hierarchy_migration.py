from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from .models import Job, JobYear, Paper


class PastPaperHierarchyMigrationCommandTests(TestCase):
    def setUp(self):
        self.paper = Paper.objects.create(id=950, name='Example Board', country='Pakistan')
        self.job = Job.objects.create(id=951, name='Assistant', paper=self.paper)
        self.year = JobYear.objects.create(id=952, name='Assistant [04 Aug 2019]', job=self.job)

    def test_default_run_is_a_dry_run_and_preserves_rows(self):
        output = StringIO()
        call_command('migrate_past_paper_hierarchy', stdout=output)
        self.year.refresh_from_db()
        self.job.refresh_from_db()
        self.assertEqual(self.year.name, 'Assistant [04 Aug 2019]')
        self.assertEqual(self.year.job_id, self.job.id)
        self.assertIsNone(self.year.paper_id)
        self.assertIn('DRY RUN only', output.getvalue())
        self.assertIn('Past Paper 2019', output.getvalue())
