from django.urls import path
from . import views
urlpatterns=[
    path('auth/session',views.auth_session),
    path('auth/login',views.auth_login), path('auth/register',views.auth_register),
    path('auth/logout',views.auth_logout), path('auth/switch-role',views.auth_switch_role), path('auth/forgot',views.auth_forgot),
    path('auth/reset',views.auth_reset), path('auth/verify',views.auth_verify),
    path('auth/resend-verification',views.auth_resend_verification),
    path('auth/password-change/start',views.auth_password_change_start), path('auth/password-change/confirm',views.auth_password_change_confirm),
    path('startup',views.startup), path('bootstrap',views.bootstrap), path('public/bootstrap',views.public_bootstrap), path('public/content',views.public_content), path('public/resources',views.public_resources), path('public/catalog',views.public_catalog), path('public/legal',views.public_legal), path('profile',views.profile_detail), path('entities',views.entities), path('mcqs/match',views.mcq_match), path('mcqs',views.mcqs), path('health/performance',views.performance_health),
    path('learner/dashboard',views.learner_dashboard), path('admin/overview',views.admin_overview), path('admin/users',views.admin_users), path('admin/countries',views.admin_countries), path('admin/active-country',views.admin_active_country),
    path('admin/reports',views.admin_reports), path('admin/trash',views.admin_trash), path('admin/trash/restore',views.admin_trash_restore), path('admin/trash/delete',views.admin_trash_delete), path('admin/mcqs/delete',views.admin_mcq_delete), path('admin/mcqs/move-past-paper',views.admin_move_past_paper_mcqs), path('admin/logs',views.admin_logs), path('admin/content',views.admin_content),
    path('contact',views.public_contact), path('report',views.public_report), path('commands',views.commands),
]
