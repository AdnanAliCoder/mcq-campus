from django.contrib import admin
from django.urls import include, path, re_path
from core import views

urlpatterns = [
    # AUDIT: Django admin restored (add only if you still want /admin accessible;
    # if you intentionally removed it, delete this line)
    path('admin/', admin.site.urls),

    # API backend
    path('api/', include('core.urls')),

    # SEO / discovery files
    path('robots.txt', views.robots_txt),
    path('llms.txt', views.llms_txt),
    path('sitemap.xml', views.sitemap_index),
    path('sitemap-index.xml', views.legacy_sitemap_redirect),
    path('sitemap-pages.xml', views.legacy_sitemap_redirect),
    path('sitemap-categories.xml', views.legacy_sitemap_redirect),
    path('sitemap-papers.xml', views.legacy_sitemap_redirect),
    path('sitemap-jobs.xml', views.legacy_sitemap_redirect),
    path('sitemap-years.xml', views.legacy_sitemap_redirect),
    path('sitemap-mcqs.xml', views.legacy_sitemap_redirect),
    path('sitemap-resources.xml', views.legacy_sitemap_redirect),

    # AUDIT: catch-all now excludes /api/, /admin/, /assets/ so that an unknown
    # API path returns a real 404 JSON instead of leaking the frontend HTML shell.
    # `.+` (not `.*`) so the empty path `/` is not silently swallowed here.
    re_path(r'^(?!api/|admin/|assets/)(?P<path>.+)$', views.frontend_page),
]

# AUDIT: explicit handlers make sure unknown paths and crashes hit the right template
handler404 = 'core.views.handler404'
handler500 = 'core.views.handler500'
