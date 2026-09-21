from django.core.management.base import BaseCommand
from django.db import connection
from core.models import JobOpening


class Command(BaseCommand):
    help = 'Create missing current-job opening tables. Existing tables and data are untouched.'

    def handle(self, *args, **options):
        existing = set(connection.introspection.table_names())
        main_table = JobOpening._meta.db_table
        through_models = [field.remote_field.through for field in JobOpening._meta.local_many_to_many]
        through_tables = {model._meta.db_table for model in through_models}
        missing_through = [model for model in through_models if model._meta.db_table not in existing]

        if main_table in existing and not missing_through:
            self.stdout.write(self.style.SUCCESS('Current Jobs schema already exists; no changes made.'))
            return

        with connection.schema_editor() as editor:
            if main_table not in existing:
                # Django also creates the auto-generated many-to-many relationship tables.
                editor.create_model(JobOpening)
            else:
                # Recover safely from a partial schema rollout without recreating the main table.
                for model in missing_through:
                    editor.create_model(model)

        created = [main_table] if main_table not in existing else []
        if main_table not in existing:
            created.extend(sorted(through_tables))
        else:
            created.extend(model._meta.db_table for model in missing_through)
        self.stdout.write(self.style.SUCCESS('Created missing Current Jobs schema: ' + ', '.join(created)))
