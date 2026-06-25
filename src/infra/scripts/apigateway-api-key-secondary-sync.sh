#!/usr/bin/env bash
#
# Purpose: Ensure a secondary-region API Gateway API key matches the primary-region API key value without exposing the value to Terraform state.
# Usage examples:
#   bash src/infra/scripts/apigateway-api-key-secondary-sync.sh -i a1b2c3 -k apiKey-onemail -p eu-south-1 -s eu-central-1

set -euo pipefail

api_key_id=""
api_key_name=""
primary_region=""
secondary_region=""

function log_info() {
  echo "ℹ️  $*"
}

function log_success() {
  echo "✅ $*"
}

function log_error() {
  echo "❌ $*" >&2
}

function print_usage() {
  cat <<'EOF'
Usage: apigateway-api-key-secondary-sync.sh -i <api-key-id> -k <api-key-name> -p <primary-region> -s <secondary-region>

Options:
  -i  Primary region API Gateway API key identifier.
  -k  API Gateway API key name.
  -p  Primary AWS region.
  -s  Secondary AWS region.
  -h  Show this help message.
EOF
}

function require_cmd() {
  local binary="$1"

  if ! command -v "$binary" >/dev/null 2>&1; then
    log_error "Missing required binary: $binary"
    exit 1
  fi
}

function parse_args() {
  while getopts ":i:k:p:s:h" opt; do
    case "$opt" in
      i) api_key_id="$OPTARG" ;;
      k) api_key_name="$OPTARG" ;;
      p) primary_region="$OPTARG" ;;
      s) secondary_region="$OPTARG" ;;
      h)
        print_usage
        exit 0
        ;;
      :)
        log_error "Option -$OPTARG requires a value."
        print_usage
        exit 1
        ;;
      \?)
        log_error "Unknown option: -$OPTARG"
        print_usage
        exit 1
        ;;
    esac
  done
}

function validate_args() {
  if [[ -z "$api_key_id" || -z "$api_key_name" || -z "$primary_region" || -z "$secondary_region" ]]; then
    log_error "Options -i, -k, -p and -s are required."
    print_usage
    exit 1
  fi

  if [[ "$primary_region" == "$secondary_region" ]]; then
    log_error "Primary and secondary regions must be different."
    exit 1
  fi
}

function normalize_aws_text() {
  local value="$1"

  if [[ "$value" == "None" || "$value" == "null" ]]; then
    return 0
  fi

  echo "$value"
}

function api_gateway() {
  local region="$1"

  shift

  aws apigateway "$@" --region "$region"
}

function read_api_key_value() {
  local region="$1"
  local current_api_key_id="$2"

  api_gateway "$region" get-api-key \
    --api-key "$current_api_key_id" \
    --include-value \
    --query 'value' \
    --output text
}

function find_api_key_id() {
  local region="$1"
  local api_key_ids_text=""
  local api_key_ids=()

  api_key_ids_text="$(normalize_aws_text "$(api_gateway "$region" get-api-keys \
    --name-query "$api_key_name" \
    --query "items[?name==\`${api_key_name}\`].id" \
    --output text)")"

  if [[ -z "$api_key_ids_text" ]]; then
    return 0
  fi

  read -r -a api_key_ids <<<"$api_key_ids_text"

  if [[ "${#api_key_ids[@]}" -gt 1 ]]; then
    log_error "Multiple API keys named $api_key_name found in region $region."
    exit 1
  fi

  echo "${api_key_ids[0]}"
}

function enable_api_key_if_needed() {
  local region="$1"
  local current_api_key_id="$2"
  local current_enabled=""

  current_enabled="$(api_gateway "$region" get-api-key \
    --api-key "$current_api_key_id" \
    --query 'enabled' \
    --output text)"

  if [[ "$current_enabled" == "False" ]]; then
    log_info "Enabling API key $api_key_name in region $region."
    api_gateway "$region" update-api-key \
      --api-key "$current_api_key_id" \
      --patch-operations op='replace',path='/enabled',value='true' >/dev/null
    log_success "Enabled API key $api_key_name in region $region."
  fi
}

function ensure_secondary_api_key() {
  local primary_api_key_value="$1"
  local secondary_api_key_id=""
  local secondary_api_key_value=""

  secondary_api_key_id="$(find_api_key_id "$secondary_region")"

  if [[ -z "$secondary_api_key_id" ]]; then
    log_info "Creating API key $api_key_name in region $secondary_region."
    api_gateway "$secondary_region" create-api-key \
      --name "$api_key_name" \
      --enabled \
      --value "$primary_api_key_value" >/dev/null
    log_success "Created API key $api_key_name in region $secondary_region."
    return 0
  fi

  secondary_api_key_value="$(read_api_key_value "$secondary_region" "$secondary_api_key_id")"

  if [[ "$secondary_api_key_value" != "$primary_api_key_value" ]]; then
    log_error "API key $api_key_name in region $secondary_region already exists with a different value. Reconcile it manually before rerunning Terraform."
    exit 1
  fi

  enable_api_key_if_needed "$secondary_region" "$secondary_api_key_id"
  log_info "API key $api_key_name in region $secondary_region is already aligned."
}

function main() {
  local primary_api_key_value=""

  require_cmd aws
  parse_args "$@"
  validate_args

  primary_api_key_value="$(read_api_key_value "$primary_region" "$api_key_id")"

  if [[ -z "$primary_api_key_value" || "$primary_api_key_value" == "None" ]]; then
    log_error "Unable to read a value for primary API key $api_key_id in region $primary_region."
    exit 1
  fi

  ensure_secondary_api_key "$primary_api_key_value"
}

main "$@"