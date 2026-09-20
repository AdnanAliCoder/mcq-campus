from django.contrib import admin
from django.urls import include, path, re_path
from core import views
from core.health import healthz

urlpatterns=[
    path('healthz', healthz, name='healthz'),
    path('django-admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('robots.txt', views.robots_txt),
    re_path(r'^(?P<filename>sitemap-(?:index|pages|categories|papers|mcqs|resources|template)\.xml|routing-manifest\.json)$', views.root_static_file),
    re_path(r'^(?!api/|django-admin/|assets/).*$', views.spa_index, name='spa-index'),
]
