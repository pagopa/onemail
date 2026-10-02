#!/usr/bin/env bash
#
# Purpose: Upload JSON templates from a GitHub directory to SES and associate them with a tenant.
#
# Usage examples:
#   bash scripts/upload-ses-templates.sh --help
#   bash scripts/upload-ses-templates.sh \
#     --url https://github.com/OWNER/REPO/tree/main/templates \
#     --tenant oml-d-tenant-onemail \
#     --region eu-south-1 \
#     --account-id 123456789012 \
#     --prefix ced \
#     --dry-run
#   Add --no-fail-fast to skip invalid JSON files and report them after processing.
#   Add --recursive to include JSON files in subfolders.
# Requires git, jq, AWS CLI v2 and credentials. Private repos need Git authentication.

set -euo pipefail

GITHUB_URL=""
TENANT_NAME=""
AWS_REGION=""
AWS_ACCOUNT_ID=""
PROFILE=""
PREFIX=""
NO_PREFIX=false
DRY_RUN=false
FAIL_FAST=true
RECURSIVE=false
WORK_DIR=""

usage() {
    printf '%s\n' \
    "Usage: $0 --url URL --tenant NAME --region REGION --account-id ACCOUNT_ID [options]" \
    "" \
    "Required:" \
    "  --url URL                https://github.com/OWNER/REPO/tree/REF/DIRECTORY" \
    "  --tenant NAME            Existing SES tenant in the target account and region." \
    "  --region REGION          AWS region, e.g. eu-south-1." \
    "  --account-id ACCOUNT_ID  Expected 12-digit AWS account; checked before upload." \
    "  --prefix VALUE           Prefix added to each TemplateName, e.g. ced_name." \
    "" \
    "Optional:" \
    "  --profile NAME           AWS profile. Default: standard AWS credential resolution." \
    "  --dry-run                Download and validate only; no AWS calls. Default: upload." \
    "  --no-fail-fast           Skip invalid JSON files; report them and exit non-zero at the end." \
    "                           Default: fail immediately when a JSON file is invalid." \
    "  --recursive              Include *.json files in subfolders. Default: current folder only." \
    "  --no-prefix              Do not add a prefix; required when --prefix is omitted." \
    "  --help                   Show this help and exit without downloading or uploading." \
    "" \
    "Existing templates are overwritten. Only *.json files are included." \
    "JSON format: TemplateName and TemplateContent with Subject and Html; Text is optional." \
    "Branch/tag names cannot contain '/'. No URL queries or percent-encoding."
}

fail() {
    printf '%s\n' "$*" >&2
    exit 1
}

trap 'if [[ -n "$WORK_DIR" ]]; then rm -rf -- "$WORK_DIR"; fi' EXIT

while [[ $# -gt 0 ]]; do
    case "$1" in
        --help) usage; exit 0 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --no-fail-fast) FAIL_FAST=false; shift ;;
        --recursive) RECURSIVE=true; shift ;;
        --no-prefix) NO_PREFIX=true; shift ;;
        --url|--tenant|--region|--account-id|--profile|--prefix)
            [[ $# -ge 2 && -n "$2" ]] || fail "Missing value for $1"
            case "$1" in
                --url) GITHUB_URL="$2" ;;
                --tenant) TENANT_NAME="$2" ;;
                --region) AWS_REGION="$2" ;;
                --account-id) AWS_ACCOUNT_ID="$2" ;;
                --profile) PROFILE="$2" ;;
                --prefix) PREFIX="$2" ;;
            esac
            shift 2
            ;;
        *) usage >&2; fail "Unknown argument: $1" ;;
    esac
done

if [[ -z "$GITHUB_URL" || -z "$TENANT_NAME" || -z "$AWS_REGION" || -z "$AWS_ACCOUNT_ID" ]]; then
    usage >&2
    fail "Missing required arguments."
fi
if [[ "$NO_PREFIX" = true && -n "$PREFIX" ]]; then
    fail "Use either --prefix or --no-prefix, not both."
fi
if [[ "$NO_PREFIX" = false && -z "$PREFIX" ]]; then
    fail "Specify --prefix VALUE or explicitly use --no-prefix."
fi
[[ "$AWS_ACCOUNT_ID" =~ ^[0-9]{12}$ ]] || fail "Invalid account ID."
command -v jq > /dev/null || fail "Missing dependency: jq"

URL_PATTERN='^https://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)/tree/([A-Za-z0-9_.-]+)/([^?#%]+)$'
[[ "$GITHUB_URL" =~ $URL_PATTERN ]] || fail "Unsupported URL. Use https://github.com/OWNER/REPO/tree/REF/DIRECTORY without query strings or percent-encoding."
REPOSITORY="https://github.com/${BASH_REMATCH[1]}/${BASH_REMATCH[2]}.git"
REF="${BASH_REMATCH[3]}"
DIRECTORY="${BASH_REMATCH[4]%/}"
case "/$DIRECTORY/" in
    //*|*/../*) fail "Invalid directory path." ;;
esac
command -v git > /dev/null || fail "Missing dependency: git"
WORK_DIR=$(mktemp -d)
printf '\n'
git clone --depth 1 --filter=blob:none --no-checkout --single-branch \
    --branch "$REF" -- "$REPOSITORY" "$WORK_DIR/repository"
git -C "$WORK_DIR/repository" sparse-checkout set -- "$DIRECTORY"
git -C "$WORK_DIR/repository" checkout
printf 'Git revision: %s\n' "$(git -C "$WORK_DIR/repository" rev-parse HEAD)"
printf '\n'
DIRECTORY="$WORK_DIR/repository/$DIRECTORY"

[[ -d "$DIRECTORY" ]] || fail "Directory not found: $DIRECTORY"
DIRECTORY=$(cd -- "$DIRECTORY" && pwd)
shopt -s nullglob
json_files=()
json_file_count=0
if [[ "$RECURSIVE" = true ]]; then
    while IFS= read -r -d '' file; do
        json_files+=("$file")
        json_file_count=$((json_file_count + 1))
    done < <(find "$DIRECTORY" -type f -name '*.json' -print0)
else
    json_files=("$DIRECTORY"/*.json)
    json_file_count=${#json_files[@]}
fi
[[ "$json_file_count" -gt 0 ]] || fail "No JSON files in $DIRECTORY"

template_names=()
valid_json_files=()
format_failed_files=()
valid_json_count=0
format_failed_count=0
for file in "${json_files[@]}"; do
    relative_file=${file#"$DIRECTORY"/}
    jq -e -s '
        length == 1 and (.[0] |
            type == "object" and
            (.TemplateName | type == "string" and length > 0) and
            (.TemplateContent |
                type == "object" and
                has("Subject") and (.Subject | type == "string") and
                has("Html") and (.Html | type == "string") and
                (if has("Text") then (.Text | type == "string") else true end)))
    ' "$file" > /dev/null 2>&1 || {
        if [[ "$FAIL_FAST" = true ]]; then
            fail "Invalid template JSON (expected TemplateName and TemplateContent with string Subject and Html; Text is optional): $file"
        fi
        format_failed_files+=("$relative_file (invalid template format)")
        format_failed_count=$((format_failed_count + 1))
        printf '❌ Skipped invalid template JSON: %s\n' "$relative_file"
        continue
    }
    TEMPLATE_NAME=$(jq -r '.TemplateName' "$file")
    if [[ "$NO_PREFIX" = false ]]; then
        TEMPLATE_NAME="${PREFIX}_${TEMPLATE_NAME}"
    fi
    for existing_name in "${template_names[@]+"${template_names[@]}"}"; do
        if [[ "$existing_name" = "$TEMPLATE_NAME" ]]; then
            if [[ "$FAIL_FAST" = true ]]; then
                fail "Duplicate TemplateName: $TEMPLATE_NAME in $relative_file"
            fi
            format_failed_files+=("$relative_file (duplicate TemplateName: $TEMPLATE_NAME)")
            format_failed_count=$((format_failed_count + 1))
            printf '❌ Skipped duplicate TemplateName in %s: %s\n' "$relative_file" "$TEMPLATE_NAME"
            continue 2
        fi
    done
    template_names+=("$TEMPLATE_NAME")
    valid_json_files+=("$file")
    valid_json_count=$((valid_json_count + 1))
    printf '✅ Validated: %s -> %s\n' "$relative_file" "$TEMPLATE_NAME"
done

printf '\nTemplates to process: %s | Account: %s | Region: %s | Tenant: %s\n\n' \
    "$valid_json_count" "$AWS_ACCOUNT_ID" "$AWS_REGION" "$TENANT_NAME"
if [[ "$DRY_RUN" = true ]]; then
    printf '\nDry-run complete. No AWS calls made.\n'
    if [[ "$format_failed_count" -gt 0 ]]; then
        printf '❌ Failed format validation (%s):\n' "$format_failed_count" >&2
        printf '  %s\n' "${format_failed_files[@]}" >&2
        exit 1
    fi
    exit 0
fi
if [[ "$valid_json_count" -eq 0 ]]; then
    printf '\n✅ Completed: 0/0 valid templates\n'
    printf '❌ Failed format validation (%s):\n' "$format_failed_count" >&2
    printf '  %s\n' "${format_failed_files[@]}" >&2
    exit 1
fi

command -v aws > /dev/null || fail "Missing dependency: AWS CLI v2"
AWS_CMD=(aws --region "$AWS_REGION" --no-cli-pager --no-cli-auto-prompt)
if [[ -n "$PROFILE" ]]; then
    AWS_CMD+=(--profile "$PROFILE")
fi
IDENTITY=$("${AWS_CMD[@]}" sts get-caller-identity --output json) || fail "Unable to verify AWS identity."
CURRENT_ACCOUNT=$(jq -r '.Account' <<< "$IDENTITY")
[[ "$CURRENT_ACCOUNT" = "$AWS_ACCOUNT_ID" ]] || fail "Active account: $CURRENT_ACCOUNT; expected: $AWS_ACCOUNT_ID. Upload cancelled."
PARTITION=$(jq -r '.Arn | split(":")[1]' <<< "$IDENTITY")
"${AWS_CMD[@]}" sesv2 get-tenant --tenant-name "$TENANT_NAME" > /dev/null \
    || fail "Tenant not accessible. Upload cancelled."

COMPLETED=0
failed_files=()
for file in "${valid_json_files[@]}"; do
    relative_file=${file#"$DIRECTORY"/}
    TEMPLATE_NAME=$(jq -r '.TemplateName' "$file")
    if [[ "$NO_PREFIX" = false ]]; then
        TEMPLATE_NAME="${PREFIX}_${TEMPLATE_NAME}"
    fi
    TEMPLATE_JSON=$(jq -c --arg template_name "$TEMPLATE_NAME" '.TemplateName = $template_name' "$file")
    RESOURCE_ARN="arn:${PARTITION}:ses:${AWS_REGION}:${AWS_ACCOUNT_ID}:template/${TEMPLATE_NAME}"
    printf '\nUpload: %s (%s)\n' "$relative_file" "$TEMPLATE_NAME"

    sleep 1.1
    if OUTPUT=$("${AWS_CMD[@]}" sesv2 create-email-template --cli-input-json "$TEMPLATE_JSON" 2>&1); then
        echo "Template created."
    elif [[ "$OUTPUT" == *"AlreadyExistsException"* ]]; then
        sleep 1.1
        if ! "${AWS_CMD[@]}" sesv2 update-email-template \
            --template-name "$TEMPLATE_NAME" \
            --template-content "$(jq -c '.TemplateContent' "$file")"; then
            printf 'Update failed: %s\n' "$relative_file" >&2
            failed_files+=("$relative_file")
            continue
        fi
        echo "Template updated."
    else
        printf 'Creation failed: %s\n%s\n' "$relative_file" "$OUTPUT" >&2
        failed_files+=("$relative_file")
        continue
    fi

    sleep 1.1
    if OUTPUT=$("${AWS_CMD[@]}" sesv2 create-tenant-resource-association \
        --tenant-name "$TENANT_NAME" --resource-arn "$RESOURCE_ARN" 2>&1); then
        echo "Template associated."
    elif [[ "$OUTPUT" == *"AlreadyExistsException"* ]]; then
        echo "Template already associated."
    else
        printf 'Association failed: %s\n%s\n' "$relative_file" "$OUTPUT" >&2
        failed_files+=("$relative_file")
        continue
    fi
    COMPLETED=$((COMPLETED + 1))
done

printf '\n✅ Completed: %s/%s valid templates\n' "$COMPLETED" "$valid_json_count"
if [[ "$format_failed_count" -gt 0 ]]; then
    printf '❌ Failed format validation (%s):\n' "$format_failed_count" >&2
    printf '  %s\n' "${format_failed_files[@]}" >&2
fi
if [[ "$COMPLETED" -ne "$valid_json_count" ]]; then
    printf 'Failed: %s\n' "${failed_files[@]}" >&2
    exit 1
fi
if [[ "$format_failed_count" -gt 0 ]]; then
    exit 1
fi
