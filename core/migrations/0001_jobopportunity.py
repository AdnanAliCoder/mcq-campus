from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = False
    dependencies = [
        ('core', '__first__'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='JobOpportunity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField()),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('title', models.CharField(max_length=255)),
                ('slug', models.SlugField(max_length=140, unique=True)),
                ('organization', models.CharField(max_length=255)),
                ('category', models.CharField(blank=True, max_length=120)),
                ('advertisement_number', models.CharField(blank=True, max_length=120)),
                ('total_vacancies', models.PositiveIntegerField(blank=True, null=True)),
                ('location', models.CharField(blank=True, max_length=255)),
                ('qualification', models.TextField(blank=True)),
                ('experience_requirement', models.TextField(blank=True)),
                ('age_limit', models.CharField(blank=True, max_length=160)),
                ('gender', models.CharField(blank=True, max_length=120)),
                ('domicile', models.CharField(blank=True, max_length=200)),
                ('employment_type', models.CharField(blank=True, max_length=120)),
                ('advertisement_date', models.DateField(blank=True, null=True)),
                ('last_date', models.DateField(blank=True, null=True)),
                ('advertisement_url', models.URLField(blank=True)),
                ('apply_url', models.URLField(blank=True)),
                ('recruiting_authority', models.CharField(blank=True, max_length=200)),
                ('syllabus', models.TextField(blank=True)),
                ('eligibility_details', models.TextField(blank=True)),
                ('important_instructions', models.TextField(blank=True)),
                ('published', models.BooleanField(default=False)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_jobopportunitys', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_jobopportunitys', to=settings.AUTH_USER_MODEL)),
                ('related_categories', models.ManyToManyField(blank=True, related_name='job_opportunities', to='core.category')),
                ('related_guides', models.ManyToManyField(blank=True, related_name='job_opportunities', to='core.guide')),
                ('related_mcqs', models.ManyToManyField(blank=True, related_name='job_opportunities', to='core.mcq')),
                ('related_papers', models.ManyToManyField(blank=True, related_name='job_opportunities', to='core.paper')),
                ('related_posts', models.ManyToManyField(blank=True, related_name='job_opportunities', to='core.post')),
            ],
        ),
    ]
