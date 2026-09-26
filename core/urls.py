from django.urls import path
from . import views
urlpatterns=[
    path('auth/session',views.auth_session),
    path('auth/login',views.auth_login), path('auth/register',views.auth_register),
    path('auth/logout',views.auth_logout), path('auth/switch-role',views.auth_switch_role), path('auth/forgot',views.auth_forgot),
    path('auth/reset',views.auth_reset), path('auth/verify',views.auth_verify),
    path('auth/resend-verification',views.auth_resend_verification),
    path('auth/password-change/start',views.auth_password_change_start), path('auth/password-change/confirm',views.auth_password_change_confirm),
    path('startup',views.startup), path('bootstrap',views.bootstrap), path('public/content',views.public_content), path('public/resources',views.public_resources), path('public/catalog',views.public_catalog), path('public/legal',views.public_legal), path('profile',views.profile_detail), path('mcqs/match',views.mcq_match), path('mcqs',views.mcqs), path('health/performance',views.performance_health),
    path('learner/dashboard',views.learner_dashboard), path('admin/overview',views.admin_overview), path('admin/users',views.admin_users),
    path('admin/reports',views.admin_reports), path('admin/trash',views.admin_trash), path('admin/logs',views.admin_logs), path('admin/content',views.admin_content),
    path('contact',views.public_contact), path('report',views.public_report), path('commands',views.commands),
]
