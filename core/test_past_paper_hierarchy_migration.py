import sqlite3
import tempfile
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from .models import Category, Job, JobYear, MCQ, Paper
from .serializers import _important_mcq
from .services import _attach_important_flags


class PastPaperHierarchyMigrationCommandTests(TestCase):
    def setUp(self):
        self.paper = Paper.objects.create(id=950, name='Example Board', country='Pakistan')
        self.job = Job.objects.create(id=951, name='Assistant', paper=self.paper)
        self.year = JobYear.objects.create(id=952, name='Assistant [04 Aug 2019]', job=self.job)
        self.duplicate_one = JobYear.objects.create(id=953, name='Hint 2022', job=self.job)
        self.duplicate_two = JobYear.objects.create(id=954, name='Held on 4 May 2022', job=self.job)
        self.bare_year = JobYear.objects.create(id=955, name='2020', job=self.job)
        self.category = Category.objects.create(id=956, name='General Knowledge')
        self.mcq = MCQ.objects.create(
            id=957,
            question='Which number follows 1?',
            option1='1',
            option2='2',
            option3='3',
            option4='4',
            correct_answer='2',
            description='The next integer after 1 is 2.',
            category=self.category,
            paper_ids=[self.paper.id],
            job_ids=[self.job.id],
            job_year_ids=[self.year.id],
            country='Pakistan',
            status='approved',
        )

    def test_legacy_job_ids_do_not_mark_an_mcq_important(self):
        self.mcq.job_ids = [self.job.id, 958]
        self.mcq.save(update_fields=['job_ids'])
        self.assertFalse(_important_mcq(self.mcq))
        _attach_important_flags([self.mcq])
        self.assertFalse(self.mcq._important_value)

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
        self.assertTrue(Job.objects.filter(pk=self.job.id).exists())

    def test_apply_takes_verified_full_backup_and_converts_hierarchy_without_editing_mcq_content(self):
        with tempfile.TemporaryDirectory() as directory:
            backup_file = Path(directory) / 'before-hierarchy.sqlite3'
            output = StringIO()
            call_command(
                'migrate_past_paper_hierarchy',
                apply=True,
                backup_file=str(backup_file),
                stdout=output,
            )

            self.assertTrue(backup_file.exists())
            self.assertGreater(backup_file.stat().st_size, 0)
            self.assertIn('Verified full database backup created', output.getvalue())
            with sqlite3.connect(str(backup_file)) as backup:
                old_job_count = backup.execute(
                    f'SELECT COUNT(*) FROM "{Job._meta.db_table}"'
                ).fetchone()[0]
                old_mcq_count = backup.execute(
                    f'SELECT COUNT(*) FROM "{MCQ._meta.db_table}"'
                ).fetchone()[0]
            self.assertEqual(old_job_count, 1)
            self.assertEqual(old_mcq_count, 1)

        self.assertEqual(Job.objects.count(), 0)
        for year in (self.year, self.duplicate_one, self.duplicate_two, self.bare_year):
            year.refresh_from_db()
            self.assertEqual(year.paper_id, self.paper.id)
            self.assertIsNone(year.job_id)

        self.year.refresh_from_db()
        self.duplicate_one.refresh_from_db()
        self.duplicate_two.refresh_from_db()
        self.bare_year.refresh_from_db()
        self.assertEqual(self.year.name, 'Past Paper 2019')
        self.assertEqual(self.duplicate_one.name, 'Past Paper 1 2022')
        self.assertEqual(self.duplicate_two.name, 'Past Paper 2 2022')
        self.assertEqual(self.bare_year.name, '2020')

        self.mcq.refresh_from_db()
        self.assertEqual(self.mcq.question, 'Which number follows 1?')
        self.assertEqual(self.mcq.option1, '1')
        self.assertEqual(self.mcq.option2, '2')
        self.assertEqual(self.mcq.option3, '3')
        self.assertEqual(self.mcq.option4, '4')
        self.assertEqual(self.mcq.correct_answer, '2')
        self.assertEqual(self.mcq.description, 'The next integer after 1 is 2.')
        self.assertEqual(self.mcq.paper_ids, [self.paper.id])
        self.assertEqual(self.mcq.job_ids, [self.job.id])
        self.assertEqual(self.mcq.job_year_ids, [self.year.id])
