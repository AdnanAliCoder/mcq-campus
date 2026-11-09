import json
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone

from .models import (
    Subscription,
    SubscriptionConfig,
    SubscriptionPaymentProof,
    profile_for,
)


PNG_BYTES = b"\x89PNG\r\n\x1a\n" + (b"mcq-campus-test-image" * 2)


@override_settings(SECURE_SSL_REDIRECT=False)
class SubscriptionPaymentTests(TestCase):
    def setUp(self):
        self.learner = User.objects.create_user(
            username="learner@example.com",
            email="learner@example.com",
            password="LearnerPass123",
            first_name="Learner",
        )
        self.super_admin = User.objects.create_superuser(
            username="owner@example.com",
            email="owner@example.com",
            password="OwnerPass123",
            first_name="Owner",
        )
        learner_profile = profile_for(self.learner)
        learner_profile.role = "user"
        learner_profile.email_verified = True
        learner_profile.save(update_fields=["role", "email_verified"])
        admin_profile = profile_for(self.super_admin)
        admin_profile.role = "super-admin"
        admin_profile.email_verified = True
        admin_profile.save(update_fields=["role", "email_verified"])
        self.config = SubscriptionConfig.get_solo()

    def payment_file(self, name="receipt.png", content=None, content_type="image/png"):
        return SimpleUploadedFile(
            name,
            PNG_BYTES if content is None else content,
            content_type=content_type,
        )

    def submit_payment(self, transaction_id="RR-TEST-0001", amount=299, user=None, content=None):
        account = user or self.learner
        self.client.force_login(account)
        return self.client.post(
            "/api/subscription/payment-proof",
            {
                "plan": "monthly",
                "amount": str(amount),
                "name": account.get_full_name() or "Test Learner",
                "email": account.email,
                "transaction_id": transaction_id,
                "screenshot": self.payment_file(content=content),
            },
        )

    def post_json(self, path, payload):
        return self.client.post(
            path,
            data=json.dumps(payload),
            content_type="application/json",
        )

    def test_payment_proof_stays_pending_until_super_admin_approves(self):
        response = self.submit_payment()
        self.assertEqual(response.status_code, 201)
        proof = SubscriptionPaymentProof.objects.get(transaction_id="RR-TEST-0001")
        self.assertEqual(proof.status, "pending")
        self.assertEqual(proof.amount, 299)
        self.assertFalse(Subscription.objects.filter(user=self.learner).exists())

    def test_payment_amount_must_match_server_plan_price(self):
        response = self.submit_payment(amount=1)
        self.assertEqual(response.status_code, 422)
        self.assertFalse(SubscriptionPaymentProof.objects.exists())

    def test_payment_upload_checks_file_signature_and_size(self):
        invalid_signature = self.submit_payment(
            transaction_id="RR-INVALID-FILE",
            content=b"not really a PNG file",
        )
        self.assertEqual(invalid_signature.status_code, 422)

        too_large = self.submit_payment(
            transaction_id="RR-TOO-LARGE",
            content=PNG_BYTES + (b"x" * (5 * 1024 * 1024)),
        )
        self.assertEqual(too_large.status_code, 422)
        self.assertFalse(SubscriptionPaymentProof.objects.exists())

    def test_transaction_reference_cannot_be_submitted_twice(self):
        first = self.submit_payment(transaction_id="RR-DUPLICATE-1")
        self.assertEqual(first.status_code, 201)
        second = self.submit_payment(transaction_id="RR-DUPLICATE-1")
        self.assertEqual(second.status_code, 409)
        self.assertEqual(
            SubscriptionPaymentProof.objects.filter(transaction_id="RR-DUPLICATE-1").count(),
            1,
        )

    def test_only_super_admin_can_review_a_payment(self):
        self.submit_payment()
        response = self.post_json(
            "/api/admin/subscriptions/review",
            {"id": SubscriptionPaymentProof.objects.get().id, "status": "approved"},
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Subscription.objects.filter(user=self.learner).exists())

    def test_super_admin_approval_activates_the_paid_subscription(self):
        self.submit_payment()
        proof = SubscriptionPaymentProof.objects.get()
        self.client.force_login(self.super_admin)

        response = self.post_json(
            "/api/admin/subscriptions/review",
            {"id": proof.id, "status": "approved", "note": "Payment verified."},
        )
        self.assertEqual(response.status_code, 200)
        proof.refresh_from_db()
        subscription = Subscription.objects.get(user=self.learner)
        self.assertEqual(proof.status, "approved")
        self.assertEqual(proof.review_note, "Payment verified.")
        self.assertEqual(subscription.source_payment_id, proof.id)
        self.assertTrue(subscription.is_active)
        self.assertGreater(subscription.ends_at, timezone.now())
        self.assertEqual(subscription.ends_at - subscription.starts_at, timedelta(days=30))

    def test_rejected_proof_does_not_activate_access_or_allow_second_review(self):
        self.submit_payment()
        proof = SubscriptionPaymentProof.objects.get()
        self.client.force_login(self.super_admin)

        rejected = self.post_json(
            "/api/admin/subscriptions/review",
            {"id": proof.id, "status": "rejected", "note": "Could not verify."},
        )
        self.assertEqual(rejected.status_code, 200)
        proof.refresh_from_db()
        self.assertEqual(proof.status, "rejected")
        self.assertFalse(Subscription.objects.filter(user=self.learner).exists())

        second_review = self.post_json(
            "/api/admin/subscriptions/review",
            {"id": proof.id, "status": "approved"},
        )
        self.assertEqual(second_review.status_code, 409)
        self.assertFalse(Subscription.objects.filter(user=self.learner).exists())

    def test_payment_history_requires_login_and_is_scoped_to_current_user(self):
        own_response = self.submit_payment(transaction_id="RR-OWN-1")
        self.assertEqual(own_response.status_code, 201)

        another = User.objects.create_user(
            username="another@example.com",
            email="another@example.com",
            password="AnotherPass123",
            first_name="Another",
        )
        profile = profile_for(another)
        profile.role = "user"
        profile.email_verified = True
        profile.save(update_fields=["role", "email_verified"])
        other_response = self.submit_payment(
            transaction_id="RR-OTHER-1",
            user=another,
        )
        self.assertEqual(other_response.status_code, 201)

        self.client.force_login(self.learner)
        history = self.client.get("/api/subscription/payments")
        self.assertEqual(history.status_code, 200)
        payments = history.json()["payments"]
        self.assertEqual(len(payments), 1)
        self.assertEqual(payments[0]["transaction_id"], "RR-OWN-1")
        self.assertEqual(payments[0]["status"], "pending")
        self.assertNotIn("screenshot_url", payments[0])
        self.assertNotIn("username", payments[0])
        self.assertEqual(history["Cache-Control"], "private, no-store, max-age=0")

        self.client.logout()
        anonymous = self.client.get("/api/subscription/payments")
        self.assertEqual(anonymous.status_code, 401)
