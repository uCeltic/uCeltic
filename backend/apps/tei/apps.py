from django.apps import AppConfig


class TeiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.tei'

    def ready(self):
        import apps.tei.signals  # noqa: F401
    