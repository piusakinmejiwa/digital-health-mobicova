# MobiCova Health API — production image.
# Multi-stage: build with full deps (tsc), run with prod deps only.

# ---- build stage ----
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build            # tsc -> dist (compiles app + migrations)

# ---- runtime stage ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Production dependencies only.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled output (includes dist/db/migrate.js for the migration task).
COPY --from=build /app/dist ./dist

EXPOSE 8080
USER node
CMD ["node", "dist/server.js"]
