FROM node:24-alpine AS base
USER node
WORKDIR /app

###############################################################################

FROM base AS builder

ARG BUILD_ID=dev
ENV NEXT_PUBLIC_BUILD_ID=$BUILD_ID

COPY --chown=node:node package*.json .
RUN npm ci

COPY --chown=node:node . .
RUN npm run build

###############################################################################

FROM base AS runner

COPY --chown=node:node --from=builder /app/.next/standalone  ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static
COPY --chown=node:node --from=builder /app/public ./public

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["node", "server.js"]
