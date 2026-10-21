from django.conf import settings
from django.test import TestCase


class IndependentFrontendTests(TestCase):
    PAGE_FILES = {
        "home":"index.html", "mcqs":"mcqs.html", "categories":"categories.html",
        "past-papers":"past-papers.html", "tests":"tests.html", "login":"login.html",
        "register":"register.html", "pdfs":"pdfs.html", "blog":"blog.html",
        "about":"about.html", "contact":"contact.html", "dashboard":"dashboard.html",
        "admin":"admin.html", "super-admin":"super-admin.html", "latest-jobs":"latest-jobs.html",
    }

    def test_physical_html_entries(self):
        for page,filename in self.PAGE_FILES.items():
            body=(settings.BASE_DIR/"frontend"/filename).read_text(encoding="utf-8")
            with self.subTest(page=page):
                self.assertIn("<!doctype html>",body.lower())
                self.assertIn('id="app"',body)
                self.assertIn('name="mcq-page-entry" content="'+page+'"',body)
                self.assertIn('/assets/js/bootstrap.js?',body)
                self.assertIn('/assets/css/common.css?',body)
                self.assertNotIn("{{",body)
                self.assertNotIn("{%",body)

    def test_assets_are_separate_files(self):
        frontend=settings.BASE_DIR/"frontend"
        for relative in ("css/common.css","css/auth.css","css/mcqs.css","js/bootstrap.js",
            "js/modules/public.js","js/modules/auth.js","js/admin/admin.js","templates.html","sw.js","site.webmanifest"):
            with self.subTest(path=relative): self.assertTrue((frontend/relative).is_file(),relative)

    def test_django_does_not_serve_frontend_pages(self):
        shell=(settings.BASE_DIR/"frontend"/"index.html").read_bytes()
        for path in ("/","/mcqs","/past-papers","/login","/admin"):
            with self.subTest(path=path):
                response=self.client.get(path,secure=True)
                self.assertEqual(response.status_code,404,path)
                self.assertNotEqual(response.content,shell)

    def test_plain_html_component_library(self):
        body=(settings.BASE_DIR/"frontend"/"templates.html").read_text(encoding="utf-8")
        self.assertNotIn("{{",body); self.assertNotIn("{%",body)
        for key in ("mcq-layout-template","mcq-header-template","mcq-footer-template",
            "mcq-question-card-template","mcq-home-template","mcq-auth-layout-template",
            "mcq-public-page-sidebar-template","mcq-learner-dashboard-template","mcq-admin-layout-template"):
            with self.subTest(key=key): self.assertIn('id="'+key+'"',body)

    def test_api_stays_json(self):
        response=self.client.get("/api/public/bootstrap",secure=True)
        self.assertEqual(response.status_code,200)
        self.assertIn("application/json",response.get("Content-Type",""))
        self.assertNotEqual(response.content,(settings.BASE_DIR/"frontend"/"index.html").read_bytes())

    def test_nginx_static_and_api_paths_are_separate(self):
        conf=(settings.BASE_DIR/"deploy"/"nginx"/"mcqcampus-frontend-locations.conf").read_text(encoding="utf-8")
        self.assertIn("root /home/ubuntu/mcq-campus/frontend;",conf)
        self.assertIn("location ^~ /api/",conf)
        self.assertIn("try_files $uri $uri.html /index.html;",conf)
