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

printf "\n%s\n\n" "------- Syncing OpenAPI template -------"

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
      echo "Usage: bash scripts/syncOpenapiTemplateAI.sh [--model <model>] | pnpm run sync:openapi-template [--model <model>]" >&2
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
These are examples of the two x-amazon-apigateway-integration patterns used in the template.

HTTP_PROXY pattern (used for routes without VTL body mapping):
  \"x-amazon-apigateway-integration\": {
    \"type\": \"HTTP_PROXY\",
    \"httpMethod\": \"GET\",
    \"uri\": \"\${uri}/v1/emails/statuses\",
    \"connectionType\": \"VPC_LINK\",
    \"connectionId\": \"\${connection_id}\",
    \"passthroughBehavior\": \"WHEN_NO_TEMPLATES\",
    \"timeoutInMillis\": 20000
  },

HTTP pattern (used for routes with VTL body mapping):
  \"x-amazon-apigateway-integration\": {
    \"type\": \"HTTP\",
    \"httpMethod\": \"POST\",
    \"uri\": \"\${uri}/v1/emails/send/high\",
    \"connectionType\": \"VPC_LINK\",
    \"connectionId\": \"\${connection_id}\",
    \"requestParameters\": {
      \"integration.request.querystring.dryRun\": \"method.request.querystring.dryRun\"
    },
    \"requestTemplates\": {
      \"application/json\": \${tenant_request_template}
    },
    \"passthroughBehavior\": \"WHEN_NO_MATCH\",
    \"timeoutInMillis\": 20000,
    \"responses\": {
      \"202\": { \"statusCode\": \"202\" },
      \"400\": { \"statusCode\": \"400\" },
      \"401\": { \"statusCode\": \"401\" },
      \"403\": { \"statusCode\": \"403\" },
      \"404\": { \"statusCode\": \"404\" },
      \"409\": { \"statusCode\": \"409\" },
      \"429\": { \"statusCode\": \"429\" },
      \"500\": { \"statusCode\": \"500\" }
    }
  },

RULES:
1. If the OpenAPI spec file is unchanged, do not modify the template file.
  - Use 'git diff' to check if 'openapi-docs.json' has changes compared to the main (prefer origin/main for local) branch.
  - EXCLUDE changes for 'info' object of the json.
  - If there is no changes (excluding info object mentioned above), skip the update and exit successfully.
2. UPDATE doc info version from spec to template and leave other info fields unchanged.
3. UPDATE routes (method, path, tags, params, summary, security, responses) from spec to template.
   - If a route is removed from the spec, remove it from the template.
   - If a route is added in the spec, add it to the template (before health routes).
   - If a route is modified in the spec, update the route block in the template accordingly.
   - Do not add/edit 'description' and validation keywords in parameters schema
   - Do not add 'requestBody', 'components', '\$ref'
   - SECURITY: sync the route-level 'security' field from spec to template.
     * If the spec has "security": [{"api_key": []}], add or keep "security": [{"api_key": []}] on the route.
     * If the spec has "security": [] or no security field, remove any existing 'security' field from that route in the template.
4. x-amazon-apigateway-integration:
   - Update 'httpMethod' and 'uri' as needed, if changed.
   - For NEW routes: add the integration block (connectionType=VPC_LINK, timeoutInMillis=20000 for data routes, 5000 for health routes). Use type=HTTP only if the route requires VTL body mapping (i.e. it needs tenant injection like /send/*); use type=HTTP_PROXY otherwise.
   - NEVER change connectionId, connectionType, passthroughBehavior.
   - Routes that already have type=HTTP must KEEP type=HTTP; routes that already have type=HTTP_PROXY must KEEP type=HTTP_PROXY
   - If the route has type=HTTP:
      - requestTemplates: keep the existing requestTemplates reference exactly as-is; never remove it.
      - Add or update or remove a requestParameters mapping for each query parameter defined on the route. If there are NO query parameters at all, omit the requestParameters field entirely.
      - If the description of the request parameter contains 'ignored in production' or 'non-production', wrap it in a %{ if env != \"prod\" } / %{ endif } block.
      - responses: at the end add or modify a 'responses' object inside the integration block. Build it from the HTTP status codes present in the route's OpenAPI 'responses' field. Each entry must be: \"<statusCode>\": { \"statusCode\": \"<statusCode>\" }.
   - If the route has type=HTTP_PROXY:
      - Do NOT add a 'responses' field inside the integration block, even if there are HTTP status codes in the OpenAPI spec.
      - Do not add requestParameters or requestTemplates; keep the integration block as simple as possible with just type, httpMethod, uri, connectionType, connectionId, passthroughBehavior, timeoutInMillis.
5. For EXISTING paths:
   - If a route has NOT changed in the spec, leave the route block in the template as-is.
6. IMMUTABILITY:
   - Keep ALL Terraform template variable references literally (do not resolve): \${uri}, \${connection_id}, \${server_url}.
   - Keep ALL Terraform conditional directives literally e.g. %{ if env != \"prod\" } and %{ endif }. Do NOT remove or move them. But you have to edit the content inside them if it has changes.
7. CONDITIONALS (IMPORTANT):
   - If description/summary for paths or parameters contains 'ignored in production' or 'non-production', you MUST wrap in %{ if env != \"prod\" } <path-or-parameter> %{ endif } block.
8. CLEANUP:
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
