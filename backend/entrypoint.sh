#!/bin/sh
set -e

# Snapshot the runtime DATABASE_URL before we temporarily override it for
# migrations.  This must happen before any conditional logic so that the
# original value (e.g. PgBouncer port 6543) is preserved and can be restored
# after Alembic finishes.
_ORIGINAL_DATABASE_URL="${DATABASE_URL}"

# ── Migration ────────────────────────────────────────────────────────────────
# Use MIGRATION_DATABASE_URL (direct port 5432) when set, otherwise fall back
# to the regular DATABASE_URL.  This lets the app use a PgBouncer pooler
# (port 6543) at runtime while migrations run on a direct connection, which
# is required because Alembic uses prepared statements that poolers block.
if [ -n "${MIGRATION_DATABASE_URL}" ]; then
    export DATABASE_URL="${MIGRATION_DATABASE_URL}"
    echo "[entrypoint] Running Alembic via MIGRATION_DATABASE_URL (direct connection)..."
    alembic upgrade head
    # Restore the original runtime URL so the app connects on the correct port.
    export DATABASE_URL="${_ORIGINAL_DATABASE_URL}"
    echo "[entrypoint] DATABASE_URL restored to runtime URL."
else
    echo "[entrypoint] Running Alembic migrations..."
    alembic upgrade head
fi

# ── Application ──────────────────────────────────────────────────────────────
echo "[entrypoint] Starting Gunicorn..."
exec gunicorn main:app \
    -w 4 \
    -k uvicorn.workers.UvicornWorker \
    -b 0.0.0.0:8000 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
