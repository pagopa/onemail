#!/bin/bash

# Navigate to the directory of this script
cd "$(dirname "$0")"

echo -e "\n🚀 Starting DynamoDB Local..."
docker compose --env-file ../../.env -f ./docker-compose-dynamodb.yml up -d

echo -e "\n⏳ Waiting for DynamoDB to be ready (max 20s)..."
MAX_RETRIES=20
COUNT=0
# Wait for port 8000 to be responsive
until curl -s http://localhost:8000 > /dev/null; do
  if [ $COUNT -eq $MAX_RETRIES ]; then
    echo -e "\n❌ Error: DynamoDB took too long to start. Exiting..."
    exit 1
  fi
  sleep 1
  ((COUNT++))
done

echo -e "\n📦 Initializing DynamoDB table..."
chmod +x ./init-dynamodb-table.sh
./init-dynamodb-table.sh

echo -e "\n✅ DynamoDB Local is ready!"
echo -e "\n🔗 DynamoDB Admin UI: http://localhost:8001"
echo -e "🔗 DynamoDB Endpoint: http://localhost:8000\n"
