import copy
import re
from collections import defaultdict

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from core.models import Job, JobYear, Paper


def normalized_past_paper_name(raw_name, ordinal):
    """Convert historic date/hint labels to a stable year-first display label."""
    value = str(raw_name or '').strip()
    match = re.search(r'(?<!\d)((?:19|20|21)\d{2})(?!\d)', value)
    year = match.group(1) if match else ''
    if year:
        base = f'Past Paper {year}'
        return base if ordinal == 1 else f'Past Paper {ordinal} {year}'
    base = 'Past Paper'
    return base if ordinal == 1 else f'Past Paper {ordinal}'


class Command(BaseCommand):
    help = (
        'Safely convert Paper > Job > Job Year to Organization/Board > Past Paper. '
        'Runs as a dry-run unless --apply is supplied.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Apply schema/data changes and delete legacy Job rows.')
        parser.add_argument('--skip-name-normalization', action='store_true', help='Keep existing Past Paper names.')
    
    def _columns(self, table_name):
        with connection.cursor() as cursor:
            return {col.name for col in connection.introspection.get_table_description(cursor, table_name)}

    def _ensure_schema(self):
        model = JobYear
        table = model._meta.db_table
        columns = self._columns(table)
        paper_field = model._meta.get_field('paper')
        job_field = model._meta.get_field('job')
        with connection.schema_editor() as editor:
            if paper_field.column not in columns:
                editor.add_field(model, paper_field)
                self.stdout.write(self.style.SUCCESS('Added nullable JobYear.paper_id column.'))
                columns = self._columns(table)
            if job_field.column in columns:
                # Historical databases created this FK as NOT NULL. Make it nullable so
                # the organization link can replace it before legacy Jobs are removed.
                old_job_field = job_field.clone()
                old_job_field.null = False
                if job_field.null:
                    editor.alter_field(model, old_job_field, job_field, strict=False)
                    self.stdout.write(self.style.SUCCESS('Made legacy JobYear.job_id nullable.'))

    def handle(self, *args, **options):
        apply_changes = bool(options['apply'])
        skip_names = bool(options['skip_name_normalization'])
        year_table = JobYear._meta.db_table
        job_table = Job._meta.db_table
        if year_table not in connection.introspection.table_names():
            raise CommandError(f'Missing required table {year_table}. Run the normal Django database setup first.')
        if job_table not in connection.introspection.table_names():
            raise CommandError(f'Missing required table {job_table}; refusing to infer or delete records.')
        jobs = {int(row['id']): int(row['paper_id']) for row in Job.objects.values('id', 'paper_id')}
        years = list(JobYear.objects.values('id', 'name', 'job_id').order_by('id'))
        unresolved = [int(row['id']) for row in years if not row.get('job_id') or int(row['job_id']) not in jobs]
        if unresolved:
            raise CommandError(
                'Some past-paper records have no valid organization through their legacy Job. '
                f'No records were changed. First IDs: {unresolved[:20]}'
            )
        paper_ids = {jobs[int(row['job_id'])] for row in years}
        missing_papers = sorted(set(paper_ids) - set(Paper.objects.values_list('id', flat=True)))
        if missing_papers:
            raise CommandError(f'Legacy records reference missing organizations: {missing_papers[:20]}')

        # Preview normalizations without touching schema/data.
        ordinals = defaultdict(int)
        preview = []
        for row in years:
            paper_id = jobs[int(row['job_id'])]
            if skip_names:
                new_name = str(row['name'] or '').strip() or 'Past Paper'
            else:
                raw = str(row['name'] or '')
                match = re.search(r'(?<!\d)((?:19|20|21)\d{2})(?!\d)', raw)
                key = (paper_id, match.group(1) if match else 'no-year')
                ordinals[key] += 1
                new_name = normalized_past_paper_name(raw, ordinals[key])
            if len(preview) < 30 and new_name != row['name']:
                preview.append((row['id'], row['name'], new_name))

        self.stdout.write(f'Organizations/Boards: {Paper.objects.count()}')
        self.stdout.write(f'Past Paper records to retain: {len(years)}')
        self.stdout.write(f'Legacy Job records to remove: {len(jobs)}')
        self.stdout.write('Sample name changes:')
        for ident, old, new in preview:
            self.stdout.write(f'  #{ident}: {old!r} -> {new!r}')
        if not apply_changes:
            self.stdout.write(self.style.WARNING('DRY RUN only. No schema or database records were changed.'))
            self.stdout.write('After taking a verified PostgreSQL backup, run with --apply to perform the conversion.')
            return

        with transaction.atomic():
            self._ensure_schema()
            # Refresh with the newly-added field after the schema is prepared.
            ordinals = defaultdict(int)
            rows = list(JobYear.objects.select_related('job', 'paper').order_by('id'))
            for year in rows:
                if year.paper_id is None:
                    year.paper_id = jobs.get(int(year.job_id or 0))
                if not year.paper_id:
                    raise CommandError(f'Past Paper #{year.id} has no Organization/Board. Transaction aborted.')
                if not skip_names:
                    raw = str(year.name or '')
                    match = re.search(r'(?<!\d)((?:19|20|21)\d{2})(?!\d)', raw)
                    key = (int(year.paper_id), match.group(1) if match else 'no-year')
                    ordinals[key] += 1
                    year.name = normalized_past_paper_name(raw, ordinals[key])
                year.job = None
                year.save(update_fields=['paper', 'job', 'name', 'updated_at'])
            deleted, _ = Job.objects.all().delete()
        self.stdout.write(self.style.SUCCESS(
            f'Converted {len(years)} Past Paper record(s), kept their IDs, normalized names, '
            f'and removed {len(jobs)} legacy Job row(s) ({deleted} database objects deleted).'
        ))
        self.stdout.write('MCQ question/option/answer/explanation fields and MCQ IDs were not modified.')
