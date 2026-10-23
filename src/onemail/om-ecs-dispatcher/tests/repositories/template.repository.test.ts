import { templateRepository } from '#repositories/template.repository';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const templateSend = vi.hoisted(() => vi.fn());

vi.mock('#connectors/dynamo.connector', () => ({
  templateDynamoClient: { send: templateSend },
}));
vi.mock('#config/env', () => ({
  default: { aws: { templateRegistry: { tableName: 'TemplateRegistry' } } },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('templateRepository', () => {
  it('reads the sole TemplateName key consistently through the primary client', async () => {
    const item = {
      TemplateName: 'ced_welcome_v1',
      tenantName: 'oml-d-tenant-ced',
      lastModifiedDate: '2026-10-13T00:00:00.000Z',
    };
    templateSend.mockResolvedValue({ Item: item });

    await expect(
      templateRepository.getByTemplateName(item.TemplateName),
    ).resolves.toEqual(item);
    const command = templateSend.mock.calls[0][0] as GetCommand;
    expect(command).toBeInstanceOf(GetCommand);
    expect(command.input).toEqual({
      TableName: 'TemplateRegistry',
      Key: { TemplateName: item.TemplateName },
      ConsistentRead: true,
    });
  });

  it('returns undefined only when a successful read has no item', async () => {
    templateSend.mockResolvedValue({});
    await expect(
      templateRepository.getByTemplateName('missing'),
    ).resolves.toBeUndefined();
  });

  it('propagates database errors rather than reporting a missing template', async () => {
    const error = new Error('DynamoDB unavailable');
    templateSend.mockRejectedValue(error);
    await expect(
      templateRepository.getByTemplateName('ced_welcome_v1'),
    ).rejects.toBe(error);
  });
});
