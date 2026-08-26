FROM node:22-alpine AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public self-host builds use NextAuth and local attachment storage.
ENV NODE_ENV=production \
  PLANGLADE_AUTH_MODE=nextauth \
  NEXT_PUBLIC_PLANGLADE_AUTH_MODE=nextauth \
  PLANGLADE_STORAGE_PROVIDER=local \
  NEXTAUTH_URL=http://localhost:3000

RUN export NEXTAUTH_SECRET="$(openssl rand -base64 48)" \
  && npm run db:generate \
  && npm run build

FROM base AS migrator

RUN apk add --no-cache su-exec
COPY package-lock.json /tmp/package-lock.json
RUN npm init -y \
  && PRISMA_VERSION="$(node -p "require('/tmp/package-lock.json').packages['node_modules/prisma'].version")" \
  && PRISMA_CLIENT_VERSION="$(node -p "require('/tmp/package-lock.json').packages['node_modules/@prisma/client'].version")" \
  && DEEPMERGE_VERSION="$(node -p "require('/tmp/package-lock.json').packages['node_modules/deepmerge-ts'].version")" \
  && npm pkg set "overrides.deepmerge-ts=$DEEPMERGE_VERSION" \
  && npm install --omit=dev --no-save "prisma@$PRISMA_VERSION" "@prisma/client@$PRISMA_CLIENT_VERSION" \
  && rm /tmp/package-lock.json
COPY --chown=nextjs:nodejs prisma ./prisma
COPY --chown=nextjs:nodejs scripts/migrate-normalized-auth-emails.mjs ./scripts/migrate-normalized-auth-emails.mjs
COPY --chown=nextjs:nodejs src/lib/local-auth-email.mjs ./src/lib/local-auth-email.mjs
COPY --chown=root:root --chmod=755 scripts/run-migrations.sh ./scripts/run-migrations.sh
RUN ./node_modules/.bin/prisma generate
RUN mkdir -p /app/db && chown nextjs:nodejs /app/db

ENTRYPOINT ["./scripts/run-migrations.sh"]
CMD ["deploy"]

FROM base AS runner

ENV NODE_ENV=production \
  HOSTNAME=0.0.0.0 \
  PORT=3000

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/scripts/validate-auth-config.mjs ./scripts/validate-auth-config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/production-config.mjs ./src/lib/production-config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/production-secret-policy.mjs ./src/lib/production-secret-policy.mjs
RUN mkdir -p /app/db /app/storage/local-attachments \
  && chown -R nextjs:nodejs /app/db /app/storage

USER nextjs
EXPOSE 3000

CMD ["sh", "-c", "node scripts/validate-auth-config.mjs && exec node server.js"]
