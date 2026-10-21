from django.urls import include, path
from core import views

urlpatterns = [
    # Django is an API backend; Nginx serves frontend pages and assets.
    path('api/', include('core.urls')),
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
]
