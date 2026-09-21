from django.core.management.base import BaseCommand
from django.db import connection
from core.models import JobOpportunity


class Command(BaseCommand):
    help = 'Create the additive JobOpportunity tables when they do not exist. Existing tables/data are never reset.'

    def handle(self, *args, **options):
        table = JobOpportunity._meta.db_table
        existing = set(connection.introspection.table_names())
        if table in existing:
            self.stdout.write(self.style.SUCCESS('Job opportunity schema already exists.'))
            return
        with connection.schema_editor() as editor:
            editor.create_model(JobOpportunity)
        self.stdout.write(self.style.SUCCESS('Job opportunity schema created without modifying existing MCQ Campus tables.'))
