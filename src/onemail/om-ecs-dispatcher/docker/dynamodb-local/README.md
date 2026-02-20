# DynamoDB Local Development Setup

This guide explains how to run DynamoDB locally for development and testing.

## Prerequisites

- Docker
- AWS CLI (for table initialization)
- Node.js and npm

## Quick Start

### 1. Start DynamoDB Local with Docker Compose

```bash
docker-compose -f docker-compose-dynamodb.yml up -d
```

This will start:

- **DynamoDB Local** on `http://localhost:8000`
- **DynamoDB Admin UI** on `http://localhost:8001` (optional, for easier debugging)

### 2. Create the auth session table

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

To also remove the data volume:

```bash
docker-compose -f docker-compose-dynamodb.yml down -v
```
