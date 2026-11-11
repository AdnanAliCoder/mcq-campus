from datetime import timedelta

from django.contrib.auth.models import AnonymousUser, User
from django.test import TestCase, override_settings
from django.utils import timezone

from .models import Category, JobYear, MCQ, Paper, Profile, Subscription, SubscriptionConfig
from .services import mcq_levels_data, mcq_page
from .subscriptions import normalized_free_access


@override_settings(SECURE_SSL_REDIRECT=False)
class McqLevelAccessTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(id=501, name="General Knowledge")
        self.second_category = Category.objects.create(id=502, name="Computer Science")
        self.paper = Paper.objects.create(id=601, name="PPSC")
        self.year = JobYear.objects.create(id=701, name="2025", paper=self.paper)
        self.learner = User.objects.create_user(
            username="free-levels@example.com",
            email="free-levels@example.com",
            password="LearnerPass123",
        )
        Profile.objects.create(user=self.learner, role="user", country="Pakistan")
        self.config = SubscriptionConfig.get_solo()
        self.config.free_access = {
            "regular_levels": 10,
            "important_levels": 5,
            "category_levels": 1,
            "free_past_paper_ids": [],
            "free_pdf_ids": [],
        }
        self.config.updated_by = self.learner
        self.config.save(update_fields=["free_access", "updated_by"])

    def make_mcqs(self, start, count, category, important=False, year_ids=None):
        MCQ.objects.bulk_create([
            MCQ(
                id=ident,
                question=f"Question {ident}?",
                option1="A",
                option2="B",
                option3="C",
                option4="D",
                correct_answer="A",
                category=category,
                status="approved",
                important=important,
                job_year_ids=list(year_ids or []),
                country="Pakistan",
            )
            for ident in range(start, start + count)
        ])

    def test_free_plan_defaults_match_the_requested_allowances(self):
        self.assertEqual(
            normalized_free_access(self.config),
            {
                "regular_levels": 10,
                "important_levels": 5,
                "category_levels": 1,
                "free_past_paper_ids": [],
                "free_pdf_ids": [],
            },
        )

    def test_regular_level_eleven_cannot_be_filled_by_free_category_questions(self):
        self.make_mcqs(1, 1001, self.category)
        self.make_mcqs(1002, 100, self.second_category)

        # The first level of each category is free, but that must not shift
        # those extra questions into a paid Regular MCQ level.
        response = mcq_page(
            self.learner,
            page=1,
            page_size=100,
            filters={
                "public": "1",
                "country": "Pakistan",
                "track": "regular",
                "level": "11",
            },
        )
        self.assertEqual(response["items"], [])
        self.assertTrue(response["premium_required"])

        free_level = mcq_page(
            self.learner,
            page=1,
            page_size=100,
            filters={
                "public": "1",
                "country": "Pakistan",
                "track": "regular",
                "level": "10",
            },
        )
        self.assertEqual(len(free_level["items"]), 100)
        self.assertFalse(free_level["premium_required"])
        self.assertEqual(
            [row["id"] for row in free_level["items"]],
            list(range(901, 1001)),
        )

    def test_category_first_level_is_free_and_second_level_is_premium(self):
        self.make_mcqs(2001, 101, self.category)
        data = mcq_levels_data(
            AnonymousUser(),
            country="Pakistan",
            category_id=self.category.id,
        )
        levels = data["category"]["levels"]
        self.assertEqual(len(levels), 2)
        self.assertFalse(levels[0]["premium"])
        self.assertTrue(levels[1]["premium"])

    def test_past_paper_levels_are_premium_and_direct_api_is_blocked(self):
        self.make_mcqs(3001, 2, self.category, year_ids=[self.year.id])

        data = mcq_levels_data(
            AnonymousUser(),
            country="Pakistan",
            year_id=self.year.id,
        )
        levels = data["past_paper"]["levels"]
        self.assertEqual(len(levels), 1)
        self.assertTrue(levels[0]["premium"])

        blocked = mcq_page(
            AnonymousUser(),
            page=1,
            page_size=10,
            filters={"public": "1", "year": str(self.year.id)},
        )
        self.assertEqual(blocked["items"], [])
        self.assertTrue(blocked["premium_required"])

    def test_paid_subscriber_can_access_past_paper_mcqs(self):
        self.make_mcqs(4001, 2, self.category, year_ids=[self.year.id])
        paid = User.objects.create_user(
            username="paid-levels@example.com",
            email="paid-levels@example.com",
            password="LearnerPass123",
        )
        Profile.objects.create(user=paid, role="user", country="Pakistan")
        now = timezone.now()
        Subscription.objects.create(
            user=paid,
            plan="monthly",
            starts_at=now,
            ends_at=now + timedelta(days=30),
            is_active=True,
        )

        response = mcq_page(
            paid,
            page=1,
            page_size=10,
            filters={
                "public": "1",
                "country": "Pakistan",
                "year": str(self.year.id),
                "track": "past-paper",
                "level": "1",
            },
        )
        self.assertEqual(len(response["items"]), 2)
        self.assertFalse(response["premium_required"])
