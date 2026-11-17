from django.test import TestCase, override_settings

from .models import SiteSetting


@override_settings(SECURE_SSL_REDIRECT=False)
class PublicCatalogAccessTests(TestCase):
    def setUp(self):
        settings = SiteSetting.get_solo()
        root = dict(settings.admin_permissions or {})
        site = dict(root.get("_site") or {})
        site["pdfs"] = [
            {
                "id": 92001,
                "title": "Public Practice PDF",
                "slug": "public-practice-pdf",
                "description": "A sample PDF resource.",
                "download_url": "https://files.example.test/public-practice.pdf",
                "country": "Pakistan",
                "active": True,
            }
        ]
        root["_site"] = site
        settings.admin_permissions = root
        settings.save(update_fields=["admin_permissions", "updated_at"])

    def test_anonymous_visitor_can_load_pdf_catalog(self):
        response = self.client.get("/api/public/catalog")

        self.assertEqual(response.status_code, 200)
        pdfs = response.json()["pdfs"]
        self.assertEqual(len(pdfs), 1)
        self.assertEqual(pdfs[0]["title"], "Public Practice PDF")
        self.assertTrue(pdfs[0]["premium"])
        # Public visitors can discover the resource without receiving its file URL.
        self.assertNotIn("download_url", pdfs[0])
