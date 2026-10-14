import os
import re
import shutil
import sqlite3
import subprocess
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from core.models import Job, JobYear, MCQ, Paper


YEAR_PATTERN = re.compile(r'(?<!\\d)((?:19|20|21)\\d{2})(?!\\d)')


def _year_from_name(raw_name):
    match = YEAR_PATTERN.search(str(raw_name or ''))
    return match.group(1) if match else ''


def normalized_past_paper_name(raw_name, ordinal=1, group_size=1):
    """Normalize historic date/hint labels without changing the source MCQ content."""
    value = str(raw_name or '').strip()
    year = _year_from_name(value)
    if not year:
        base = 'Past Paper'
        return base if group_size <= 1 else f'Past Paper {ordinal}'

    # A bare year is already a clean, useful label; preserve it when unique.
    is_bare_year = bool(re.fullmatch(r'\\s*(?:19|20|21)\\d{2}\\s*', value))
    if group_size > 1:
        # Number every member of a duplicate-year group, including the first.
        return f'Past Paper {ordinal} {year}'
    if is_bare_year:
        return year
    return f'Past Paper {year}'


class Command(BaseCommand):
    help = (
        'Safely convert Paper > Job > Job Year to Organization/Board > Past Paper. '
        'Runs as a dry-run unless --apply is supplied. --apply creates a verified database backup first.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Apply changes only after a verified database backup.')
        parser.add_argument('--skip-name-normalization', action='store_true', help='Keep existing Past Paper names.')
        parser.add_argument('--backup-file', help='Backup destination. Defaults to backups/past-paper-hierarchy-before-<timestamp>.dump.')

    def _columns(self, table_name):
        with connection.cursor() as cursor:
            return {col.name for col in connection.introspection.get_table_description(cursor, table_name)}

    def _default_backup_path(self):
        base_dir = Path(getattr(settings, 'BASE_DIR', Path.cwd()))
        stamp = timezone.now().strftime('%Y%m%d-%H%M%S')
        return base_dir / 'backups' / f'past-paper-hierarchy-before-{stamp}.dump'

    def _backup_database(self, supplied_path=None):
        """Create and validate a complete database backup before destructive changes."""
        target = Path(supplied_path).expanduser() if supplied_path else self._default_backup_path()
        target = target.resolve()
        if target.exists():
            raise CommandError(f'Backup file already exists; refusing to overwrite it: {target}')
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            os.chmod(target.parent, 0o700)
        except OSError as exc:
            raise CommandError(f'Cannot prepare backup directory {target.parent}: {exc}') from exc

        engine = str(connection.settings_dict.get('ENGINE') or '')
        try:
            if 'postgresql' in engine:
                pg_dump = shutil.which('pg_dump')
                if not pg_dump:
                    raise CommandError('pg_dump is required for PostgreSQL. Install PostgreSQL client tools before applying this migration.')
                cfg = connection.settings_dict
                env = os.environ.copy()
                if cfg.get('PASSWORD'):
                    env['PGPASSWORD'] = str(cfg['PASSWORD'])
                options = cfg.get('OPTIONS') or {}
                for option in ('sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'connect_timeout', 'application_name'):
                    if options.get(option) is not None:
                        env['PG' + option.upper()] = str(options[option])
                command = [pg_dump, '--format=custom', '--no-owner', '--no-privileges', '--file', str(target)]
                for flag, key in (('--host', 'HOST'), ('--port', 'PORT'), ('--username', 'USER')):
                    if cfg.get(key):
                        command.extend([flag, str(cfg[key])])
                command.append(str(cfg.get('NAME') or ''))
                result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=600, check=False)
                if result.returncode != 0:
                    raise CommandError('pg_dump failed; no migration changes were applied. ' + (result.stderr or '').strip()[:600])
                with target.open('rb') as backup_stream:
                    if backup_stream.read(5) != b'PGDMP':
                        raise CommandError('The PostgreSQL backup did not pass its format check; no migration changes were applied.')
                pg_restore = shutil.which('pg_restore')
                if pg_restore:
                    check = subprocess.run([pg_restore, '--list', str(target)], capture_output=True, text=True, timeout=120, check=False)
                    if check.returncode != 0 or not (check.stdout or '').strip():
                        raise CommandError('PostgreSQL backup validation failed; no migration changes were applied.')
            elif 'sqlite3' in engine:
                connection.ensure_connection()
                target_db = sqlite3.connect(str(target))
                try:
                    connection.connection.backup(target_db)
                    target_db.commit()
                    check = target_db.execute('PRAGMA integrity_check').fetchone()
                    if not check or check[0] != 'ok':
                        raise CommandError('SQLite backup integrity check failed; no migration changes were applied.')
                finally:
                    target_db.close()
            else:
                raise CommandError(f'Automatic full backup is not implemented for database engine {engine!r}; no migration changes were applied.')
            if not target.exists() or target.stat().st_size <= 0:
                raise CommandError('Backup file is missing or empty; no migration changes were applied.')
            os.chmod(target, 0o600)
        except (OSError, subprocess.SubprocessError, sqlite3.Error) as exc:
            try:
                if target.exists():
                    target.unlink()
            except OSError:
                pass
            raise CommandError(f'Could not create a verified database backup at {target}: {exc}') from exc
        except CommandError:
            try:
                if target.exists() and target.stat().st_size == 0:
                    target.unlink()
            except OSError:
                pass
            raise
        self.stdout.write(self.style.SUCCESS(f'Verified full database backup created: {target} ({target.stat().st_size:,} bytes)'))
        return target

    def _ensure_schema(self):
        table = JobYear._meta.db_table
        columns = self._columns(table)
        paper_field = JobYear._meta.get_field('paper')
        job_field = JobYear._meta.get_field('job')
        with connection.schema_editor() as editor:
            if paper_field.column not in columns:
                editor.add_field(JobYear, paper_field)
                self.stdout.write(self.style.SUCCESS('Added nullable JobYear.paper_id column.'))
                columns = self._columns(table)
            if job_field.column in columns:
                old_job_field = job_field.clone()
                old_job_field.null = False
                if job_field.null:
                    editor.alter_field(JobYear, old_job_field, job_field, strict=False)
                    self.stdout.write(self.style.SUCCESS('Made legacy JobYear.job_id column nullable.'))

    def handle(self, *args, **options):
        apply_changes = bool(options['apply'])
        skip_names = bool(options['skip_name_normalization'])
        year_table = JobYear._meta.db_table
        job_table = Job._meta.db_table
        tables = set(connection.introspection.table_names())
        if year_table not in tables:
            raise CommandError(f'Missing required table {year_table}. Run the normal Django database setup first.')
        if job_table not in tables:
            raise CommandError(f'Missing required table {job_table}; refusing to infer or delete records.')
        jobs = {int(row['id']): int(row['paper_id']) for row in Job.objects.values('id', 'paper_id')}
        year_columns = self._columns(year_table)
        if JobYear._meta.get_field('paper').column in year_columns:
            years = list(JobYear.objects.values('id', 'name', 'job_id', 'paper_id').order_by('id'))
        else:
            years = [{**row, 'paper_id': None} for row in JobYear.objects.values('id', 'name', 'job_id').order_by('id')]
        unresolved = [
            int(row['id']) for row in years
            if not row.get('paper_id') and (not row.get('job_id') or int(row['job_id']) not in jobs)
        ]
        if unresolved:
            raise CommandError(
                'Some past-paper records have no valid organization through their legacy Job. '
                f'No records were changed. First IDs: {unresolved[:20]}'
            )
        paper_ids = {
            int(row['paper_id']) if row.get('paper_id') else jobs[int(row['job_id'])]
            for row in years
        }
        existing_papers = set(Paper.objects.values_list('id', flat=True))
        missing_papers = sorted(paper_ids - existing_papers)
        if missing_papers:
            raise CommandError(f'Legacy records reference missing organizations: {missing_papers[:20]}')

        group_counts = Counter()
        for row in years:
            paper_id = int(row['paper_id']) if row.get('paper_id') else jobs[int(row['job_id'])]
            year_value = _year_from_name(row['name'])
            group_counts[(paper_id, year_value or 'no-year')] += 1
        ordinals = defaultdict(int)
        normalized = {}
        preview = []
        for row in years:
            paper_id = int(row['paper_id']) if row.get('paper_id') else jobs[int(row['job_id'])]
            year_value = _year_from_name(row['name'])
            key = (paper_id, year_value or 'no-year')
            ordinals[key] += 1
            new_name = str(row['name'] or '').strip() or 'Past Paper' if skip_names else normalized_past_paper_name(
                row['name'], ordinals[key], group_counts[key]
            )
            normalized[int(row['id'])] = new_name
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
            self.stdout.write('After reviewing this output, rerun with --apply to create a verified full backup and perform the conversion.')
            return

        # Backup is a hard precondition: do not alter schema or delete any Job rows unless it passes.
        self._backup_database(options.get('backup_file'))
        with transaction.atomic():
            self._ensure_schema()
            rows = list(JobYear.objects.select_related('job', 'paper').order_by('id'))
            for year in rows:
                if year.paper_id is None:
                    year.paper_id = jobs.get(int(year.job_id or 0))
                if not year.paper_id:
                    raise CommandError(f'Past Paper #{year.id} has no Organization/Board. Transaction aborted.')
                if not skip_names:
                    year.name = normalized.get(int(year.id), 'Past Paper')
                year.job = None
                year.save(update_fields=['paper', 'job', 'name', 'updated_at'])
            deleted, _ = Job.objects.all().delete()

            # The MCQ content rows are intentionally read-only during this hierarchy conversion.
            mcq_count = MCQ.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f'Converted {len(years)} Past Paper record(s), retained {mcq_count:,} MCQ row(s) unchanged, '
            f'and removed {len(jobs)} legacy Job row(s) ({deleted} database objects deleted).'
        ))
        self.stdout.write('MCQ question, option, correct-answer, explanation, and ID fields were not modified.')
