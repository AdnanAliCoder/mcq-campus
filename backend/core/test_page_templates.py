from django.conf import settings
from django.test import TestCase


class IndependentFrontendTests(TestCase):
    """Guard the current single-document frontend + Django API boundary."""

    FRONTEND = settings.BASE_DIR / "frontend"

    def setUp(self):
        self.html = (self.FRONTEND / "index.html").read_text(encoding="utf-8")
        self.nginx = (
            settings.BASE_DIR
            / "deploy"
            / "nginx"
            / "mcqcampus-frontend-locations.conf"
        ).read_text(encoding="utf-8")

    def test_single_document_contains_static_page_shells(self):
        self.assertIn("<!doctype html>", self.html.lower())
        pages = (
            "home", "mcqs", "categories", "past-papers", "tests", "pdfs",
            "blog", "latest-jobs", "login", "register", "dashboard", "admin",
            "super-admin", "about", "contact",
        )
        for page in pages:
            with self.subTest(page=page):
                self.assertIn('data-static-page="' + page + '"', self.html)

        for template_id in (
            "mcq-layout-template", "mcq-header-template", "mcq-footer-template",
            "mcq-home-template", "mcq-auth-layout-template",
            "mcq-learner-dashboard-template", "mcq-admin-layout-template",
            "mcq-question-card-template", "mcq-country-landing-template",
        ):
            with self.subTest(template=template_id):
                self.assertIn('id="' + template_id + '"', self.html)

        self.assertNotIn("{{", self.html)
        self.assertNotIn("{%", self.html)

    def test_entry_document_uses_one_first_party_script_and_stylesheet(self):
        self.assertTrue((self.FRONTEND / "script.js").is_file())
        self.assertTrue((self.FRONTEND / "style.css").is_file())
        self.assertIn('href="/assets/style.css', self.html)
        self.assertIn('src="/assets/script.js', self.html)
        self.assertEqual(self.html.count('rel="stylesheet"'), 1)
        self.assertNotIn("/assets/js/bootstrap.js", self.html)
        self.assertNotIn("/assets/css/common.css", self.html)
        runtime = (self.FRONTEND / "script.js").read_text(encoding="utf-8")
        self.assertIn("showStaticShell(){", runtime)
        self.assertIn("mountStaticPage(base,renderedHtml){", runtime)
        self.assertIn("staticPageMarkup(shell,page){", runtime)
        self.assertIn("window.UI?.layout?.(shell.outerHTML,page)", runtime)
        self.assertIn('data-api-region="home-important-count"', self.html)
        self.assertIn('href="/login?country=USA"', self.html)
        self.assertIn('data-nav-section="tests"', self.html)
        self.assertIn('data-nav-section="latest-jobs"', self.html)
        self.assertNotIn("<!-- SLOT:HEADER_NAV -->", self.html)
        self.assertIn('body[data-page-template="tests"] #main-nav [data-nav-section="tests"]', (self.FRONTEND / "style.css").read_text(encoding="utf-8"))
        self.assertIn("countryShell.cloneNode(true)", runtime)
        self.assertLess(runtime.index("const fill=(name,selector"), runtime.index("fill('breadcrumbs','.breadcrumbs',sourceMain)"))
        self.assertIn('data-api-region="home-stats"', self.html)
        self.assertIn('data-api-region="blog-filters"', self.html)
        self.assertIn('data-api-region="past-paper-pagination"', self.html)
        self.assertIn('data-api-region="breadcrumbs"', self.html)
        self.assertIn("dest.classList.add('public-main','public-main-full')", runtime)
        self.assertNotIn('<nav data-api-region="mcq-pagination"', self.html)
        self.assertIn('form[data-form="mcq-filter"]', runtime)
        self.assertIn("window.UI?.header?.(page)", runtime)
        self.assertIn("window.UI?.footer?.()", runtime)
        self.assertIn("window.MCQCampusBackendReady=false", runtime)
        self.assertIn("else window.App?.showStaticShell?.()", runtime)
        self.assertIn("replace(/^\\\\/+|\\\\/+$/g,'')", runtime)

    def test_django_does_not_serve_frontend_pages(self):
        shell = (self.FRONTEND / "index.html").read_bytes()
        for path in ("/", "/mcqs", "/past-papers", "/login", "/admin"):
            with self.subTest(path=path):
                response = self.client.get(path, secure=True)
                self.assertEqual(response.status_code, 404, path)
                self.assertNotEqual(response.content, shell)

    def test_api_stays_json(self):
        response = self.client.get("/api/public/bootstrap", secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/json", response.get("Content-Type", ""))
        self.assertNotEqual(
            response.content, (self.FRONTEND / "index.html").read_bytes()
        )

    def test_nginx_serves_entry_assets_and_proxies_api_separately(self):
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
        self.assertIn("try_files $uri $uri.html /index.html;", self.nginx)
