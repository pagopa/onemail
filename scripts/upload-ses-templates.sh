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
#     --dry-run
# Requires git, jq, AWS CLI v2 and credentials. Private repos need Git authentication.

set -euo pipefail

GITHUB_URL=""
TENANT_NAME=""
AWS_REGION=""
AWS_ACCOUNT_ID=""
PROFILE=""
DRY_RUN=false
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
    "" \
    "Optional:" \
    "  --profile NAME           AWS profile. Default: standard AWS credential resolution." \
    "  --dry-run                Download and validate only; no AWS calls. Default: upload." \
    "  --help                   Show this help and exit without downloading or uploading." \
    "" \
    "Existing templates are overwritten. Only direct *.json files are included." \
    "JSON format: TemplateName and TemplateContent (Subject, Html and/or Text)." \
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
        --url|--tenant|--region|--account-id|--profile)
            [[ $# -ge 2 && -n "$2" ]] || fail "Missing value for $1"
            case "$1" in
                --url) GITHUB_URL="$2" ;;
                --tenant) TENANT_NAME="$2" ;;
                --region) AWS_REGION="$2" ;;
                --account-id) AWS_ACCOUNT_ID="$2" ;;
                --profile) PROFILE="$2" ;;
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
git clone --depth 1 --filter=blob:none --no-checkout --single-branch \
    --branch "$REF" -- "$REPOSITORY" "$WORK_DIR/repository"
git -C "$WORK_DIR/repository" sparse-checkout set -- "$DIRECTORY"
git -C "$WORK_DIR/repository" checkout
printf 'Git revision: %s\n' "$(git -C "$WORK_DIR/repository" rev-parse HEAD)"
DIRECTORY="$WORK_DIR/repository/$DIRECTORY"

[[ -d "$DIRECTORY" ]] || fail "Directory not found: $DIRECTORY"
DIRECTORY=$(cd -- "$DIRECTORY" && pwd)
shopt -s nullglob
json_files=("$DIRECTORY"/*.json)
[[ ${#json_files[@]} -gt 0 ]] || fail "No JSON files in $DIRECTORY"

template_names=()
for file in "${json_files[@]}"; do
    jq -e -s '
        length == 1 and (.[0] |
            type == "object" and
            (.TemplateName | type == "string" and length > 0) and
            (.TemplateContent | type == "object"))
    ' "$file" > /dev/null || fail "Invalid template JSON: $file"
    TEMPLATE_NAME=$(jq -r '.TemplateName' "$file")
    for existing_name in "${template_names[@]+"${template_names[@]}"}"; do
        [[ "$existing_name" != "$TEMPLATE_NAME" ]] || fail "Duplicate TemplateName: $TEMPLATE_NAME"
    done
    template_names+=("$TEMPLATE_NAME")
    printf 'Validated: %s -> %s\n' "${file##*/}" "$TEMPLATE_NAME"
done

printf '\nTemplates: %s | Account: %s | Region: %s | Tenant: %s\n\n' \
    "${#json_files[@]}" "$AWS_ACCOUNT_ID" "$AWS_REGION" "$TENANT_NAME"
if [[ "$DRY_RUN" = true ]]; then
    echo -e "\nDry-run complete. No AWS calls made."
    exit 0
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
for file in "${json_files[@]}"; do
    TEMPLATE_NAME=$(jq -r '.TemplateName' "$file")
    RESOURCE_ARN="arn:${PARTITION}:ses:${AWS_REGION}:${AWS_ACCOUNT_ID}:template/${TEMPLATE_NAME}"
    printf '\nUpload: %s (%s)\n' "${file##*/}" "$TEMPLATE_NAME"

    sleep 1.1
    if OUTPUT=$("${AWS_CMD[@]}" sesv2 create-email-template --cli-input-json "file://$file" 2>&1); then
        echo "Template created."
    elif [[ "$OUTPUT" == *"AlreadyExistsException"* ]]; then
        sleep 1.1
        if ! "${AWS_CMD[@]}" sesv2 update-email-template \
            --template-name "$TEMPLATE_NAME" \
            --template-content "$(jq -c '.TemplateContent' "$file")"; then
            printf 'Update failed: %s\n' "${file##*/}" >&2
            failed_files+=("${file##*/}")
            continue
        fi
        echo "Template updated."
    else
        printf 'Creation failed: %s\n%s\n' "${file##*/}" "$OUTPUT" >&2
        failed_files+=("${file##*/}")
        continue
    fi

    sleep 1.1
    if OUTPUT=$("${AWS_CMD[@]}" sesv2 create-tenant-resource-association \
        --tenant-name "$TENANT_NAME" --resource-arn "$RESOURCE_ARN" 2>&1); then
        echo "Template associated."
    elif [[ "$OUTPUT" == *"AlreadyExistsException"* ]]; then
        echo "Template already associated."
    else
        printf 'Association failed: %s\n%s\n' "${file##*/}" "$OUTPUT" >&2
        failed_files+=("${file##*/}")
        continue
    fi
    COMPLETED=$((COMPLETED + 1))
done

printf 'Completed: %s/%s\n' "$COMPLETED" "${#json_files[@]}"
if [[ "$COMPLETED" -ne "${#json_files[@]}" ]]; then
    printf 'Failed: %s\n' "${failed_files[@]}" >&2
    exit 1
fi
