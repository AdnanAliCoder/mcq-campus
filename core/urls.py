from django.urls import path
from . import views
urlpatterns=[
    path('auth/session',views.auth_session),
    path('auth/login',views.auth_login), path('auth/register',views.auth_register),
    path('auth/logout',views.auth_logout), path('auth/switch-role',views.auth_switch_role), path('auth/forgot',views.auth_forgot),
    path('auth/reset',views.auth_reset), path('auth/verify',views.auth_verify),
    path('auth/resend-verification',views.auth_resend_verification),
    path('bootstrap',views.bootstrap), path('mcqs',views.mcqs), path('health/performance',views.performance_health), path('contact',views.public_contact), path('report',views.public_report), path('commands',views.commands),
]
