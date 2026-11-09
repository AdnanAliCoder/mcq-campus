from django.apps import AppConfig
class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    # Preserve the existing Django app label and database table names.
    label = 'core'
