#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE="$(dirname "$0")/../../.env"
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment variables from $ENV_FILE"
  set -a
  . "$ENV_FILE"
  set +a
fi

DYNAMO_HOST="${AWS_DYNAMODB_ENDPOINT:-http://localhost:8000}"

echo -e "\n🚀 Starting DynamoDB Local..."
docker compose --env-file ../../.env -f ./docker-compose-dynamodb.yml up -d

echo -e "\n⏳ Waiting for DynamoDB to be ready (max 20s)..."
MAX_RETRIES=20
COUNT=0
echo -e "🔗 DynamoDB Endpoint: $DYNAMO_HOST\n"
until curl -s "$DYNAMO_HOST" > /dev/null; do
  if [ "$COUNT" -eq "$MAX_RETRIES" ]; then
    echo -e "\n❌ Error: DynamoDB took too long to start. Exiting..."
    exit 1
  fi
  sleep 1
  COUNT=$((COUNT + 1))
done

echo -e "\n📦 Initializing DynamoDB table..."
chmod +x ./init-dynamodb-table.sh
AWS_DYNAMODB_ENDPOINT="$DYNAMO_HOST" ./init-dynamodb-table.sh

echo -e "\n✅ DynamoDB Local is ready!"
echo -e "\n🔗 DynamoDB Admin UI: http://localhost:8001"
echo -e "🔗 DynamoDB Endpoint: $DYNAMO_HOST\n"
