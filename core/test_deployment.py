"""Deployment regression tests. Uses Django's disposable test database."""
import io
import os
import subprocess
import sys
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import OperationalError
from django.test import SimpleTestCase, TestCase, override_settings

from core.models import Profile, SiteSetting, profile_for


@override_settings(SECURE_SSL_REDIRECT=False)
class ReadinessTests(TestCase):
    def test_probe_does_not_write_database_or_require_login(self):
        self.assertEqual(SiteSetting.objects.count(), 0)
        response = self.client.get('/healthz')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response['X-Robots-Tag'], 'noindex')
        self.assertEqual(SiteSetting.objects.count(), 0)
        self.assertEqual(self.client.head('/healthz').status_code, 200)
        self.assertEqual(self.client.post('/healthz').status_code, 405)

    def test_probe_returns_503_without_database_details(self):
        with patch('core.health.connection.cursor', side_effect=OperationalError('private database detail')):
            response = self.client.get('/healthz')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {'status': 'unavailable'})
        self.assertNotIn(b'private database detail', response.content)

    @override_settings(SECURE_SSL_REDIRECT=True)
    def test_render_https_proxy_does_not_redirect_loop(self):
        response = self.client.get('/healthz', HTTP_X_FORWARDED_PROTO='https')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get('/healthz').status_code, 301)


@patch.dict(os.environ, {
    'SUPERADMIN_EMAIL': 'owner@example.test',
    'SUPERADMIN_PASSWORD': 'Test-initial-owner-729!',
    'SUPERADMIN_NAME': 'Initial Owner',
})
class OwnerBootstrapTests(TestCase):
    def run_command(self):
        call_command('ensure_superadmin', stdout=io.StringIO())

    def test_create_owner_and_preserve_changed_password_on_redeploy(self):
        self.run_command()
        user = User.objects.get(email='owner@example.test')
        self.assertTrue(user.is_superuser and user.is_staff and user.is_active)
        self.assertTrue(user.check_password('Test-initial-owner-729!'))
        self.assertEqual(profile_for(user).role, 'super-admin')
        user.set_password('Changed-by-owner-987!')
        user.first_name = 'Updated Owner'
        user.save()
        self.run_command()
        user.refresh_from_db()
        self.assertTrue(user.check_password('Changed-by-owner-987!'))
        self.assertEqual(user.first_name, 'Updated Owner')
        self.assertEqual(User.objects.count(), 1)

    def test_existing_learner_is_not_promoted(self):
        user = User.objects.create_user(username='learner', email='OWNER@example.test', password='Original-729!')
        with self.assertRaises(CommandError):
            self.run_command()
        user.refresh_from_db()
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password('Original-729!'))
        self.assertFalse(Profile.objects.filter(user=user).exists())

    def test_disabled_owner_is_not_reactivated(self):
        self.run_command()
        User.objects.update(is_active=False)
        with self.assertRaises(CommandError):
            self.run_command()
        self.assertFalse(User.objects.get().is_active)

    def test_missing_credentials_do_not_create_user(self):
        with patch.dict(os.environ, {'SUPERADMIN_PASSWORD': ''}):
            self.run_command()
        self.assertEqual(User.objects.count(), 0)

    def test_placeholder_password_is_rejected(self):
        with patch.dict(os.environ, {'SUPERADMIN_PASSWORD': 'change-this-before-deploy'}):
            with self.assertRaises(CommandError):
                self.run_command()
        self.assertEqual(User.objects.count(), 0)


class ProductionConfigurationTests(SimpleTestCase):
    def settings_process(self, **values):
        env = {key: value for key, value in os.environ.items() if key not in {
            'DEBUG', 'SECRET_KEY', 'DATABASE_URL', 'RENDER_EXTERNAL_HOSTNAME',
            'ALLOWED_HOSTS', 'CSRF_TRUSTED_ORIGINS',
        }}
        env.update(values)
        return subprocess.run([
            sys.executable, '-c',
            'from mcqcampus import settings as s; '
            'assert s.DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql"; '
            'assert s.DATABASES["default"]["OPTIONS"]["sslmode"] == "require"; '
            'assert "campus-test.onrender.com" in s.ALLOWED_HOSTS; '
            'assert "https://campus-test.onrender.com" in s.CSRF_TRUSTED_ORIGINS',
        ], env=env, capture_output=True, text=True, timeout=15)

    def test_production_rejects_missing_or_placeholder_secret(self):
        for secret in ('', 'change-me-to-a-long-random-secret'):
            with self.subTest(secret=secret):
                result = self.settings_process(DEBUG='false', SECRET_KEY=secret)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('ImproperlyConfigured', result.stderr)
                self.assertIn('SECRET_KEY', result.stderr)

    def test_production_cannot_fall_back_to_sqlite(self):
        result = self.settings_process(DEBUG='false', SECRET_KEY='test-only-deploy-configuration-' * 3)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Set DATABASE_URL', result.stderr)

    def test_render_hosts_and_ssl_are_configured_without_database_connection(self):
        result = self.settings_process(
            DEBUG='false', SECRET_KEY='test-only-deploy-configuration-' * 3,
            DATABASE_URL='postgresql://test:test@127.0.0.1:5432/not_a_live_database',
            RENDER_EXTERNAL_HOSTNAME='campus-test.onrender.com',
        )
        self.assertEqual(result.returncode, 0, result.stderr)
