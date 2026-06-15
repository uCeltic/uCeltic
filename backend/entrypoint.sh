#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Optionally bootstrap an admin for the manual-upload flow (idempotent).
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    python manage.py createsuperuser --noinput 2>/dev/null || true
fi

exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3