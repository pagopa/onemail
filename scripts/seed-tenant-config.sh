#!/usr/bin/env bash
#
# Purpose: Seed a TenantConfig item into the TenantConfig DynamoDB table for a given environment.
#          AWS credentials must be exported in the current shell session or though AWS SSO.
#
# Usage examples:
#   ./seed-tenant-config.sh --env dev --client-name appio
#   ./seed-tenant-config.sh --env uat --client-name selfcare
#   ./seed-tenant-config.sh --env prod --client-name send

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
TABLE_NAME="TenantConfig"
ENV_INPUT=""
CLIENT_NAME=""

# ── Argument parsing ──────────────────────────────────────────────────────────
usage() {
  echo "Usage: $0 --env <dev|uat|prod> --client-name <name>"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_INPUT="$2"
      shift 2
      ;;
    --client-name)
      CLIENT_NAME="$2"
      shift 2
      ;;
    *)
      echo "❌ Unknown argument: $1" >&2
      usage
      ;;
  esac
done

# ── Validation ────────────────────────────────────────────────────────────────
if [[ -z "$ENV_INPUT" ]]; then
  echo "❌ --env is required" >&2
  usage
fi

if [[ -z "$CLIENT_NAME" ]]; then
  echo "❌ --client-name is required" >&2
  usage
fi

case "$ENV_INPUT" in
  dev)  ENV_CODE="d" ;;
  uat)  ENV_CODE="u" ;;
  prod) ENV_CODE="p" ;;
  *)
    echo "❌ --env must be one of: dev, uat, prod" >&2
    exit 1
    ;;
esac

if ! command -v aws &> /dev/null; then
  echo "❌ AWS CLI not found. Install it before running this script." >&2
  exit 1
fi

if ! command -v uuidgen &> /dev/null; then
  echo "❌ uuidgen not found. Install it before running this script." >&2
  exit 1
fi

# ── AWS region env ────────────────────────────────────────────────────────
if [[ -z "${AWS_REGION:-}" ]]; then
  export AWS_REGION="eu-south-1"
fi

# ── Build item values ─────────────────────────────────────────────────────────
CLIENT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
CONFIG_SET_NAME="oml-${ENV_CODE}-configuration-set-${CLIENT_NAME}"
TENANT_NAME="oml-${ENV_CODE}-tenant-${CLIENT_NAME}"

# ── Insert item ───────────────────────────────────────────────────────────────
echo "ℹ️  Seeding TenantConfig item into table '$TABLE_NAME'..."
echo "   AWS REGION     : $AWS_REGION"
echo ""
echo "   clientId       : $CLIENT_ID"
echo "   configSetName  : $CONFIG_SET_NAME"
echo "   tenantName     : $TENANT_NAME"

aws dynamodb put-item \
  --table-name "$TABLE_NAME" \
  --item "{
    \"clientId\":      {\"S\": \"$CLIENT_ID\"},
    \"configSetName\": {\"S\": \"$CONFIG_SET_NAME\"},
    \"tenantName\":    {\"S\": \"$TENANT_NAME\"}
  }"

echo "✅ Item inserted successfully."
