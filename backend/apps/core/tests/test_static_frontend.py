import re

from django.conf import settings
from django.test import SimpleTestCase, override_settings


@override_settings(SECURE_SSL_REDIRECT=False, PREPEND_WWW=False)
class StaticFrontendBoundaryTests(SimpleTestCase):
    """The browser frontend is a static SPA; Django only owns APIs and crawler endpoints."""

    FRONTEND = settings.BASE_DIR / "frontend"

    def setUp(self):
        self.html = (self.FRONTEND / "index.html").read_text(encoding="utf-8")
        self.runtime = (self.FRONTEND / "script.js").read_text(encoding="utf-8")
        self.stylesheet = (self.FRONTEND / "style.css").read_text(encoding="utf-8")
        self.nginx = (
            settings.BASE_DIR
            / "deploy"
            / "nginx"
            / "mcqcampus-frontend-locations.conf"
        ).read_text(encoding="utf-8")
        self.urls = (
            settings.BASE_DIR / "backend" / "config" / "urls.py"
        ).read_text(encoding="utf-8")

    def test_entry_document_is_plain_static_html(self):
        self.assertIn("<!doctype html>", self.html.lower())
        self.assertNotIn("{{", self.html)
        self.assertNotIn("{%", self.html)
        self.assertIn("<title>MCQCampus", self.html)
        self.assertIn('href="https://www.mcqcampus.com/"', self.html)
        self.assertIn('data-page-template="home"', self.html)

    def test_static_document_keeps_all_page_shells_and_reusable_html_templates(self):
        pages = {
            "home", "categories", "past-papers", "pdfs", "blog",
            "login", "register", "forgot", "reset-code", "reset-password",
            "verify", "sitemap", "not-found", "dashboard", "admin",
            "super-admin", "about", "contact", "mcq-levels",
        }
        actual = set(
            re.findall(r'<section\s+data-static-page="([^"]+)"', self.html)
        )
        self.assertEqual(actual, pages)

        for template_id in (
            "mcq-layout-template", "mcq-header-template", "mcq-footer-template",
            "mcq-home-template", "mcq-auth-layout-template",
            "mcq-learner-dashboard-template", "mcq-admin-layout-template",
            "mcq-question-card-template", "mcq-question-option-template",
            "mcq-level-card-template",
        ):
            with self.subTest(template=template_id):
                self.assertIn('id="' + template_id + '"', self.html)

    def test_entry_document_loads_one_first_party_script_and_stylesheet(self):
        self.assertTrue((self.FRONTEND / "script.js").is_file())
        self.assertTrue((self.FRONTEND / "style.css").is_file())
        self.assertEqual(self.html.count('rel="stylesheet"'), 1)
        self.assertIn('href="/assets/style.css', self.html)
        self.assertIn('src="/assets/script.js', self.html)
        self.assertNotIn("/assets/js/", self.html)
        self.assertNotIn("/assets/js/admin/", self.runtime)

    def test_static_routes_are_not_rendered_by_django(self):
        self.assertEqual(settings.TEMPLATES[0]["DIRS"], [])
        self.assertNotIn("frontend_page", self.urls)
        self.assertNotIn("re_path(", self.urls)
        self.assertIn("try_files $uri $uri/ /index.html;", self.nginx)
        self.assertNotIn("@mcqcampus_django", self.nginx)

    def test_legacy_frontend_redirects_remain_at_the_nginx_edge(self):
        self.assertIn("return 301 /categories;", self.nginx)
        self.assertIn("return 301 /?focus=regular;", self.nginx)
        self.assertIn("return 301 /?focus=important;", self.nginx)
        self.assertIn("return 301 /past-papers/pdfs;", self.nginx)
        self.assertIn("return 301 /blog;", self.nginx)

    def test_nginx_serves_static_assets_and_proxies_backend_routes_separately(self):
        self.assertIn("root /home/ubuntu/mcq-campus/frontend;", self.nginx)
        self.assertIn("location = /assets/style.css", self.nginx)
        self.assertIn(
            "alias /home/ubuntu/mcq-campus/frontend/style.css;", self.nginx
        )
        self.assertIn("location = /assets/script.js", self.nginx)
        self.assertIn(
            "alias /home/ubuntu/mcq-campus/frontend/script.js;", self.nginx
        )
        self.assertIn("location ^~ /assets/", self.nginx)
        self.assertIn("location ^~ /api/", self.nginx)
        self.assertIn("location ^~ /admin/", self.nginx)
        self.assertIn("location ^~ /django-static/", self.nginx)

    def test_api_stays_json(self):
        response = self.client.get("/api/public/bootstrap", secure=True)
        self.assertEqual(response.status_code, 200, response.content.decode()[:300])
        self.assertIn("application/json", response.get("Content-Type", ""))
        self.assertNotIn(b"<!doctype html>", response.content.lower())

    def test_header_navigation_and_category_level_behaviour_are_preserved(self):
        header = self.html.split('id="mcq-header-template"', 1)[1].split(
            "</template>", 1
        )[0]
        self.assertIn('<a href="/blog" data-nav-section="blog">Blog</a>', header)
        self.assertNotIn('href="/tests"', header)
        self.assertIn("link('posts','Blog')", self.runtime)
        self.assertIn("track==='category'&&levelNumber>0", self.runtime)
        self.assertIn("renderTrack(root,'category',category)", self.runtime)
        self.assertIn("category-levels-section", self.runtime)

    def test_admin_sidebar_scroll_lock_and_responsive_layout_are_preserved(self):
        self.assertIn("function closeAdminSidebar()", self.runtime)
        self.assertIn("closeAdminSidebar();", self.runtime)
        self.assertIn("min-height:100dvh!important", self.stylesheet)
        self.assertIn("overflow:visible!important", self.stylesheet)
        self.assertIn("body.admin-sidebar-open{overflow:hidden}", self.stylesheet)
