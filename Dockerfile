FROM node:24-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --ignore-scripts
COPY backend/prisma/schema.prisma ./backend/prisma/schema.prisma
# Client generation does not connect to a database or need deployment credentials.
RUN ./node_modules/.bin/prisma generate --schema backend/prisma/schema.prisma
COPY backend/tsconfig.json ./backend/tsconfig.json
COPY backend/src ./backend/src
COPY frontend ./frontend
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts

FROM base AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/frontend/package.json ./frontend/package.json
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --from=build --chown=node:node /app/frontend/dist ./frontend/dist
COPY --chown=node:node backend/prisma/schema.prisma ./backend/prisma/schema.prisma
COPY --chown=node:node backend/prisma/migrations ./backend/prisma/migrations
COPY --chown=node:node backend/scripts/prisma.mjs ./backend/scripts/prisma.mjs
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["node", "backend/dist/server.js"]
