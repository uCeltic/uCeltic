from django.db import migrations

# The work every research manuscript in backend/tei/ belongs to. Created here so
# the opener has something to offer on a fresh database; which documents belong
# to it is left to an admin, deliberately — matching on the title string is the
# guess this feature exists to stop making (#152).
NAME = "Acallam na Senórach"
SLUG = "acallam-na-senorach"


def create_acallam(apps, schema_editor):
    Work = apps.get_model("tei", "Work")
    # Historical models carry no custom save(), so the slug derivation on the
    # real Work does not run here — hence the literal slug above.
    Work.objects.get_or_create(slug=SLUG, defaults={"name": NAME})


def delete_acallam(apps, schema_editor):
    Work = apps.get_model("tei", "Work")
    # Documents survive the delete (SET_NULL); only the grouping goes.
    Work.objects.filter(slug=SLUG).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tei', '0005_work_teidocument_work'),
    ]

    operations = [
        migrations.RunPython(create_acallam, delete_acallam),
    ]
