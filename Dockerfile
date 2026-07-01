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

# Firebase is optional. The build does not require NEXT_PUBLIC_FIREBASE_* values;
# the client SDK initializes only when those values are present at runtime.
# To build an image with Firebase client config baked in, pass the values as
# build args here and rebuild. The Docker default uses local file storage.
ENV NODE_ENV=production \
  PLANGLADE_AUTH_MODE=nextauth \
  NEXT_PUBLIC_PLANGLADE_AUTH_MODE=nextauth \
  PLANGLADE_STORAGE_PROVIDER=local \
  NEXTAUTH_URL=http://localhost:3000 \
  NEXTAUTH_SECRET=docker-build-placeholder \
  PLANGLADE_STORAGE_SIGNING_SECRET=docker-build-placeholder

RUN npm run db:generate && npm run build

FROM base AS migrator

COPY package-lock.json /tmp/package-lock.json
RUN npm init -y \
  && PRISMA_VERSION="$(node -p "require('/tmp/package-lock.json').packages['node_modules/prisma'].version")" \
  && npm install --omit=dev --no-save "prisma@$PRISMA_VERSION" \
  && rm /tmp/package-lock.json
COPY --chown=nextjs:nodejs prisma ./prisma
USER nextjs

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM base AS runner

ENV NODE_ENV=production \
  HOSTNAME=0.0.0.0 \
  PORT=3000

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
RUN mkdir -p /app/db /app/storage/local-attachments \
  && chown -R nextjs:nodejs /app/db /app/storage

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
