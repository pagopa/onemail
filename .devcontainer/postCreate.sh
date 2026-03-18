#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/onemail

echo "==> Setup Node from .nvmrc"

source /opt/nvm/nvm.sh 2>/dev/null || true
nvm install
nvm use

echo "==> Enable pnpm"
corepack enable

pnpm config set store-dir /home/vscode/.pnpm-store

pnpm install
pnpm setup:hooks
