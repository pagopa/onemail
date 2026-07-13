import env from '#config/env';
import {
  getEmailStatus,
  sanitizeHtmlContent,
  sendEmailLowPriority,
  sendEmailTransactional,
} from '#services/email.service';
import { EmailPriority, EmailStatus } from 'om-common/types';
import { describe, expect, it, vi } from 'vitest';

import {
  expectCommandInput,
  getNthCommand,
} from '../../../testing/commandAssertions.js';
import {
  makeHighPriorityEmailDto,
  makeLowPriorityEmailDto,
  makeTenantConfiguration,
} from '../__helpers__/dtoFactories.js';

const dynamoSend = vi.hoisted(() => vi.fn());
const sqsSend = vi.hoisted(() => vi.fn());
const randomUUID = vi.hoisted(() => vi.fn());
const publishMetrics = vi.hoisted(() => vi.fn());

vi.mock('#connectors/dynamo.connector', () => ({
  dynamoClient: { send: dynamoSend },
}));
vi.mock('#connectors/sqs.connector', () => ({
  sqsClient: { send: sqsSend },
}));
vi.mock('node:crypto', () => ({ randomUUID }));
vi.mock('om-common/repositories', () => ({
  DispatcherMetricName: {
    HighPriorityAccepted: 'HighPriorityAccepted',
    LowPriorityAccepted: 'LowPriorityAccepted',
    EmailStatusNotFound: 'EmailStatusNotFound',
    MultipleTenantForClient: 'MultipleTenantForClient',
    TenantConfigurationNotFound: 'TenantConfigurationNotFound',
    UnauthorizedTenant: 'UnauthorizedTenant',
  },
  publishMetrics,
}));

describe('email.service', () => {
  describe('sendEmailTransactional', () => {
    it('persists the email and publishes the high priority message', async () => {
      dynamoSend.mockResolvedValueOnce({ Items: [makeTenantConfiguration()] });
      randomUUID
        .mockReturnValueOnce('request-id-1')
        .mockReturnValueOnce('email-id-1');

      const result = await sendEmailTransactional(
        makeHighPriorityEmailDto(),
        false,
        'tenant-a',
      );

      expect(result).toEqual({ requestId: 'request-id-1' });
      const putCommand = expectCommandInput(
        dynamoSend,
        { TableName: env.aws.emailDbTable },
        1,
      );
      const putItem = (
        putCommand.input as {
          Item: {
            requestId: string;
            emailId: string;
            content: { to: { email: string } };
          };
        }
      ).Item;
      expect(putItem.requestId).toBe('request-id-1');
      expect(putItem.emailId).toBe('email-id-1');
      expect(putItem.content.to.email).toBe('user@example.com');
      expect((putItem as { clientId?: string }).clientId).toBe('client-id-a');

      expectCommandInput(
        sqsSend,
        {
          QueueUrl: env.aws.sqs.highPriorityQueueUrl,
          MessageBody: JSON.stringify({ emailId: 'email-id-1' }),
        },
        0,
      );

      expect(publishMetrics).toHaveBeenCalledWith([
        {
          name: 'HighPriorityAccepted',
          dimensions: { tenantName: 'tenant-a', clientId: 'client-id-a' },
        },
      ]);
    });

    it('throws INVALID_TENANT when tenant configuration is missing', async () => {
      dynamoSend.mockResolvedValueOnce({ Items: [] });

      await expect(
        sendEmailTransactional(makeHighPriorityEmailDto(), false, 'tenant-a'),
      ).rejects.toMatchObject({
        statusCode: 401,
        errorCode: 'T001',
      });

      expect(sqsSend).not.toHaveBeenCalled();
      expect(publishMetrics).toHaveBeenCalledWith([
        {
          name: 'TenantConfigurationNotFound',
          dimensions: { tenantName: 'tenant-a' },
        },
      ]);
    });

    it('throws INVALID_TENANT when more than one tenant configuration exists', async () => {
      dynamoSend.mockResolvedValueOnce({
        Items: [
          makeTenantConfiguration(),
          {
            tenantName: 'tenant-a',
            configSetName: 'config-set-b',
            clientId: 'client-id-b',
          },
        ],
      });

      await expect(
        sendEmailTransactional(makeHighPriorityEmailDto(), false, 'tenant-a'),
      ).rejects.toMatchObject({
        statusCode: 401,
        errorCode: 'T001',
      });

      expect(sqsSend).not.toHaveBeenCalled();
      expect(publishMetrics).toHaveBeenCalledWith([
        {
          name: 'MultipleTenantForClient',
          dimensions: { tenantName: 'tenant-a' },
        },
      ]);
    });
  });

  describe('sendEmailLowPriority', () => {
    it('splits low priority batches over the DynamoDB write limit', async () => {
      dynamoSend.mockResolvedValueOnce({ Items: [makeTenantConfiguration()] });
      randomUUID.mockReturnValueOnce('request-id-2');
      for (let index = 1; index <= 26; index += 1) {
        randomUUID.mockReturnValueOnce(`email-id-${index}`);
      }

      const sendingInfo = Array.from({ length: 26 }, (_, index) => ({
        to: { email: `user${index + 1}@example.com` },
        templateAttributes: { item: index + 1 },
      }));

      const result = await sendEmailLowPriority(
        makeLowPriorityEmailDto({ sendingInfo }),
        false,
        'tenant-a',
      );

      expect(result).toEqual({ requestId: 'request-id-2' });
      expect(dynamoSend).toHaveBeenCalledTimes(3);

      const firstBatch = getNthCommand(dynamoSend, 1) as {
        input: { RequestItems: Record<string, unknown[]> };
      };
      const secondBatch = getNthCommand(dynamoSend, 2) as {
        input: { RequestItems: Record<string, unknown[]> };
      };

      expect(firstBatch.input.RequestItems[env.aws.emailDbTable]).toHaveLength(
        25,
      );
      expect(secondBatch.input.RequestItems[env.aws.emailDbTable]).toHaveLength(
        1,
      );

      const firstBatchFirstItem = firstBatch.input.RequestItems[
        env.aws.emailDbTable
      ][0] as {
        PutRequest: {
          Item: {
            clientId: string;
          };
        };
      };
      expect(firstBatchFirstItem.PutRequest.Item.clientId).toBe('client-id-a');

      expectCommandInput(
        sqsSend,
        {
          QueueUrl: env.aws.sqs.lowPriorityQueueUrl,
          MessageBody: JSON.stringify({ requestId: 'request-id-2' }),
        },
        0,
      );

      expect(publishMetrics).toHaveBeenCalledWith([
        {
          name: 'LowPriorityAccepted',
          value: 26,
          dimensions: { tenantName: 'tenant-a', clientId: 'client-id-a' },
        },
      ]);
    });

    it('throws INVALID_TENANT when tenant configuration is missing', async () => {
      dynamoSend.mockResolvedValueOnce({ Items: [] });

      await expect(
        sendEmailLowPriority(makeLowPriorityEmailDto(), false, 'tenant-a'),
      ).rejects.toMatchObject({
        statusCode: 401,
        errorCode: 'T001',
      });

      expect(sqsSend).not.toHaveBeenCalled();
    });
  });
});

describe('email.service - getEmailStatus', () => {
  it('returns the history sorted in descending timestamp order', async () => {
    dynamoSend.mockResolvedValueOnce({ Items: [makeTenantConfiguration()] });
    dynamoSend.mockResolvedValueOnce({
      Items: [
        {
          emailId: 'email-id-3',
          requestId: 'request-id-3',
          priority: EmailPriority.HIGH,
          status: EmailStatus.Delivered,
          history: [
            {
              status: EmailStatus.Queued,
              changedAt: '2026-01-01T10:00:00.000Z',
            },
            {
              status: EmailStatus.Delivered,
              changedAt: '2026-01-01T11:00:00.000Z',
            },
          ],
          content: {
            from: { email: 'sender@example.com' },
            to: { email: 'user@example.com' },
          },
          clientId: 'client-id',
          dryRun: false,
          tenantName: 'tenant-a',
          configSetName: 'config-set-a',
        },
      ],
    });

    const result = await getEmailStatus('request-id-3', 'tenant-a');

    expectCommandInput(
      dynamoSend,
      {
        TableName: env.aws.emailDbTable,
        IndexName: env.aws.emailDbRequestIdGSI,
      },
      1,
    );
    expect(result).toEqual([
      {
        emailId: 'email-id-3',
        priority: EmailPriority.HIGH,
        status: EmailStatus.Delivered,
        to: { email: 'user@example.com' },
        history: [
          {
            status: EmailStatus.Delivered,
            changedAt: '2026-01-01T11:00:00.000Z',
          },
          {
            status: EmailStatus.Queued,
            changedAt: '2026-01-01T10:00:00.000Z',
          },
        ],
        attempts: 0,
      },
    ]);
  });

  it('throws an ApiError when the requested email status does not exist', async () => {
    dynamoSend.mockResolvedValueOnce({ Items: [makeTenantConfiguration()] });
    dynamoSend.mockResolvedValueOnce({ Items: [] });

    await expect(
      getEmailStatus('missing-request-id', 'tenant-a'),
    ).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 404,
      errorCode: 'R001',
    });

    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'EmailStatusNotFound',
        dimensions: { tenantName: 'tenant-a', clientId: 'client-id-a' },
      },
    ]);
  });

  it('counts Dispatched events in history as attempts', async () => {
    dynamoSend.mockResolvedValueOnce({ Items: [makeTenantConfiguration()] });
    dynamoSend.mockResolvedValueOnce({
      Items: [
        {
          emailId: 'email-id-4',
          requestId: 'request-id-4',
          priority: EmailPriority.HIGH,
          status: EmailStatus.Delivered,
          history: [
            {
              status: EmailStatus.Queued,
              changedAt: '2026-01-01T10:00:00.000Z',
            },
            {
              status: EmailStatus.Dispatched,
              changedAt: '2026-01-01T10:01:00.000Z',
            },
            {
              status: EmailStatus.SoftBounce,
              changedAt: '2026-01-01T10:02:00.000Z',
            },
            {
              status: EmailStatus.Dispatched,
              changedAt: '2026-01-01T10:03:00.000Z',
            },
            {
              status: EmailStatus.Delivered,
              changedAt: '2026-01-01T10:04:00.000Z',
            },
          ],
          content: {
            from: { email: 'sender@example.com' },
            to: { email: 'user@example.com' },
          },
          clientId: 'client-id',
          dryRun: false,
          tenantName: 'tenant-a',
          configSetName: 'config-set-a',
        },
      ],
    });

    const result = await getEmailStatus('request-id-4', 'tenant-a');

    expect(result[0].attempts).toBe(2);
  });

  it('throws INVALID_TENANT when the requested status belongs to another tenant', async () => {
    dynamoSend.mockResolvedValueOnce({ Items: [makeTenantConfiguration()] });
    dynamoSend.mockResolvedValueOnce({
      Items: [
        {
          emailId: 'email-id-5',
          requestId: 'request-id-5',
          priority: EmailPriority.HIGH,
          status: EmailStatus.Delivered,
          history: [],
          content: {
            from: { email: 'sender@example.com' },
            to: { email: 'user@example.com' },
          },
          clientId: 'client-id-a',
          dryRun: false,
          configSetName: 'config-set-a',
          tenantName: 'tenant-b',
        },
      ],
    });

    await expect(
      getEmailStatus('request-id-5', 'tenant-a'),
    ).rejects.toMatchObject({
      statusCode: 401,
      errorCode: 'T001',
    });

    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'UnauthorizedTenant',
        dimensions: { tenantName: 'tenant-a', clientId: 'client-id-a' },
      },
    ]);
  });
});

describe('sanitizeHtmlContent', () => {
  it('returns the html unchanged and isSanitized false for clean input', () => {
    const result = sanitizeHtmlContent('<p>Hello World</p>');

    expect(result).toEqual({
      sanitizedHtml: '<p>Hello World</p>',
      isSanitized: false,
    });
  });

  it('preserves html doctype when present and keeps isSanitized false', () => {
    const result = sanitizeHtmlContent(
      '<!DOCTYPE html><html><body><p>Hello World</p></body></html>',
    );

    expect(result).toEqual({
      sanitizedHtml:
        '<!DOCTYPE html>\n<html><body><p>Hello World</p></body></html>',
      isSanitized: false,
    });
  });

  it('keeps style content and returns isSanitized false', () => {
    const result = sanitizeHtmlContent(
      '<style>.hero{color:red}</style><p class="hero">Hi</p>',
    );

    expect(result).toEqual({
      sanitizedHtml: '<style>.hero{color:red}</style><p class="hero">Hi</p>',
      isSanitized: false,
    });
  });

  it('removes script tags and returns isSanitized true', () => {
    const result = sanitizeHtmlContent('<p>Hello</p><script>alert(1)</script>');

    expect(result).toEqual({
      sanitizedHtml: '<p>Hello</p>',
      isSanitized: true,
    });
  });

  it('removes disallowed attributes and returns isSanitized true', () => {
    const result = sanitizeHtmlContent('<p onclick="evil()">Click me</p>');

    expect(result).toEqual({
      sanitizedHtml: '<p>Click me</p>',
      isSanitized: true,
    });
  });
});
