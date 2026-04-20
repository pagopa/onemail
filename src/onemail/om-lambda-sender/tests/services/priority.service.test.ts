import type { SQSRecord } from 'aws-lambda';

import { DryRunValidationError } from '#errors/dryRunValidation.error';
import {
  handleHighPriority,
  handleLowPriority,
} from '#services/priority.service';
import {
  BadRequestException,
  BulkEmailStatus,
  MailFromDomainNotVerifiedException,
  MessageRejected,
} from '@aws-sdk/client-sesv2';
import { EmailPriority, EmailStatus } from 'om-common/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeEmailStatusHistoryItem } from '../__helpers__/emailFixtures.js';

const getEmailById = vi.hoisted(() => vi.fn());
const getEmailsByRequestId = vi.hoisted(() => vi.fn());
const updateEmailStatus = vi.hoisted(() => vi.fn());
const batchUpdateEmailStatuses = vi.hoisted(() => vi.fn());
const sendHighPriorityEmail = vi.hoisted(() => vi.fn());
const sendLowPriorityEmail = vi.hoisted(() => vi.fn());
const publishMetrics = vi.hoisted(() => vi.fn());

vi.mock('#repositories/email.repository', () => ({
  getEmailById,
  getEmailsByRequestId,
  updateEmailStatus,
  batchUpdateEmailStatuses,
}));
vi.mock('#services/email.service', () => ({
  sendHighPriorityEmail,
  sendLowPriorityEmail,
}));
vi.mock('om-common/repositories', () => ({
  publishMetrics,
  SenderMetricName: {
    InvalidRecord: 'InvalidRecord',
    EmailNotFound: 'EmailNotFound',
    EmailBatchNotFound: 'EmailBatchNotFound',
    HighPriorityDryRunError: 'HighPriorityDryRunError',
    HighPriorityRejected: 'HighPriorityRejected',
    HighPriorityDispatched: 'HighPriorityDispatched',
    LowPriorityDryRunError: 'LowPriorityDryRunError',
    LowPriorityRejected: 'LowPriorityRejected',
    LowPriorityDispatched: 'LowPriorityDispatched',
    LowPriorityRetryableFailure: 'LowPriorityRetryableFailure',
  },
}));

const makeSqsRecord = (body: unknown): SQSRecord =>
  ({
    body: JSON.stringify(body),
    eventSourceARN: 'arn:aws:sqs:eu-south-1:123456789012:queue',
  }) as SQSRecord;

beforeEach(() => {
  getEmailById.mockReset();
  getEmailsByRequestId.mockReset();
  updateEmailStatus.mockReset();
  batchUpdateEmailStatuses.mockReset();
  sendHighPriorityEmail.mockReset();
  sendLowPriorityEmail.mockReset();
  publishMetrics.mockReset();
});

describe('priority.service high priority flows', () => {
  it('discards invalid records and publishes the invalid metric', async () => {
    await handleHighPriority({ body: 'not-json' } as never);

    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'InvalidRecord' }]);
  });

  it('marks high priority emails as dry-run errors when SES validation fails', async () => {
    const email = makeEmailStatusHistoryItem();
    getEmailById.mockResolvedValue(email);
    sendHighPriorityEmail.mockRejectedValue(
      new DryRunValidationError('invalid dry-run'),
    );

    await handleHighPriority(makeSqsRecord({ emailId: 'email-1' }));

    expect(updateEmailStatus).toHaveBeenCalledWith({
      emailId: 'email-1',
      status: EmailStatus.DryRunError,
    });
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'HighPriorityDryRunError',
        dimensions: { clientId: email.clientId },
      },
    ]);
  });

  it('marks high priority emails as dispatched when SES accepts them', async () => {
    const email = makeEmailStatusHistoryItem();
    getEmailById.mockResolvedValue(email);
    sendHighPriorityEmail.mockResolvedValue('ses-message-id');

    await handleHighPriority(makeSqsRecord({ emailId: email.emailId }));

    expect(updateEmailStatus).toHaveBeenCalledWith({
      emailId: email.emailId,
      status: EmailStatus.Dispatched,
      messageId: 'ses-message-id',
    });
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'HighPriorityDispatched',
        dimensions: { clientId: email.clientId },
      },
    ]);
  });

  it('marks high priority emails as rejected when SES returns a non-retryable error', async () => {
    const email = makeEmailStatusHistoryItem();
    getEmailById.mockResolvedValue(email);
    sendHighPriorityEmail.mockRejectedValue(
      new BadRequestException({ message: 'bad request', $metadata: {} }),
    );

    await handleHighPriority(makeSqsRecord({ emailId: 'email-1' }));

    expect(updateEmailStatus).toHaveBeenCalledWith({
      emailId: 'email-1',
      status: EmailStatus.Rejected,
      reason: 'BadRequestException: bad request',
    });
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'HighPriorityRejected',
        dimensions: { clientId: email.clientId },
      },
    ]);
  });

  it('marks high priority emails as rejected when SES returns no message id', async () => {
    const email = makeEmailStatusHistoryItem();
    getEmailById.mockResolvedValue(email);
    sendHighPriorityEmail.mockResolvedValue(undefined);

    await handleHighPriority(makeSqsRecord({ emailId: email.emailId }));

    expect(updateEmailStatus).toHaveBeenCalledWith({
      emailId: email.emailId,
      status: EmailStatus.Rejected,
      reason: 'Unknown SES error',
    });
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'HighPriorityRejected',
        dimensions: { clientId: email.clientId },
      },
    ]);
  });
});

describe('priority.service high priority SES rejection and guard clauses', () => {
  it('marks high priority emails as rejected when domain is not verified by SES', async () => {
    const email = makeEmailStatusHistoryItem();
    getEmailById.mockResolvedValue(email);
    sendHighPriorityEmail.mockRejectedValue(
      new MailFromDomainNotVerifiedException({
        message: 'domain not verified',
        $metadata: {},
      }),
    );

    await handleHighPriority(makeSqsRecord({ emailId: 'email-1' }));

    expect(updateEmailStatus).toHaveBeenCalledWith({
      emailId: 'email-1',
      status: EmailStatus.Rejected,
      reason: 'MailFromDomainNotVerifiedException: domain not verified',
    });
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'HighPriorityRejected',
        dimensions: { clientId: email.clientId },
      },
    ]);
  });

  it('marks high priority emails as rejected when message is rejected by SES', async () => {
    const email = makeEmailStatusHistoryItem();
    getEmailById.mockResolvedValue(email);
    sendHighPriorityEmail.mockRejectedValue(
      new MessageRejected({
        message: 'message rejected',
        $metadata: {},
      }),
    );

    await handleHighPriority(makeSqsRecord({ emailId: 'email-1' }));

    expect(updateEmailStatus).toHaveBeenCalledWith({
      emailId: 'email-1',
      status: EmailStatus.Rejected,
      reason: 'MessageRejected: message rejected',
    });
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'HighPriorityRejected',
        dimensions: { clientId: email.clientId },
      },
    ]);
  });

  it('discards schema-invalid high priority records and publishes the invalid metric', async () => {
    await handleHighPriority(makeSqsRecord({ wrongField: 'value' }));

    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'InvalidRecord' }]);
  });

  it('publishes EmailNotFound and returns early when DB has no record', async () => {
    getEmailById.mockResolvedValue(undefined);

    await handleHighPriority(makeSqsRecord({ emailId: 'email-1' }));

    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'EmailNotFound' }]);
  });

  it('rethrows unknown SES errors for high priority without updating status', async () => {
    const email = makeEmailStatusHistoryItem();
    getEmailById.mockResolvedValue(email);
    sendHighPriorityEmail.mockRejectedValue(
      new Error('unexpected SES failure'),
    );

    await expect(
      handleHighPriority(makeSqsRecord({ emailId: email.emailId })),
    ).rejects.toThrow('unexpected SES failure');
    expect(updateEmailStatus).not.toHaveBeenCalled();
  });
});

describe('priority.service low priority flows', () => {
  it('discards invalid low priority records and publishes the invalid metric', async () => {
    await handleLowPriority({ body: 'not-json' } as never);

    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'InvalidRecord' }]);
  });

  it('discards schema-invalid low priority records and publishes the invalid metric', async () => {
    await handleLowPriority(makeSqsRecord({ wrongField: 'value' }));

    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'InvalidRecord' }]);
  });

  it('publishes EmailBatchNotFound and returns early when DB has no records', async () => {
    getEmailsByRequestId.mockResolvedValue([]);

    await handleLowPriority(makeSqsRecord({ requestId: 'request-1' }));

    expect(publishMetrics).toHaveBeenCalledWith([
      { name: 'EmailBatchNotFound' },
    ]);
  });

  it('marks whole low priority batches as dry-run errors', async () => {
    const emails = [
      makeEmailStatusHistoryItem({
        emailId: 'email-1',
        priority: EmailPriority.LOW,
      }),
      makeEmailStatusHistoryItem({
        emailId: 'email-2',
        priority: EmailPriority.LOW,
      }),
    ];
    getEmailsByRequestId.mockResolvedValue(emails);
    sendLowPriorityEmail.mockRejectedValue(
      new DryRunValidationError('invalid batch'),
    );

    await handleLowPriority(makeSqsRecord({ requestId: 'request-1' }));

    expect(batchUpdateEmailStatuses).toHaveBeenCalledWith([
      { item: emails[0], status: EmailStatus.DryRunError },
      { item: emails[1], status: EmailStatus.DryRunError },
    ]);
    expect(publishMetrics).toHaveBeenCalledWith([
      { name: 'LowPriorityDryRunError', value: 2 },
    ]);
  });

  it('marks whole low priority batches as rejected on non-retryable SES errors', async () => {
    const emails = [
      makeEmailStatusHistoryItem({
        emailId: 'email-1',
        priority: EmailPriority.LOW,
      }),
      makeEmailStatusHistoryItem({
        emailId: 'email-2',
        priority: EmailPriority.LOW,
      }),
    ];
    getEmailsByRequestId.mockResolvedValue(emails);
    sendLowPriorityEmail.mockRejectedValue(
      new BadRequestException({ message: 'bad request', $metadata: {} }),
    );

    await handleLowPriority(makeSqsRecord({ requestId: 'request-1' }));

    expect(batchUpdateEmailStatuses).toHaveBeenCalledWith([
      {
        item: emails[0],
        status: EmailStatus.Rejected,
        reason: 'BadRequestException: bad request',
      },
      {
        item: emails[1],
        status: EmailStatus.Rejected,
        reason: 'BadRequestException: bad request',
      },
    ]);
    expect(publishMetrics).toHaveBeenCalledWith([
      { name: 'LowPriorityRejected', value: 2 },
    ]);
  });
});

describe('priority.service low priority SES entry result flows', () => {
  it('throws when retryable failures remain and updates all statuses', async () => {
    const emails = [
      makeEmailStatusHistoryItem({
        emailId: 'email-1',
        priority: EmailPriority.LOW,
      }),
      makeEmailStatusHistoryItem({
        emailId: 'email-2',
        priority: EmailPriority.LOW,
      }),
    ];
    getEmailsByRequestId.mockResolvedValue(emails);
    sendLowPriorityEmail.mockResolvedValue({
      successful: [
        {
          item: emails[0],
          result: {
            Status: BulkEmailStatus.SUCCESS,
            MessageId: 'ses-message-1',
          },
        },
      ],
      failed: [
        {
          item: emails[1],
          result: {
            Status: BulkEmailStatus.FAILED,
            Error: 'temporary issue',
          },
        },
      ],
    });

    await expect(
      handleLowPriority(makeSqsRecord({ requestId: 'request-1' })),
    ).rejects.toThrow('Retryable failures occurred');

    expect(batchUpdateEmailStatuses).toHaveBeenCalledWith([
      {
        item: emails[0],
        status: EmailStatus.Dispatched,
        messageId: 'ses-message-1',
      },
      { item: emails[1], status: EmailStatus.Queued },
    ]);
    expect(publishMetrics).toHaveBeenCalledWith([
      { name: 'LowPriorityDispatched', value: 1 },
      { name: 'LowPriorityRejected', value: 0 },
      { name: 'LowPriorityRetryableFailure', value: 1 },
    ]);
  });

  it('completes low priority processing when all updates are final', async () => {
    const emails = [
      makeEmailStatusHistoryItem({
        emailId: 'email-1',
        priority: EmailPriority.LOW,
      }),
      makeEmailStatusHistoryItem({
        emailId: 'email-2',
        priority: EmailPriority.LOW,
      }),
    ];
    getEmailsByRequestId.mockResolvedValue(emails);
    sendLowPriorityEmail.mockResolvedValue({
      successful: [
        {
          item: emails[0],
          result: {
            Status: BulkEmailStatus.SUCCESS,
            MessageId: 'ses-message-1',
          },
        },
      ],
      failed: [
        {
          item: emails[1],
          result: {
            Status: BulkEmailStatus.MESSAGE_REJECTED,
            Error: 'hard failure',
          },
        },
      ],
    });

    await handleLowPriority(makeSqsRecord({ requestId: 'request-1' }));

    expect(batchUpdateEmailStatuses).toHaveBeenCalledWith([
      {
        item: emails[0],
        status: EmailStatus.Dispatched,
        messageId: 'ses-message-1',
      },
      {
        item: emails[1],
        status: EmailStatus.Rejected,
        reason: 'hard failure',
      },
    ]);
    expect(publishMetrics).toHaveBeenCalledWith([
      { name: 'LowPriorityDispatched', value: 1 },
      { name: 'LowPriorityRejected', value: 1 },
      { name: 'LowPriorityRetryableFailure', value: 0 },
    ]);
  });

  it('rethrows unknown SES errors for low priority without updating statuses', async () => {
    const emails = [
      makeEmailStatusHistoryItem({
        emailId: 'email-1',
        priority: EmailPriority.LOW,
      }),
    ];
    getEmailsByRequestId.mockResolvedValue(emails);
    sendLowPriorityEmail.mockRejectedValue(new Error('unexpected SES failure'));

    await expect(
      handleLowPriority(makeSqsRecord({ requestId: 'request-1' })),
    ).rejects.toThrow('unexpected SES failure');
    expect(batchUpdateEmailStatuses).not.toHaveBeenCalled();
  });
});
