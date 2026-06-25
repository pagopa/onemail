#!/usr/bin/env bash
#
# Purpose: Copy a primary-region API Gateway API key value into the secondary region without exposing the value to Terraform state.
# Usage examples:
#   bash src/infra/scripts/apigateway-api-key-secondary-sync.sh -i a1b2c3 -k apiKey-onemail -p eu-south-1 -s eu-central-1
#   bash src/infra/scripts/apigateway-api-key-secondary-sync.sh -h

set -euo pipefail

api_key_id=""
api_key_name=""
primary_region=""
secondary_region=""

log_info() {
  echo "ℹ️  $*"
}

log_success() {
  echo "✅ $*"
}

fail() {
  echo "❌ $*" >&2
  exit 1
}

print_usage() {
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

parse_args() {
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
        echo "❌ Option -$OPTARG requires a value." >&2
        print_usage
        exit 1
        ;;
      \?)
        echo "❌ Unknown option: -$OPTARG" >&2
        print_usage
        exit 1
        ;;
    esac
  done
}

aws_api_gateway() {
  local region="$1"

  shift

  aws apigateway "$@" --region "$region"
}

find_api_key_id() {
  local region="$1"
  local api_key_ids_text=""
  local api_key_ids=()

  api_key_ids_text="$(aws_api_gateway "$region" get-api-keys \
    --name-query "$api_key_name" \
    --query "items[?name=='${api_key_name}'].id" \
    --output text)"

  if [[ "$api_key_ids_text" == "None" || "$api_key_ids_text" == "null" || -z "$api_key_ids_text" ]]; then
    return 0
  fi

  read -r -a api_key_ids <<<"$api_key_ids_text"

  if [[ "${#api_key_ids[@]}" -gt 1 ]]; then
    fail "Multiple API keys named $api_key_name found in region $region."
  fi

  echo "${api_key_ids[0]}"
}

read_api_key_value() {
  local region="$1"
  local current_api_key_id="$2"

  aws_api_gateway "$region" get-api-key \
    --api-key "$current_api_key_id" \
    --include-value \
    --query 'value' \
    --output text
}

main() {
  local primary_api_key_value=""
  local secondary_api_key_id=""
  local secondary_api_key_value=""
  local secondary_api_key_enabled=""

  command -v aws >/dev/null 2>&1 || fail "Missing required binary: aws"
  parse_args "$@"

  if [[ -z "$api_key_id" || -z "$api_key_name" || -z "$primary_region" || -z "$secondary_region" ]]; then
    print_usage
    fail "Options -i, -k, -p and -s are required."
  fi

  if [[ "$primary_region" == "$secondary_region" ]]; then
    fail "Primary and secondary regions must be different."
  fi

  primary_api_key_value="$(read_api_key_value "$primary_region" "$api_key_id")"

  if [[ -z "$primary_api_key_value" || "$primary_api_key_value" == "None" ]]; then
    fail "Unable to read a value for primary API key $api_key_id in region $primary_region."
  fi

  secondary_api_key_id="$(find_api_key_id "$secondary_region")"

  if [[ -z "$secondary_api_key_id" ]]; then
    log_info "Creating API key $api_key_name in region $secondary_region."
    aws_api_gateway "$secondary_region" create-api-key \
      --name "$api_key_name" \
      --enabled \
      --value "$primary_api_key_value" >/dev/null
    log_success "Created API key $api_key_name in region $secondary_region."
    return 0
  fi

  secondary_api_key_value="$(read_api_key_value "$secondary_region" "$secondary_api_key_id")"

  if [[ "$secondary_api_key_value" != "$primary_api_key_value" ]]; then
    fail "API key $api_key_name in region $secondary_region already exists with a different value. Reconcile it manually before rerunning Terraform."
  fi

  secondary_api_key_enabled="$(aws_api_gateway "$secondary_region" get-api-key \
    --api-key "$secondary_api_key_id" \
    --query 'enabled' \
    --output text)"

  if [[ "$secondary_api_key_enabled" == "False" ]]; then
    log_info "Enabling API key $api_key_name in region $secondary_region."
    aws_api_gateway "$secondary_region" update-api-key \
      --api-key "$secondary_api_key_id" \
      --patch-operations op='replace',path='/enabled',value='true' >/dev/null
    log_success "Enabled API key $api_key_name in region $secondary_region."
  fi

  log_info "API key $api_key_name in region $secondary_region is already aligned."
}

main "$@"