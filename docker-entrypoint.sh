#!/bin/sh
set -eu

: "${DATABASE_URL:?Configure DATABASE_URL com a URL do Postgres Neon}"
: "${DATABASE_URL_UNPOOLED:?Configure DATABASE_URL_UNPOOLED com a URL direta do Neon}"

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node backend/scripts/prisma.mjs migrate deploy
fi

exec "$@"
