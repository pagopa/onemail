import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockAwsClient } from '../setup/awsMocks.js';
import { createMockLogger } from '../setup/loggerMocks.js';

const setupHealthServiceDependencies = () => {
  const loggerMock = createMockLogger();
  const dynamoClientMock = createMockAwsClient();
  const sqsClientMock = createMockAwsClient();

  vi.doMock('#config/env', () => ({
    default: {
      aws: {
        emailDbTable: 'email-table',
        sqs: {
          highPriorityQueueUrl: 'https://sqs.local/high',
          lowPriorityQueueUrl: 'https://sqs.local/low',
        },
      },
    },
  }));
  vi.doMock('#config/logger', () => ({
    getNamedLogger: vi.fn(() => loggerMock),
  }));
  vi.doMock('#connectors/dynamo.connector', () => ({
    dynamoClient: dynamoClientMock,
  }));
  vi.doMock('#connectors/sqs.connector', () => ({
    sqsClient: sqsClientMock,
  }));

  return {
    dynamoClientMock,
    sqsClientMock,
  };
};

describe('health.service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns a healthy status when DynamoDB and both queues are reachable', async () => {
    const { dynamoClientMock, sqsClientMock } =
      setupHealthServiceDependencies();

    vi.spyOn(process, 'uptime').mockReturnValue(42);

    const { healthCheck } = await import('#services/health.service');
    const result = await healthCheck();

    expect(result).toEqual({
      status: 'Healthy',
      timestamp: expect.any(String),
      services: {
        db: 'Initialized',
        queue: {
          highPriority: 'Initialized',
          lowPriority: 'Initialized',
        },
      },
      uptime: 42,
    });
    expect(dynamoClientMock.send).toHaveBeenCalledTimes(1);
    expect(sqsClientMock.send).toHaveBeenCalledTimes(2);
  });

  it('returns an unhealthy status when downstream dependencies are not reachable', async () => {
    const { dynamoClientMock, sqsClientMock } =
      setupHealthServiceDependencies();

    dynamoClientMock.send.mockRejectedValueOnce(new Error('DynamoDB offline'));
    sqsClientMock.send
      .mockRejectedValueOnce(new Error('High queue offline'))
      .mockRejectedValueOnce(new Error('Low queue offline'));

    vi.spyOn(process, 'uptime').mockReturnValue(7);

    const { healthCheck } = await import('#services/health.service');
    const result = await healthCheck();

    expect(result.status).toBe('Unhealthy');
    expect(result.services).toEqual({
      db: 'NotInitialized',
      queue: {
        highPriority: 'NotInitialized',
        lowPriority: 'NotInitialized',
      },
    });
    expect(result.uptime).toBe(7);
  });
});
