# DynamoDB Local Development Setup

This guide explains how to run DynamoDB locally for development and testing.

## Prerequisites

- Docker
- AWS CLI (for table initialization)
- Node.js and npm

## Quick Start

### 1. Start and Initialize DynamoDB Local

```bash
./run-local.sh
```

This will:
- Start **DynamoDB Local** on `http://localhost:8000`
- Start **DynamoDB Admin UI** on `http://localhost:8001`
- Automatically run `./init-dynamodb-table.sh` once the service is ready.

### 2. Manual Table Initialization (if needed)

```bash
./init-dynamodb-table.sh
```

Make sure these variables are set for local development:

```env
DYNAMODB_TABLE_NAME=EmailStatusHistory
DYNAMODB_ENDPOINT=http://localhost:8000
```

## Verifying the Setup

Open http://localhost:8001 in your browser to browse tables and data.

## Cleanup

Stop and remove DynamoDB Local containers:

```bash
docker-compose -f docker-compose-dynamodb.yml down
```

To also remove the data volumes (hard reset):

```bash
docker-compose -f docker-compose-dynamodb.yml down -v
```
