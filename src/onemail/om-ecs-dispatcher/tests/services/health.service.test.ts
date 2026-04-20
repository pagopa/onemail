import { healthCheck } from '#services/health.service';
import { describe, expect, it, vi } from 'vitest';

const dynamoSend = vi.hoisted(() => vi.fn());
const sqsSend = vi.hoisted(() => vi.fn());

vi.mock('#connectors/dynamo.connector', () => ({
  dynamoClient: { send: dynamoSend },
}));
vi.mock('#connectors/sqs.connector', () => ({
  sqsClient: { send: sqsSend },
}));

describe('health.service', () => {
  it('returns a healthy status when DynamoDB and both queues are reachable', async () => {
    vi.spyOn(process, 'uptime').mockReturnValue(42);

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
    expect(dynamoSend).toHaveBeenCalledTimes(1);
    expect(sqsSend).toHaveBeenCalledTimes(2);
  });

  it('returns an unhealthy status when downstream dependencies are not reachable', async () => {
    dynamoSend.mockRejectedValueOnce(new Error('DynamoDB offline'));
    sqsSend
      .mockRejectedValueOnce(new Error('High queue offline'))
      .mockRejectedValueOnce(new Error('Low queue offline'));

    vi.spyOn(process, 'uptime').mockReturnValue(7);

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
