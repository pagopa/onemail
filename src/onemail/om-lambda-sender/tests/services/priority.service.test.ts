import {
  BadRequestException,
  BulkEmailStatus,
  MailFromDomainNotVerifiedException,
  MessageRejected,
} from '@aws-sdk/client-sesv2';
import { EmailPriority, EmailStatus } from 'om-common/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeEmailStatusHistoryItem } from '../setup/emailFixtures.js';
import { loadPriorityService } from '../setup/priorityServiceLoader.js';
import { makeSqsRecord } from '../setup/sqsFactories.js';

describe('priority.service high priority flows', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('discards invalid records and publishes the invalid metric', async () => {
    const { handleHighPriority, rootLogger, publishMetrics } =
      await loadPriorityService();

    await handleHighPriority({ body: 'not-json' } as never);

    expect(rootLogger.error).toHaveBeenCalledWith(
      'Invalid payload, discarding record',
      expect.objectContaining({
        record: expect.objectContaining({ body: 'not-json' }),
      }),
    );
    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'InvalidRecord' }]);
  });

  it('marks high priority emails as dry-run errors when SES validation fails', async () => {
    const { DryRunValidationError } =
      await import('#errors/dryRunValidation.error');
    const updateEmailStatus = vi.fn();
    const email = makeEmailStatusHistoryItem();
    const { handleHighPriority, publishMetrics } = await loadPriorityService({
      getEmailById: vi.fn().mockResolvedValue(email),
      updateEmailStatus,
      sendHighPriorityEmail: vi
        .fn()
        .mockRejectedValue(new DryRunValidationError('invalid dry-run')),
    });

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
    const updateEmailStatus = vi.fn();
    const email = makeEmailStatusHistoryItem();
    const { handleHighPriority, namedLogger, publishMetrics } =
      await loadPriorityService({
        getEmailById: vi.fn().mockResolvedValue(email),
        updateEmailStatus,
        sendHighPriorityEmail: vi.fn().mockResolvedValue('ses-message-id'),
      });

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
    expect(namedLogger.info).toHaveBeenCalledWith('End');
  });

  it('marks high priority emails as rejected when SES returns a non-retryable error', async () => {
    const updateEmailStatus = vi.fn();
    const email = makeEmailStatusHistoryItem();
    const { handleHighPriority, publishMetrics } = await loadPriorityService({
      getEmailById: vi.fn().mockResolvedValue(email),
      updateEmailStatus,
      sendHighPriorityEmail: vi
        .fn()
        .mockRejectedValue(
          new BadRequestException({ message: 'bad request', $metadata: {} }),
        ),
    });

    await handleHighPriority(makeSqsRecord({ emailId: 'email-1' }));

    expect(updateEmailStatus).toHaveBeenCalledWith({
      emailId: 'email-1',
      status: EmailStatus.RejectedBySES,
      reason: 'BadRequestException: bad request',
    });
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'HighPriorityRejectedBySES',
        dimensions: { clientId: email.clientId },
      },
    ]);
  });

  it('marks high priority emails as rejected when SES returns no message id', async () => {
    const updateEmailStatus = vi.fn();
    const email = makeEmailStatusHistoryItem();
    const { handleHighPriority, publishMetrics } = await loadPriorityService({
      getEmailById: vi.fn().mockResolvedValue(email),
      updateEmailStatus,
      sendHighPriorityEmail: vi.fn().mockResolvedValue(undefined),
    });

    await handleHighPriority(makeSqsRecord({ emailId: email.emailId }));

    expect(updateEmailStatus).toHaveBeenCalledWith({
      emailId: email.emailId,
      status: EmailStatus.RejectedBySES,
      reason: 'Unknown SES error',
    });
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'HighPriorityRejectedBySES',
        dimensions: { clientId: email.clientId },
      },
    ]);
  });
});

describe('priority.service high priority SES rejection and guard clauses', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('marks high priority emails as rejected when domain is not verified by SES', async () => {
    const updateEmailStatus = vi.fn();
    const email = makeEmailStatusHistoryItem();
    const { handleHighPriority, publishMetrics } = await loadPriorityService({
      getEmailById: vi.fn().mockResolvedValue(email),
      updateEmailStatus,
      sendHighPriorityEmail: vi.fn().mockRejectedValue(
        new MailFromDomainNotVerifiedException({
          message: 'domain not verified',
          $metadata: {},
        }),
      ),
    });

    await handleHighPriority(makeSqsRecord({ emailId: 'email-1' }));

    expect(updateEmailStatus).toHaveBeenCalledWith({
      emailId: 'email-1',
      status: EmailStatus.RejectedBySES,
      reason: 'MailFromDomainNotVerifiedException: domain not verified',
    });
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'HighPriorityRejectedBySES',
        dimensions: { clientId: email.clientId },
      },
    ]);
  });

  it('marks high priority emails as rejected when message is rejected by SES', async () => {
    const updateEmailStatus = vi.fn();
    const email = makeEmailStatusHistoryItem();
    const { handleHighPriority, publishMetrics } = await loadPriorityService({
      getEmailById: vi.fn().mockResolvedValue(email),
      updateEmailStatus,
      sendHighPriorityEmail: vi.fn().mockRejectedValue(
        new MessageRejected({
          message: 'message rejected',
          $metadata: {},
        }),
      ),
    });

    await handleHighPriority(makeSqsRecord({ emailId: 'email-1' }));

    expect(updateEmailStatus).toHaveBeenCalledWith({
      emailId: 'email-1',
      status: EmailStatus.RejectedBySES,
      reason: 'MessageRejected: message rejected',
    });
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'HighPriorityRejectedBySES',
        dimensions: { clientId: email.clientId },
      },
    ]);
  });

  it('discards schema-invalid high priority records and publishes the invalid metric', async () => {
    const { handleHighPriority, rootLogger, publishMetrics } =
      await loadPriorityService();

    await handleHighPriority(makeSqsRecord({ wrongField: 'value' }));

    expect(rootLogger.error).toHaveBeenCalledWith(
      'Invalid payload, discarding record',
      expect.objectContaining({ errors: expect.any(Array) }),
    );
    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'InvalidRecord' }]);
  });

  it('publishes EmailNotFound and returns early when DB has no record', async () => {
    const { handleHighPriority, namedLogger, publishMetrics } =
      await loadPriorityService({
        getEmailById: vi.fn().mockResolvedValue(undefined),
      });

    await handleHighPriority(makeSqsRecord({ emailId: 'email-1' }));

    expect(namedLogger.error).toHaveBeenCalledWith(
      'Email not found in DB',
      expect.objectContaining({ emailId: 'email-1', retryable: false }),
    );
    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'EmailNotFound' }]);
  });

  it('rethrows unknown SES errors for high priority without updating status', async () => {
    const updateEmailStatus = vi.fn();
    const email = makeEmailStatusHistoryItem();
    const { handleHighPriority } = await loadPriorityService({
      getEmailById: vi.fn().mockResolvedValue(email),
      updateEmailStatus,
      sendHighPriorityEmail: vi
        .fn()
        .mockRejectedValue(new Error('unexpected SES failure')),
    });

    await expect(
      handleHighPriority(makeSqsRecord({ emailId: email.emailId })),
    ).rejects.toThrow('unexpected SES failure');
    expect(updateEmailStatus).not.toHaveBeenCalled();
  });
});

describe('priority.service low priority flows', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('discards invalid low priority records and publishes the invalid metric', async () => {
    const { handleLowPriority, rootLogger, publishMetrics } =
      await loadPriorityService();

    await handleLowPriority({ body: 'not-json' } as never);

    expect(rootLogger.error).toHaveBeenCalledWith(
      'Invalid payload, discarding record',
      expect.objectContaining({
        record: expect.objectContaining({ body: 'not-json' }),
      }),
    );
    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'InvalidRecord' }]);
  });

  it('discards schema-invalid low priority records and publishes the invalid metric', async () => {
    const { handleLowPriority, rootLogger, publishMetrics } =
      await loadPriorityService();

    await handleLowPriority(makeSqsRecord({ wrongField: 'value' }));

    expect(rootLogger.error).toHaveBeenCalledWith(
      'Invalid payload, discarding record',
      expect.objectContaining({ errors: expect.any(Array) }),
    );
    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'InvalidRecord' }]);
  });

  it('publishes EmailBatchNotFound and returns early when DB has no records', async () => {
    const { handleLowPriority, namedLogger, publishMetrics } =
      await loadPriorityService({
        getEmailsByRequestId: vi.fn().mockResolvedValue([]),
      });

    await handleLowPriority(makeSqsRecord({ requestId: 'request-1' }));

    expect(namedLogger.error).toHaveBeenCalledWith(
      'Emails not found in DB',
      expect.objectContaining({ requestId: 'request-1', retryable: false }),
    );
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
    const batchUpdateEmailStatuses = vi.fn();
    const { DryRunValidationError } =
      await import('#errors/dryRunValidation.error');
    const { handleLowPriority, publishMetrics } = await loadPriorityService({
      getEmailsByRequestId: vi.fn().mockResolvedValue(emails),
      batchUpdateEmailStatuses,
      sendLowPriorityEmail: vi
        .fn()
        .mockRejectedValue(new DryRunValidationError('invalid batch')),
    });

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
    const batchUpdateEmailStatuses = vi.fn();
    const { handleLowPriority, publishMetrics } = await loadPriorityService({
      getEmailsByRequestId: vi.fn().mockResolvedValue(emails),
      batchUpdateEmailStatuses,
      sendLowPriorityEmail: vi
        .fn()
        .mockRejectedValue(
          new BadRequestException({ message: 'bad request', $metadata: {} }),
        ),
    });

    await handleLowPriority(makeSqsRecord({ requestId: 'request-1' }));

    expect(batchUpdateEmailStatuses).toHaveBeenCalledWith([
      {
        item: emails[0],
        status: EmailStatus.RejectedBySES,
        reason: 'BadRequestException: bad request',
      },
      {
        item: emails[1],
        status: EmailStatus.RejectedBySES,
        reason: 'BadRequestException: bad request',
      },
    ]);
    expect(publishMetrics).toHaveBeenCalledWith([
      { name: 'LowPriorityRejectedBySES', value: 2 },
    ]);
  });
});

describe('priority.service low priority SES entry result flows', () => {
  beforeEach(() => {
    vi.resetModules();
  });

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
    const batchUpdateEmailStatuses = vi.fn();
    const { handleLowPriority, publishMetrics } = await loadPriorityService({
      getEmailsByRequestId: vi.fn().mockResolvedValue(emails),
      batchUpdateEmailStatuses,
      sendLowPriorityEmail: vi.fn().mockResolvedValue({
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
      }),
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
      { name: 'LowPriorityRejectedBySES', value: 0 },
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
    const batchUpdateEmailStatuses = vi.fn();
    const { handleLowPriority, namedLogger, publishMetrics } =
      await loadPriorityService({
        getEmailsByRequestId: vi.fn().mockResolvedValue(emails),
        batchUpdateEmailStatuses,
        sendLowPriorityEmail: vi.fn().mockResolvedValue({
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
        }),
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
        status: EmailStatus.RejectedBySES,
        reason: 'hard failure',
      },
    ]);
    expect(publishMetrics).toHaveBeenCalledWith([
      { name: 'LowPriorityDispatched', value: 1 },
      { name: 'LowPriorityRejectedBySES', value: 1 },
      { name: 'LowPriorityRetryableFailure', value: 0 },
    ]);
    expect(namedLogger.info).toHaveBeenCalledWith('End');
  });

  it('rethrows unknown SES errors for low priority without updating statuses', async () => {
    const emails = [
      makeEmailStatusHistoryItem({
        emailId: 'email-1',
        priority: EmailPriority.LOW,
      }),
    ];
    const batchUpdateEmailStatuses = vi.fn();
    const { handleLowPriority } = await loadPriorityService({
      getEmailsByRequestId: vi.fn().mockResolvedValue(emails),
      batchUpdateEmailStatuses,
      sendLowPriorityEmail: vi
        .fn()
        .mockRejectedValue(new Error('unexpected SES failure')),
    });

    await expect(
      handleLowPriority(makeSqsRecord({ requestId: 'request-1' })),
    ).rejects.toThrow('unexpected SES failure');
    expect(batchUpdateEmailStatuses).not.toHaveBeenCalled();
  });
});
