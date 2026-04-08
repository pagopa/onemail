#!/usr/bin/env bash
set -euo pipefail

APP_NAME="om-lambda-sender"
ARTIFACT_DIR="dist-artifact/$APP_NAME"
ZIP_NAME="$APP_NAME.zip"

echo -e "\n🚀 Start packaging $APP_NAME..."

echo -e "\n🧹 Cleaning previous artifacts..."
rm -rf "$ZIP_NAME"
rm -rf "$ARTIFACT_DIR"

echo -e "\n📦 Packaging..."
pnpm --filter="$APP_NAME" deploy --prod --config.inject-workspace-packages=true "$ARTIFACT_DIR"

echo -e "\n📁 Creating ZIP archive..."
(
    cd "$ARTIFACT_DIR"
    # Exclude readme, lock file, source maps and pnpm's internal files to avoid duplicating hardlinked files
    # The -y option tells zip to store symlinks as symlinks (it does not follow them).
    zip -ryq "../../$ZIP_NAME" . \
        -x "README.md" \
        -x "pnpm-lock.yaml" \
        -x "*.map"
)

echo -e "✅ Done: $ZIP_NAME"
