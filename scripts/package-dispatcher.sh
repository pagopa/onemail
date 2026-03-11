#!/usr/bin/env bash
set -euo pipefail

APP_NAME="om-ecs-dispatcher"
ARTIFACT_DIR="dist-artifact/$APP_NAME"

echo -e "\n🚀 Start packaging $APP_NAME..."

echo -e "\n🧹 Cleaning previous artifacts..."
rm -rf "$ARTIFACT_DIR"

echo -e "\n📦 Packaging..."
pnpm --filter="$APP_NAME" deploy --prod "$ARTIFACT_DIR"

echo -e "✅ Done: $ARTIFACT_DIR"
