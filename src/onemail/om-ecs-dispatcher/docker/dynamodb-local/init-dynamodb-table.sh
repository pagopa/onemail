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
EMAIL_DB_PK_NAME="emailId"
EMAIL_DB_REQUEST_ID_NAME="requestId"
EMAIL_DB_REQUEST_ID_GSI="${AWS_EMAIL_DB_REQUEST_ID_GSI:-gsi_request_id_idx}"

echo "Creating DynamoDB table: $TABLE_NAME"
echo "Endpoint: $ENDPOINT"
echo "Region: $REGION"
echo "Primary Key: $EMAIL_DB_PK_NAME"
echo "Request ID Attribute: $EMAIL_DB_REQUEST_ID_NAME"
echo "Request ID GSI: $EMAIL_DB_REQUEST_ID_GSI"

# Use inline environment variables to avoid overwriting real AWS credentials in the shell
# DynamoDB Local requires credentials but doesn't validate them
AWS_ACCESS_KEY_ID_VALUE="${AWS_DYNAMODB_ACCESS_KEY_ID:-local}"
AWS_SECRET_ACCESS_KEY_VALUE="${AWS_DYNAMODB_SECRET_ACCESS_KEY:-local}"

AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID_VALUE" AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY_VALUE" \
  aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions \
    AttributeName=$EMAIL_DB_PK_NAME,AttributeType=S \
    AttributeName=$EMAIL_DB_REQUEST_ID_NAME,AttributeType=S \
  --key-schema \
    AttributeName=$EMAIL_DB_PK_NAME,KeyType=HASH \
   --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"$EMAIL_DB_REQUEST_ID_GSI\",
        \"KeySchema\": [
          {\"AttributeName\": \"$EMAIL_DB_REQUEST_ID_NAME\", \"KeyType\": \"HASH\"}
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
