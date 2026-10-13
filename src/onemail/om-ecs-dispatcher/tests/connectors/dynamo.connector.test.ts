import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(function (configuration: unknown) {
    return { configuration };
  }),
  from: vi.fn((client: unknown) => ({ client })),
  env: {
    server: { environment: 'prod' },
    aws: {
      region: 'eu-central-1',
      templateRegistry: { primaryRegion: 'eu-south-1' },
      localDynamoDb: {
        endpoint: 'http://localhost:8000',
        accessKeyId: 'local',
        secretAccessKey: 'local',
      },
    },
  },
}));

vi.mock('#config/env', () => ({ default: mocks.env }));
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: mocks.createClient,
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: mocks.from },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.env.server.environment = 'prod';
});

describe('template DynamoDB connector', () => {
  it.each(['eu-central-1', 'eu-south-1'])(
    'uses the primary writer region from a %s dispatcher',
    async (region) => {
      mocks.env.aws.region = region;
      await import('#connectors/dynamo.connector');
      expect(mocks.createClient).toHaveBeenNthCalledWith(2, {
        region: 'eu-south-1',
        maxAttempts: 3,
        requestHandler: {
          connectionTimeout: 1000,
          requestTimeout: 3000,
          throwOnRequestTimeout: true,
        },
      });
    },
  );

  it('preserves the local DynamoDB endpoint without calling AWS', async () => {
    mocks.env.server.environment = 'local';
    await import('#connectors/dynamo.connector');
    expect(mocks.createClient).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        endpoint: 'http://localhost:8000',
        credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
      }),
    );
  });
});
