#!/bin/sh
set -eu

case "${1:-api}" in
  release)
    python manage.py migrate --noinput
    python manage.py collectstatic --noinput
    if [ "${DEMO_SEED:-false}" = "true" ]; then
      python manage.py seed_demo --credentials-file runtime/demo-credentials.json
    fi
    ;;
  api)
    exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers "${WEB_CONCURRENCY:-2}" --timeout 90 --access-logfile - --error-logfile -
    ;;
  worker)
    exec python manage.py process_outbox --watch
    ;;
  *)
    exec "$@"
    ;;
esac
