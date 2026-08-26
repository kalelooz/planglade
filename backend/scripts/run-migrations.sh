#!/bin/sh
set -eu

chown -R nextjs:nodejs /app/db

if [ "$#" -gt 0 ] && [ "$1" != "deploy" ]; then
  exec su-exec nextjs:nodejs "$@"
fi

exec su-exec nextjs:nodejs sh -c './node_modules/.bin/prisma migrate deploy && node scripts/migrate-normalized-auth-emails.mjs'
