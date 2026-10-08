from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from core import views

urlpatterns=[
    path('django-admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('favicon.ico', views.favicon),
    path('site.webmanifest', views.site_manifest),
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
    path('sw.js', serve, {'document_root': settings.BASE_DIR, 'path': 'sw.js'}),
    re_path(r'^(?!api/|django-admin/|assets/).*$', views.spa_index, name='spa-index'),
]
