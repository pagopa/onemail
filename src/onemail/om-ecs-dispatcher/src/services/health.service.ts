import env from '#config/env';
import { dynamoClient } from '#connector/dynamo.connector';
import { sqsClient } from '#connector/sqs.connector';
import {
  HealthResponseDTO,
  HealthStatus,
  ServiceStatus,
} from '#dtos/health/health.dto';
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import {
  GetQueueAttributesCommand,
  QueueAttributeName,
} from '@aws-sdk/client-sqs';

export const healthCheck = async (): Promise<HealthResponseDTO> => {
  let dbStatus = ServiceStatus.Unavailable;
  let sqsHighStatus = ServiceStatus.Unavailable;
  let sqsLowStatus = ServiceStatus.Unavailable;

  // Lightweight call to verify dynamoDB connectivity
  try {
    await dynamoClient.send(
      new DescribeTableCommand({ TableName: env.aws.emailDbTable }),
    );
    dbStatus = ServiceStatus.Initialized;
  } catch {
    dbStatus = ServiceStatus.NotInitialized;
  }

  // Lightweight call to verify high priority SQS queue connectivity
  try {
    await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: env.aws.sqs.highPriorityQueueUrl,
        AttributeNames: [QueueAttributeName.QueueArn],
      }),
    );
    sqsHighStatus = ServiceStatus.Initialized;
  } catch {
    sqsHighStatus = ServiceStatus.NotInitialized;
  }

  // Lightweight call to verify low priority SQS queue connectivity
  try {
    await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: env.aws.sqs.lowPriorityQueueUrl,
        AttributeNames: [QueueAttributeName.QueueArn],
      }),
    );
    sqsLowStatus = ServiceStatus.Initialized;
  } catch {
    sqsLowStatus = ServiceStatus.NotInitialized;
  }

  const overall =
    dbStatus === ServiceStatus.Initialized &&
    sqsHighStatus === ServiceStatus.Initialized &&
    sqsLowStatus === ServiceStatus.Initialized
      ? HealthStatus.Healthy
      : HealthStatus.Unhealthy;

  return {
    status: overall,
    timestamp: new Date().toISOString(),
    services: {
      db: dbStatus,
      queue: {
        highPriority: sqsHighStatus,
        lowPriority: sqsLowStatus,
      },
    },
    uptime: process.uptime(),
  };
};
