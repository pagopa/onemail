#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/onemail

corepack enable
pnpm config set store-dir /home/vscode/.pnpm-store || pnpm config set store-dir /home/node/.pnpm-store
pnpm install
pnpm setup:hooks
