#!/usr/bin/env bash
#
# Purpose: Build a deployable ZIP archive for a Lambda package.
# Usage examples:
#   bash scripts/package-lambda.sh om-lambda-sender
#   bash scripts/package-lambda.sh om-lambda-email-retention
set -euo pipefail

if [[ $# -ne 1 ]]; then
    echo "❌ Usage: $0 <lambda-package-name>" >&2
    exit 2
fi

APP_NAME="$1"
case "$APP_NAME" in
    om-lambda-sender|om-lambda-email-retention|om-lambda-config-set-processor)
        ;;
    *)
        echo "❌ Unsupported Lambda package: $APP_NAME" >&2
        exit 2
        ;;
esac

ARTIFACT_DIR="dist-artifact/$APP_NAME"
ZIP_NAME="$APP_NAME.zip"

for dependency in pnpm zip; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        echo "❌ Required command not found: $dependency" >&2
        exit 1
    fi
done

echo -e "\n🚀 Start packaging $APP_NAME..."

echo -e "\n🧹 Cleaning previous artifacts..."
rm -rf -- "$ZIP_NAME"
rm -rf -- "$ARTIFACT_DIR"

echo -e "\n📦 Packaging..."
pnpm --filter="$APP_NAME" deploy --prod --config.inject-workspace-packages=true "$ARTIFACT_DIR"

echo -e "\n📁 Creating ZIP archive..."
(
    cd "$ARTIFACT_DIR"
    # Exclude readme, lock file, source maps and pnpm's internal files to avoid duplicating hardlinked files.
    # The -y option tells zip to store symlinks as symlinks (it does not follow them).
    zip -ryq "../../$ZIP_NAME" . \
        -x "README.md" \
        -x "pnpm-lock.yaml" \
        -x "*.map"
)

echo -e "✅ Done: $ZIP_NAME"
