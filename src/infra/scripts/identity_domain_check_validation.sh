#!/usr/bin/env bash
#
# Purpose: Verify that all SES domain identities in the configured AWS region are verified.
# Usage examples:
#   bash src/infra/scripts/identity_domain_check_validation.sh

set -euo pipefail

if ! command -v aws >/dev/null 2>&1; then
    echo "❌ AWS CLI is required but was not found."
    exit 1
fi

ses_identities=$(
    aws ses list-identities \
        --identity-type Domain \
        --query 'Identities' \
        --output text \
    | tr '\t' '\n'
)

if [[ -z "$ses_identities" ]]; then
    echo "ℹ️ No SES domain identities found in region ${AWS_REGION:-unknown}."
    exit 0
fi

unverified_domains=()

while IFS= read -r domain; do
    echo "ℹ️ Checking domain: $domain"
    validation_status=$(aws ses get-identity-verification-attributes \
        --identities "$domain" \
        --query 'VerificationAttributes.*.VerificationStatus' \
        --output text)

    if [[ "$validation_status" == "Success" ]]; then
        echo "✅ Domain $domain is verified."
        continue
    fi

    echo "⚠️ Domain $domain is not verified. Status: ${validation_status:-unknown}"
    unverified_domains+=("$domain")
done <<< "$ses_identities"

if [[ ${#unverified_domains[@]} -eq 0 ]]; then
    echo "✅ All SES domain identities are verified."
    exit 0
fi

echo "❌ Unverified SES domain identities: ${unverified_domains[*]}"
exit 1