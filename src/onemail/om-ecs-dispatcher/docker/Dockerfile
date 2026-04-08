# =============================================================================
# Multi-stage Dockerfile for om-ecs-dispatcher
# Build context: repository root (docker build -f src/onemail/om-ecs-dispatcher/docker/Dockerfile .)
#
# Stages:
#   base      - Node + Alpine dependencies + pnpm
#   installer - Full monorepo packages json copy + pnpm install (all deps including devDeps for build)
#   builder   - om-ecs-dispatcher (and common) source code copy + build
#   packager  - Produce a self-contained directory keeping only production dependencies and resolves workspace symlinks
#   runner    - minimal final image
# =============================================================================

ARG NODE_VERSION=24.13.0

# ---------- base ----------
FROM node:${NODE_VERSION}-alpine AS base
# libc6-compat provides glibc compatibility, required by some native Node modules on Alpine (musl)
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable pnpm

# ---------- installer ----------
FROM base AS installer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY tsconfig.json ./
# copy only the package.json files related to the dispatcher (dispatcher itself and its dependencies) to not pollute the layer cache with changes in other packages
COPY src/onemail/om-ecs-dispatcher/package.json ./src/onemail/om-ecs-dispatcher/
COPY src/onemail/om-common/package.json          ./src/onemail/om-common/
# installing dependencies with --frozen-lockfile ensures:
#     exact and consistent dependency installation based on the existing pnpm-lock.yaml file
#     the installation doesn't fail if other package.json files of workspace are missing
# installing dependencies with cleanupUnusedCatalogs=false prevents pnpm from removing packages that are not currently needed from pnpm workspace catalog, ensuring that the workspace remains consistent with the lockfile and preventing potential mismatch issues from pnpm deploy script
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile -config.cleanupUnusedCatalogs=false

# ---------- builder ----------
FROM installer AS builder
COPY src/onemail/om-ecs-dispatcher ./src/onemail/om-ecs-dispatcher
COPY src/onemail/om-common         ./src/onemail/om-common
RUN pnpm run build:dispatcher

# ---------- packager ----------
FROM builder AS packager
RUN pnpm run package:dispatcher

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app

ENV NODE_ENV=production

# Emit source-mapped stack traces without buffering stdout/stderr
ENV NODE_OPTIONS="--enable-source-maps"

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 dispatcher

# Copy only the production artifact
COPY --from=packager --chown=dispatcher:nodejs /app/dist-artifact/om-ecs-dispatcher .

USER dispatcher

EXPOSE 3000

# dumb-init forwards SIGTERM correctly so ECS rolling deployments are clean
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/app.js"]
