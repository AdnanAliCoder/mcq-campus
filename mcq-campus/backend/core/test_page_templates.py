from django.test import TestCase


class PageTemplateRoutingTests(TestCase):
    """Route families must select their own HTML template without changing public URLs."""

    def test_public_routes_use_page_specific_templates(self):
        cases = [
            ("/", 'data-page-template="home"'),
            ("/mcqs", 'data-page-template="mcqs"'),
            ("/categories", 'data-page-template="categories"'),
            ("/past-papers", 'data-page-template="past-papers"'),
            ("/past-papers/pdfs", 'data-page-template="pdfs"'),
            ("/blog", 'data-page-template="blog"'),
            ("/tests", 'data-page-template="tests"'),
            ("/login", 'data-page-template="authentication"'),
            ("/about", 'data-page-template="information"'),
            ("/sitemap", 'data-page-template="sitemap"'),
        ]
        for path, marker in cases:
            with self.subTest(path=path):
                response = self.client.get(path, secure=True)
                self.assertEqual(response.status_code, 200, path)
                body = response.content.decode("utf-8")
                self.assertIn(marker, body, path)
                self.assertIn('id="app"', body, path)

    def test_unknown_route_uses_not_found_template(self):
        response = self.client.get("/this-route-does-not-exist", secure=True)
        self.assertEqual(response.status_code, 404)
        self.assertIn('data-page-template="page"', response.content.decode("utf-8"))
