from django.core.management.base import BaseCommand
from django.db import connection
from core.models import JobOpening


class Command(BaseCommand):
    help = 'Create the current-job opening tables if they do not already exist. Existing tables/data are untouched.'

    def handle(self, *args, **options):
        table = JobOpening._meta.db_table
        existing = set(connection.introspection.table_names())
        if table in existing:
            self.stdout.write(self.style.SUCCESS('Current Jobs schema already exists; no changes made.'))
            return
        with connection.schema_editor() as editor:
            editor.create_model(JobOpening)
        self.stdout.write(self.style.SUCCESS('Created Current Jobs schema without modifying existing MCQ Campus data.'))
