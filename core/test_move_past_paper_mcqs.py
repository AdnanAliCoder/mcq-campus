import json
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from .models import Category, MCQ, Paper, Job, JobYear, profile_for


@override_settings(SECURE_SSL_REDIRECT=False)
class MovePastPaperMCQsTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser('owner', 'owner@example.com', 'OwnerPass123')
        profile = profile_for(self.owner)
        profile.role = 'super-admin'
        profile.save()
        self.category = Category.objects.create(id=901, name='General Knowledge')
        self.source_paper = Paper.objects.create(id=902, name='Board A', country='Pakistan')
        self.destination_paper = Paper.objects.create(id=903, name='Board B', country='Pakistan')
        self.source_job = Job.objects.create(id=904, name='Source group', paper=self.source_paper)
        self.destination_job = Job.objects.create(id=905, name='Destination group', paper=self.destination_paper)
        self.source_year = JobYear.objects.create(id=906, name='Past Paper 2022', job=self.source_job)
        self.destination_year = JobYear.objects.create(id=907, name='Past Paper 2023', job=self.destination_job)
        self.mcq = MCQ.objects.create(
            id=908, question='What is 2 + 2?', option1='3', option2='4',
            option3='5', option4='6', correct_answer='4', description='Basic arithmetic',
            category=self.category, paper_ids=[self.source_paper.id],
            job_ids=[self.source_job.id], job_year_ids=[self.source_year.id],
            country='Pakistan', status='approved'
        )

    def test_super_admin_moves_mcq_and_preserves_question_content(self):
        self.client.force_login(self.owner)
        response = self.client.post(
            '/api/admin/mcqs/move-past-paper',
            data=json.dumps({
                'source_year_id': self.source_year.id,
                'destination_year_id': self.destination_year.id,
                'mcq_ids': [self.mcq.id],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200, response.content.decode())
        self.mcq.refresh_from_db()
        self.assertEqual(self.mcq.job_year_ids, [self.destination_year.id])
        self.assertEqual(self.mcq.job_ids, [self.destination_job.id])
        self.assertEqual(self.mcq.paper_ids, [self.destination_paper.id])
        self.assertEqual(self.mcq.question, 'What is 2 + 2?')
        self.assertEqual(self.mcq.correct_answer, '4')
        self.assertEqual(self.mcq.description, 'Basic arithmetic')
        self.assertEqual(self.mcq.audit_history[-1]['action'], 'move_past_paper')

    def test_non_super_admin_cannot_move_mcqs(self):
        learner = User.objects.create_user('learner', 'learner@example.com', 'LearnerPass123')
        self.client.force_login(learner)
        response = self.client.post(
            '/api/admin/mcqs/move-past-paper',
            data=json.dumps({
                'source_year_id': self.source_year.id,
                'destination_year_id': self.destination_year.id,
                'mcq_ids': [self.mcq.id],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)
        self.mcq.refresh_from_db()
        self.assertEqual(self.mcq.job_year_ids, [self.source_year.id])

    def test_move_rejects_cross_country_destination(self):
        self.destination_paper.country = 'India'
        self.destination_paper.save(update_fields=['country'])
        self.client.force_login(self.owner)
        response = self.client.post(
            '/api/admin/mcqs/move-past-paper',
            data=json.dumps({
                'source_year_id': self.source_year.id,
                'destination_year_id': self.destination_year.id,
                'mcq_ids': [self.mcq.id],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 422)
        self.mcq.refresh_from_db()
        self.assertEqual(self.mcq.job_year_ids, [self.source_year.id])
