#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/onemail

source /usr/local/share/nvm/nvm.sh 2>/dev/null || true
nvm install
nvm use

corepack enable
corepack install

# store pnpm packages in the home directory to avoid permission issues
pnpm config set store-dir /home/node/.pnpm-store

pnpm install
pnpm setup:hooks
