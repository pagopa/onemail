#!/bin/bash
set -e

# Create DynamoDB table (local development)
# Usage: ./docker/dynamodb-local/init-dynamodb-table.sh

# Load .env from the package root if it exists
ENV_FILE="$(dirname "$0")/../../.env"
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment variables from $ENV_FILE"
  set -a
  . "$ENV_FILE"
  set +a
fi

TABLE_NAME="${AWS_EMAIL_DB_TABLE:-EmailStatusHistory}"
ENDPOINT="${AWS_DYNAMODB_ENDPOINT:-http://localhost:8000}"
REGION="${AWS_REGION:-eu-south-1}"

# Global secondary index name (can be overridden from environment)
GSI_NAME="${AWS_EMAIL_DB_REQUEST_ID_GSI:-gsi_request_id_idx}"

echo "Creating DynamoDB table: $TABLE_NAME"
echo "Endpoint: $ENDPOINT"
echo "Region: $REGION"

# Use inline environment variables to avoid overwriting real AWS credentials in the shell
# DynamoDB Local requires credentials but doesn't validate them
AWS_ACCESS_KEY_ID_VALUE="${AWS_DYNAMODB_ACCESS_KEY_ID:-local}"
AWS_SECRET_ACCESS_KEY_VALUE="${AWS_DYNAMODB_SECRET_ACCESS_KEY:-local}"

# TODO: align GSI name with Terraform variable; use AWS_EMAIL_DB_REQUEST_ID_GSI
AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID_VALUE" AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY_VALUE" \
  aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions \
    AttributeName=emailId,AttributeType=S \
    AttributeName=requestId,AttributeType=S \
  --key-schema \
    AttributeName=emailId,KeyType=HASH \
   --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"${GSI_NAME}\",
        \"KeySchema\": [
          {\"AttributeName\": \"requestId\", \"KeyType\": \"HASH\"}
        ],
        \"Projection\": {
          \"ProjectionType\": \"ALL\"
        }
      }
    ]" \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url "$ENDPOINT" \
  --region "$REGION" \
  --no-cli-pager

echo "Table $TABLE_NAME created successfully"
# To verify, run:
# AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID_VALUE" AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY_VALUE" \
# aws dynamodb describe-table --table-name $TABLE_NAME --endpoint-url $ENDPOINT --region $REGION"
