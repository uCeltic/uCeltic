from django.core.management import call_command
from django.db import migrations


def create_cache_table(apps, schema_editor):
    # createcachetable reads settings.CACHES and no-ops if the table already
    # exists, so this stays correct if LOCATION/engine ever change.
    call_command("createcachetable", verbosity=0)


def drop_cache_table(apps, schema_editor):
    schema_editor.execute('DROP TABLE IF EXISTS "django_cache"')


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_cache_table, drop_cache_table),
    ]
