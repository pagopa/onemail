#!/usr/bin/env bash
# Purpose: Sync om.tpl.json from openapi-docs.json using the local GitHub Copilot CLI.
#
# Runs copilot in non-interactive mode (-p): the agent reads both files and writes om.tpl.json
#
# Usage:
#   bash scripts/syncOpenapiTemplateAI.sh [--model <model>]
#   pnpm run sync:openapi-template [-- --model <model>]
#   By default, it uses the "gpt-5-mini" model
#
# Available models:
# Run 'copilot --help' to see the full list under --model.
#
# Prerequisites:
#   - copilot CLI installed (brew install copilot-cli)
#   - Authenticated (copilot login)

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────

MODEL="gpt-5-mini"

# ─── Paths ────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENAPI_FILE="$PACKAGE_ROOT/src/onemail/om-ecs-dispatcher/apidoc/openapi-docs.json"
TEMPLATE_FILE="$(cd "$PACKAGE_ROOT/src/infra/src/70_domains/onemail_app/openapi" && pwd)/om.tpl.json"

# ─── Argument parsing ─────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model)
      if [[ $# -lt 2 ]]; then
        echo "❌ Missing value for --model." >&2
        exit 1
      fi
      MODEL="$2"
      shift 2
      ;;
    *)
      echo "❌ Unknown argument: $1" >&2
      echo "Usage: bash scripts/syncOpenapiTemplateAI.sh | pnpm run sync:openapi-template [--model <model>]" >&2
      exit 1
      ;;
  esac
done

# ─── Dependency checks ────────────────────────────────────────────────────────

if ! command -v copilot &>/dev/null; then
  printf "%s\n" \
    "❌ copilot CLI not found. Install with: brew install copilot-cli." \
    "Or see https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli for other installation options." >&2
  exit 1
fi

if [[ ! -f "$OPENAPI_FILE" ]]; then
  echo "❌ openapi-docs.json not found at: $OPENAPI_FILE" >&2
  echo "   Run 'pnpm generate:openapi' first." >&2
  exit 1
fi

if [[ ! -f "$TEMPLATE_FILE" ]]; then
  echo "❌ om.tpl.json not found at: $TEMPLATE_FILE" >&2
  exit 1
fi

# ─── Build prompt ─────────────────────────────────────────────────────────────

# NOTE: copilot reads both files directly via its file tools.
# shellcheck disable=SC2089
PROMPT="You are a JSON transformation tool.
Read the OpenAPI spec at '$OPENAPI_FILE' and the Terraform template for AWS API Gateway at '$TEMPLATE_FILE', then update '$TEMPLATE_FILE' in place to reflect and sync the latest spec.

Follow the existing routes on the template to edit/integrate the file.

## x-amazon-apigateway-integration block rules
this is an example of an x-amazon-apigateway-integration block that must be on every path in the template:

  \"x-amazon-apigateway-integration\": {
    \"type\": \"HTTP_PROXY\",
    \"httpMethod\": \"GET\",
    \"uri\": \"\${uri}/v1/emails/statuses\",
    \"connectionType\": \"VPC_LINK\",
    \"connectionId\": \"\${connection_id}\",
    \"passthroughBehavior\": \"WHEN_NO_TEMPLATES\",
    \"timeoutInMillis\": 20000
  },

RULES:
1. UPDATE doc info version from spec to template and leave other info fields unchanged.
2. UPDATE routes (method, path, tags, params, summary, responses) from spec to template.
   - If a route is removed from the spec, remove it from the template.
   - If a route is added in the spec, add it to the template (before health routes).
3. x-amazon-apigateway-integration:
   - Update 'httpMethod' and 'uri' as needed, if changed.
   - For NEW routes: add the integration block (type=HTTP_PROXY, connectionType=VPC_LINK, timeoutInMillis=20000 for data routes, 5000 for health routes).
   - NEVER change connectionId, connectionType, passthroughBehavior.
4. IMMUTABILITY:
   - Keep ALL Terraform template variable references literally (do not resolve): \${uri}, \${connection_id}, \${server_url}.
   - Keep ALL Terraform conditional directives literally e.g. %{ if env != \"prod\" } and %{ endif }. Do NOT remove or move them. But you have to edit the content inside them if it has changes.
5. CONDITIONALS (IMPORTANT):
   - If description/summary for paths or parameters contains 'ignored in production' or 'non-production', you MUST wrap in %{ if env != \"prod\" } <path-or-parameter> %{ endif } block.
6. CLEANUP:
   - Drop 'requestBody', 'components', '\$ref'.
   - Drop description and validation keywords in parameters schema, like minLength, maxLength etc.

Keep current formatting and indentation style.
Write the result directly to '$TEMPLATE_FILE'. Do not output anything else."

# ─── Run Copilot ─────────────────────────────────────────────────────────────

echo "🤖 Syncing om.tpl.json via GitHub Copilot CLI (model: $MODEL)..."

copilot \
  --model "$MODEL" \
  --no-ask-user \
  --allow-all-paths \
  --allow-tool=write \
  --allow-tool=read \
  -s \
  -p "$PROMPT"

echo "✅ om.tpl.json synced at: $TEMPLATE_FILE"
