from django.contrib import admin
from django.urls import include, path, re_path
from core import views

urlpatterns=[
    path('django-admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('favicon.ico', views.favicon),
    path('site.webmanifest', views.site_manifest),
    path('robots.txt', views.robots_txt),
    path('sitemap-index.xml', views.sitemap_index),
    path('sitemap-pages.xml', views.sitemap_pages),
    path('sitemap-categories.xml', views.sitemap_categories),
    path('sitemap-papers.xml', views.sitemap_papers),
    path('sitemap-mcqs.xml', views.sitemap_mcqs),
    path('sitemap-resources.xml', views.sitemap_resources),
    path('routing-manifest.json', views.root_static_file, {'filename':'routing-manifest.json'}),
    re_path(r'^(?!api/|django-admin/|assets/).*$', views.spa_index, name='spa-index'),
]
