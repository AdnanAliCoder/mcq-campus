from django.conf import settings
from django.test import TestCase


class StaticFrontendShellTests(TestCase):
    """The frontend is a plain HTML document; Django only serves the shell and APIs."""

    def setUp(self):
        self.shell = (settings.BASE_DIR / "frontend" / "index.html").read_bytes()

    def test_public_routes_serve_the_same_unmodified_html_shell(self):
        paths = [
            "/",
            "/mcqs",
            "/categories",
            "/past-papers",
            "/past-papers/pdfs",
            "/blog",
            "/tests",
            "/login",
            "/about",
            "/sitemap",
        ]
        for path in paths:
            with self.subTest(path=path):
                response = self.client.get(path, secure=True)
                self.assertEqual(response.status_code, 200, path)
                self.assertEqual(response["Content-Type"].split(";")[0], "text/html", path)
                self.assertEqual(response.content, self.shell, path)

    def test_frontend_shell_contains_plain_html_templates_not_django_tags(self):
        body = self.shell.decode("utf-8")
        self.assertNotIn("{{", body)
        self.assertNotIn("{%", body)
        self.assertNotIn("MCQ_OPTIONAL_INTEGRATIONS", body)
        for template_id in (
            "mcq-layout-template",
            "mcq-header-template",
            "mcq-footer-template",
            "mcq-question-card-template",
            "mcq-home-template",
            "mcq-auth-layout-template",
            "mcq-public-page-sidebar-template",
            "mcq-learner-dashboard-template",
            "mcq-admin-layout-template",
        ):
            with self.subTest(template_id=template_id):
                self.assertIn(f'id="{template_id}"', body)

    def test_unknown_route_returns_the_same_shell_with_not_found_status(self):
        response = self.client.get("/this-route-does-not-exist", secure=True)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.content, self.shell)

    def test_legacy_url_redirects_are_preserved(self):
        response = self.client.get("/papers", secure=True)
        self.assertEqual(response.status_code, 301)
        self.assertEqual(response["Location"], "https://www.mcqcampus.com/past-papers")

    def test_api_remains_separate_from_the_html_frontend(self):
        response = self.client.get("/api/public/bootstrap", secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/json", response["Content-Type"])
        self.assertNotEqual(response.content, self.shell)
