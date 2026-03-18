import env from '#config/env';
import { dynamoClient } from '#connector/dynamo.connector';
import {
  HealthResponseDTO,
  HealthStatus,
  ServiceStatus,
} from '#dtos/health/health.dto';
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';

export const healthCheck = async (): Promise<HealthResponseDTO> => {
  let dbStatus = ServiceStatus.Unavailable;

  try {
    // lightweight call to verify connectivity
    await dynamoClient.send(
      new DescribeTableCommand({ TableName: env.aws.emailDbTable }),
    );
    dbStatus = ServiceStatus.Initialized;
  } catch {
    dbStatus = ServiceStatus.NotInitialized;
  }

  const overall =
    dbStatus === ServiceStatus.Initialized
      ? HealthStatus.Healthy
      : HealthStatus.Unhealthy;

  return {
    status: overall,
    timestamp: new Date().toISOString(),
    services: {
      db: dbStatus,
    },
    uptime: process.uptime(),
  };
};
