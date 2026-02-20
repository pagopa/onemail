import { dynamoClient } from '#connector/dynamo.connector';
import {
  HealthResponse,
  HealthStatus,
  ServiceStatus,
} from '#dtos/health/health.dto';
import { ListTablesCommand } from '@aws-sdk/client-dynamodb';

export const healthCheck = async (): Promise<HealthResponse> => {
  let dynamoStatus = ServiceStatus.Unavailable;

  try {
    // lightweight call to verify connectivity
    await dynamoClient.send(new ListTablesCommand({ Limit: 1 }));
    dynamoStatus = ServiceStatus.Initialized;
  } catch {
    dynamoStatus = ServiceStatus.NotInitialized;
  }

  const overall =
    dynamoStatus === ServiceStatus.Initialized
      ? HealthStatus.Healthy
      : HealthStatus.Unhealthy;

  return {
    status: overall,
    timestamp: new Date().toISOString(),
    services: {
      dynamo: dynamoStatus,
    },
    uptime: process.uptime(),
  };
};
