import re

from django.conf import settings
from django.test import TestCase, override_settings


@override_settings(SECURE_SSL_REDIRECT=False, PREPEND_WWW=False)
class IndependentFrontendTests(TestCase):
    """Guard the current unified frontend and Django-rendered page boundary."""

    FRONTEND = settings.BASE_DIR / "frontend"

    def setUp(self):
        self.html = (self.FRONTEND / "index.html").read_text(encoding="utf-8")
        self.nginx = (
            settings.BASE_DIR
            / "deploy"
            / "nginx"
            / "mcqcampus-frontend-locations.conf"
        ).read_text(encoding="utf-8")

    def test_single_document_contains_current_static_shells_and_templates(self):
        self.assertIn("<!doctype html>", self.html.lower())
        pages = {
            "home", "categories", "past-papers", "tests", "pdfs", "blog",
            "login", "register", "forgot", "reset-code", "reset-password",
            "verify", "sitemap", "not-found", "dashboard", "admin",
            "super-admin", "about", "contact", "mcq-levels",
        }
        actual = set(re.findall(r'<section\s+data-static-page="([^"]+)"', self.html))
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

        # These placeholders are intentionally rendered by Django for SEO metadata.
        self.assertIn("{{ seo_title|default:", self.html)
        self.assertIn("{% if seo_canonical %}", self.html)

    def test_header_navigation_links_blog_and_hides_tests_tab(self):
        header = self.html.split('id="mcq-header-template"', 1)[1].split("</template>", 1)[0]
        self.assertIn('<a href="/blog" data-nav-section="blog">Blog</a>', header)
        self.assertNotIn('href="/tests"', header)

        runtime = (self.FRONTEND / "script.js").read_text(encoding="utf-8")
        self.assertIn("link('posts','Blog')", runtime)

    def test_category_levels_are_combined_and_questions_use_a_separate_view(self):
        category_template = self.html.split(
            'id="mcq-category-levels-template"', 1
        )[1].split("</template>", 1)[0]
        self.assertIn('data-api-region="levels-category"', category_template)
        self.assertNotIn("data-levels-track", category_template)
        self.assertNotIn("data-levels-panel", category_template)

        runtime = (self.FRONTEND / "script.js").read_text(encoding="utf-8")
        self.assertIn("track==='category'&&levelNumber>0", runtime)
        self.assertIn("renderTrack(root,'category',category)", runtime)
        self.assertIn("category-levels-section", runtime)

    def test_admin_navigation_releases_sidebar_scroll_lock(self):
        runtime = (self.FRONTEND / "script.js").read_text(encoding="utf-8")
        stylesheet = (self.FRONTEND / "style.css").read_text(encoding="utf-8")
        self.assertIn("function closeAdminSidebar()", runtime)
        self.assertIn("closeAdminSidebar();", runtime)
        self.assertIn("closeAdminSidebar();App.render()", runtime)
        self.assertIn("min-height:100dvh!important", stylesheet)
        self.assertIn("overflow:visible!important", stylesheet)
        self.assertIn("body.admin-sidebar-open{overflow:hidden}", stylesheet)

    def test_entry_document_uses_one_first_party_script_and_stylesheet(self):
        self.assertTrue((self.FRONTEND / "script.js").is_file())
        self.assertTrue((self.FRONTEND / "style.css").is_file())
        self.assertEqual(self.html.count('rel="stylesheet"'), 1)
        self.assertIn('href="/assets/style.css', self.html)
        self.assertIn('src="/assets/script.js', self.html)
        self.assertNotIn("/assets/js/", self.html)

        runtime = (self.FRONTEND / "script.js").read_text(encoding="utf-8")
        self.assertIn("mountDataDrivenPage(base,id){", runtime)
        self.assertIn("staticTemplateFragment(id,slots={})", runtime)
        self.assertIn("window.MCQCampusBackendReady===false", runtime)
        self.assertIn("window.MCQLevels?.init?.()", runtime)
        self.assertNotIn("/assets/js/admin/", runtime)

    def test_public_pages_render_through_django_with_route_metadata(self):
        for path in (
            "/", "/mcqs", "/categories", "/past-papers", "/tests", "/pdfs",
            "/blog", "/latest-jobs", "/about", "/contact",
        ):
            with self.subTest(path=path):
                response = self.client.get(path, secure=True)
                self.assertEqual(response.status_code, 200, response.content[:300])
                self.assertIn("text/html", response.get("Content-Type", ""))
                self.assertIn(b"MCQCampus", response.content)
                self.assertNotIn(b"{{ seo_title", response.content)

    def test_unknown_frontend_route_returns_real_404(self):
        response = self.client.get("/this-route-does-not-exist", secure=True)
        self.assertEqual(response.status_code, 404)

    def test_api_stays_json(self):
        response = self.client.get("/api/public/bootstrap", secure=True)
        self.assertEqual(response.status_code, 200, response.content.decode()[:300])
        self.assertIn("application/json", response.get("Content-Type", ""))
        self.assertNotIn(b"<!doctype html>", response.content.lower())

    def test_nginx_serves_unified_assets_and_proxies_api_separately(self):
        self.assertIn("root /home/ubuntu/mcq-campus/frontend;", self.nginx)
        self.assertIn("location = /assets/style.css", self.nginx)
        self.assertIn(
            "alias /home/ubuntu/mcq-campus/frontend/style.css;", self.nginx
        )
        self.assertIn("location = /assets/script.js", self.nginx)
        self.assertIn(
            "alias /home/ubuntu/mcq-campus/frontend/script.js;", self.nginx
        )
        self.assertIn("location ^~ /api/", self.nginx)
        self.assertIn("location @mcqcampus_django", self.nginx)

    def test_contextual_right_sidebars_are_desktop_only(self):
        runtime = (self.FRONTEND / "script.js").read_text(encoding="utf-8")
        stylesheet = (self.FRONTEND / "style.css").read_text(encoding="utf-8")

        # Regular and Important MCQ level pages get their own MCQ-related sidebar.
        self.assertIn("sidebar:PublicLayout.smart('mcqs')", runtime)

        # Public right sidebars remain visible on desktop but are hidden entirely
        # on mobile instead of opening as drawers or stacking under page content.
        self.assertIn("@media(min-width:901px)", stylesheet)
        self.assertIn(".public-sidebar{display:block!important", stylesheet)
        self.assertIn("@media(max-width:900px)", stylesheet)
        self.assertIn(".public-sidebar-mobile-bar,", stylesheet)
        self.assertIn(".public-sidebar,", stylesheet)
        self.assertIn(".public-sidebar-backdrop,", stylesheet)
        self.assertIn(
            ".home-levels-layout .home-category-nav{display:none!important}",
            stylesheet,
        )
