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

ARG NEXT_PUBLIC_FIREBASE_API_KEY=replace-with-public-firebase-api-key
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=replace-with-sender-id
ARG NEXT_PUBLIC_FIREBASE_APP_ID=replace-with-firebase-app-id

ENV NODE_ENV=production \
  PLANGLADE_AUTH_MODE=nextauth \
  NEXT_PUBLIC_PLANGLADE_AUTH_MODE=nextauth \
  PLANGLADE_STORAGE_PROVIDER=firebase \
  NEXTAUTH_URL=http://localhost:3000 \
  NEXTAUTH_SECRET=docker-build-placeholder \
  FIREBASE_PROJECT_ID=docker-build-placeholder \
  FIREBASE_STORAGE_BUCKET=docker-build-placeholder \
  NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
  NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

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
RUN mkdir -p /app/db && chown nextjs:nodejs /app/db

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
