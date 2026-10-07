import { sqsEventHandler } from '#services/emailStatus.service';
import {
  CapitalizedSesBounceSubType,
  CapitalizedSesBounceType,
  CapitalizedSesConfigurationSetEventType,
} from '#types/ses.type';
import { RetryableEventError } from 'om-common/errors';
import { EmailStatus } from 'om-common/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  makeBounceEvent,
  makeComplaintEvent,
  makeDeliveryEvent,
  makeEmailStatusHistoryItem,
  makeQueueRecord,
  makeRejectEvent,
  makeRenderingFailureEvent,
} from '../__helpers__/fixtures.js';

const findEmailByProviderMessageId = vi.hoisted(() => vi.fn());
const updateEmailStatus = vi.hoisted(() => vi.fn());
const handleSoftBounceRetry = vi.hoisted(() => vi.fn());
const publishMetrics = vi.hoisted(() => vi.fn());
const addToBlacklist = vi.hoisted(() => vi.fn());

vi.mock('#repositories/email.repository', () => ({
  findEmailByProviderMessageId,
  updateEmailStatus,
}));
vi.mock('#repositories/blacklist.repository', () => ({
  addToBlacklist,
}));
vi.mock('#services/bounceRetry.service', () => ({
  handleSoftBounceRetry,
}));
vi.mock('om-common/repositories', () => ({
  ConfigSetProcessorMetricName: {
    InvalidRecord: 'InvalidRecord',
    EmailNotFound: 'EmailNotFound',
    EmailAlreadyQueued: 'EmailAlreadyQueued',
    EmailDelivered: 'EmailDelivered',
    EmailHardBounce: 'EmailHardBounce',
    EmailNonRetryableSoftBounce: 'EmailNonRetryableSoftBounce',
    EmailComplaint: 'EmailComplaint',
    EmailRejected: 'EmailRejected',
    EmailRenderingFailure: 'EmailRenderingFailure',
    UnexpectedRetryableError: 'UnexpectedRetryableError',
    ExhaustedInternalRetries: 'ExhaustedInternalRetries',
  },
  publishMetrics,
}));

beforeEach(() => {
  addToBlacklist.mockResolvedValue(undefined);
});

describe('emailStatus.service validation and guard clauses', () => {
  it('discards records with empty body and publishes InvalidRecord', async () => {
    await sqsEventHandler({ body: '' } as never);

    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'InvalidRecord' }]);
    expect(findEmailByProviderMessageId).not.toHaveBeenCalled();
  });

  it('discards records with non-JSON body and publishes InvalidRecord', async () => {
    await sqsEventHandler({ body: 'not-json' } as never);

    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'InvalidRecord' }]);
  });

  it('discards records with an unknown eventType silently', async () => {
    await sqsEventHandler(
      makeQueueRecord({
        eventType: 'UnknownEvent' as CapitalizedSesConfigurationSetEventType,
        mail: { timestamp: '2025-01-01T00:00:00Z', messageId: 'msg-1' },
      }),
    );

    expect(publishMetrics).not.toHaveBeenCalled();
    expect(findEmailByProviderMessageId).not.toHaveBeenCalled();
  });

  it('discards records with a known eventType but invalid schema and publishes InvalidRecord', async () => {
    await sqsEventHandler(
      makeQueueRecord({
        eventType: CapitalizedSesConfigurationSetEventType.Delivery,
        // missing mail and delivery fields
      }),
    );

    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'InvalidRecord' }]);
  });

  it('throws a retryable error when no email record matches the SES message id', async () => {
    findEmailByProviderMessageId.mockResolvedValue(undefined);

    await expect(
      sqsEventHandler(makeQueueRecord(makeDeliveryEvent('ses-msg-1'))),
    ).rejects.toBeInstanceOf(RetryableEventError);

    expect(findEmailByProviderMessageId).toHaveBeenCalledWith('ses-msg-1');
    expect(publishMetrics).toHaveBeenCalledWith([{ name: 'EmailNotFound' }]);
    expect(updateEmailStatus).not.toHaveBeenCalled();
  });

  it('publishes EmailAlreadyQueued and skips processing when email is already Queued', async () => {
    const email = makeEmailStatusHistoryItem({ status: EmailStatus.Queued });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(makeQueueRecord(makeDeliveryEvent()));

    expect(publishMetrics).toHaveBeenCalledWith([
      { name: 'EmailAlreadyQueued' },
    ]);
    expect(updateEmailStatus).not.toHaveBeenCalled();
  });

  it('extracts event from EventBridge detail wrapper', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(makeQueueRecord(makeDeliveryEvent('ses-msg-1')));

    expect(findEmailByProviderMessageId).toHaveBeenCalledWith('ses-msg-1');
    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: '2025-01-01T00:00:00Z',
          status: EmailStatus.Delivered,
        },
      ],
    );
  });
});

describe('emailStatus.service max internal attempts', () => {
  it('marks an unfinished email as EventProcessingFailed after exhausting non-delivery processing attempts', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler({
      ...makeQueueRecord(makeComplaintEvent()),
      attributes: { ApproximateReceiveCount: '4' },
    } as never);

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: expect.any(String),
          status: EmailStatus.EventProcessingFailed,
          reason: 'Max internal event processing retries exceeded',
        },
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'ExhaustedInternalRetries',
        dimensions: { tenantName: email.tenantName, clientId: email.clientId },
      },
    ]);
    expect(handleSoftBounceRetry).not.toHaveBeenCalled();
  });

  it.each([
    EmailStatus.Delivered,
    EmailStatus.HardBounce,
    EmailStatus.Complaint,
    EmailStatus.Rejected,
    EmailStatus.NonRetryableSoftBounce,
    EmailStatus.MaxRetriesReached,
    EmailStatus.Queued,
    EmailStatus.EventProcessingFailed,
  ])(
    'marks %s as EventProcessingFailed when non-delivery processing attempts are exhausted',
    async (status) => {
      findEmailByProviderMessageId.mockResolvedValue(
        makeEmailStatusHistoryItem({ status }),
      );

      await sqsEventHandler({
        ...makeQueueRecord(makeComplaintEvent()),
        attributes: { ApproximateReceiveCount: '4' },
      } as never);

      expect(updateEmailStatus).toHaveBeenCalledTimes(1);
      expect(updateEmailStatus).toHaveBeenCalledWith('email-1', status, [
        {
          timestamp: expect.any(String),
          status: EmailStatus.EventProcessingFailed,
          reason: 'Max internal event processing retries exceeded',
        },
      ]);
      expect(publishMetrics).toHaveBeenCalledWith([
        {
          name: 'ExhaustedInternalRetries',
          dimensions: { tenantName: 'tenant-1', clientId: 'client-1' },
        },
      ]);
    },
  );

  it('retries a missing email at the receive-count limit', async () => {
    findEmailByProviderMessageId.mockResolvedValue(undefined);
    const record = {
      ...makeQueueRecord(makeDeliveryEvent('ses-msg-1')),
      attributes: { ApproximateReceiveCount: '3' },
    } as never;

    await expect(sqsEventHandler(record)).rejects.toMatchObject({
      name: 'RetryableEventError',
      context: { providerMessageId: 'ses-msg-1', attempt: 3 },
    });
    expect(updateEmailStatus).not.toHaveBeenCalled();
  });

  it('discards a missing email after the receive-count limit without updating DynamoDB', async () => {
    findEmailByProviderMessageId.mockResolvedValue(undefined);
    const record = {
      ...makeQueueRecord(makeDeliveryEvent()),
      attributes: { ApproximateReceiveCount: '4' },
    } as never;

    await expect(sqsEventHandler(record)).resolves.toBeUndefined();
    expect(updateEmailStatus).not.toHaveBeenCalled();
    expect(publishMetrics).toHaveBeenCalledWith([
      { name: 'ExhaustedInternalRetries' },
    ]);
  });

  it('processes an email that becomes visible on the next delivery', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(email);
    const record = makeQueueRecord(makeDeliveryEvent());

    await expect(sqsEventHandler(record)).rejects.toBeInstanceOf(
      RetryableEventError,
    );
    await sqsEventHandler({
      ...record,
      attributes: { ...record.attributes, ApproximateReceiveCount: '2' },
    });

    expect(updateEmailStatus).toHaveBeenCalledTimes(1);
    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [expect.objectContaining({ status: EmailStatus.Delivered })],
    );
  });

  it('processes normally when currentAttempt is at the limit', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    const record = {
      ...makeQueueRecord(makeDeliveryEvent()),
      attributes: { ApproximateReceiveCount: '3' },
    } as never;

    await sqsEventHandler(record);

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [expect.objectContaining({ status: EmailStatus.Delivered })],
    );
  });

  it('records Delivery with the SES timestamp when max attempts are exceeded', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    const record = {
      ...makeQueueRecord(makeDeliveryEvent()),
      attributes: { ApproximateReceiveCount: '4' },
    } as never;

    await sqsEventHandler(record);

    expect(updateEmailStatus).toHaveBeenCalledTimes(1);
    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: '2025-01-01T00:00:00Z',
          status: EmailStatus.Delivered,
        },
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'ExhaustedInternalRetries',
        dimensions: { tenantName: 'tenant-1', clientId: 'client-1' },
      },
    ]);
  });
});

describe('emailStatus.service delivery flow', () => {
  it('updates email status to Delivered and publishes EmailDelivered', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(makeDeliveryEvent('ses-msg-1', '2025-06-01T12:00:00Z')),
    );

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [{ timestamp: '2025-06-01T12:00:00Z', status: EmailStatus.Delivered }],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'EmailDelivered',
        dimensions: { tenantName: 'tenant-1', clientId: 'client-1' },
      },
    ]);
  });
});

describe('emailStatus.service bounce flow', () => {
  it('delegates transient bounce to handleSoftBounceRetry', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeBounceEvent(
          'ses-msg-1',
          CapitalizedSesBounceType.Transient,
          CapitalizedSesBounceSubType.MailboxFull,
          '2025-06-01T12:00:00Z',
        ),
      ),
    );

    expect(handleSoftBounceRetry).toHaveBeenCalledWith(
      email,
      '2025-06-01T12:00:00Z',
      CapitalizedSesBounceSubType.MailboxFull,
    );
    expect(updateEmailStatus).not.toHaveBeenCalled();
  });

  it('delegates transient General bounce to handleSoftBounceRetry', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeBounceEvent(
          'ses-msg-1',
          CapitalizedSesBounceType.Transient,
          CapitalizedSesBounceSubType.General,
          '2025-06-01T12:00:00Z',
        ),
      ),
    );

    expect(handleSoftBounceRetry).toHaveBeenCalledWith(
      email,
      '2025-06-01T12:00:00Z',
      CapitalizedSesBounceSubType.General,
    );
    expect(updateEmailStatus).not.toHaveBeenCalled();
  });

  it('delegates undetermined bounce to handleSoftBounceRetry', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeBounceEvent(
          'ses-msg-1',
          CapitalizedSesBounceType.Undetermined,
          CapitalizedSesBounceSubType.Undetermined,
        ),
      ),
    );

    expect(handleSoftBounceRetry).toHaveBeenCalledWith(
      email,
      '2025-01-01T00:00:00Z',
      CapitalizedSesBounceSubType.Undetermined,
    );
  });

  it('updates email status to HardBounce on permanent bounce and publishes metric', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeBounceEvent(
          'ses-msg-1',
          CapitalizedSesBounceType.Permanent,
          CapitalizedSesBounceSubType.General,
          '2025-06-01T12:00:00Z',
        ),
      ),
    );

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: '2025-06-01T12:00:00Z',
          status: EmailStatus.HardBounce,
          reason: CapitalizedSesBounceSubType.General,
        },
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'EmailHardBounce',
        dimensions: { tenantName: 'tenant-1', clientId: 'client-1' },
      },
    ]);
  });
});

describe('emailStatus.service non-retryable bounce flow', () => {
  it.each([
    CapitalizedSesBounceSubType.ContentRejected,
    CapitalizedSesBounceSubType.AttachmentRejected,
    CapitalizedSesBounceSubType.MessageTooLarge,
  ])('treats transient %s as NonRetryableSoftBounce', async (subType) => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeBounceEvent(
          'ses-msg-1',
          CapitalizedSesBounceType.Transient,
          subType,
          '2025-06-01T12:00:00Z',
        ),
      ),
    );

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: '2025-06-01T12:00:00Z',
          status: EmailStatus.NonRetryableSoftBounce,
          reason: subType,
        },
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'EmailNonRetryableSoftBounce',
        dimensions: { tenantName: 'tenant-1', clientId: 'client-1' },
      },
    ]);
    expect(handleSoftBounceRetry).not.toHaveBeenCalled();
  });

  it.each([
    'smtp; 550 5.1.1 Remote MTA does not support STARTTLS. Message can be delivered only over a TLS connection.',
    'smtp; 554 5.4.14 Hop count exceeded - possible mail loop ATTR34',
  ])('does not retry a bounce with diagnostic %s', async (diagnosticCode) => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeBounceEvent(
          'ses-msg-1',
          CapitalizedSesBounceType.Transient,
          CapitalizedSesBounceSubType.General,
          '2025-06-01T12:00:00Z',
          diagnosticCode,
        ),
      ),
    );

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: '2025-06-01T12:00:00Z',
          status: EmailStatus.NonRetryableSoftBounce,
          reason: CapitalizedSesBounceSubType.General,
        },
      ],
    );
    expect(handleSoftBounceRetry).not.toHaveBeenCalled();
  });

  it('keeps a permanent bounce as HardBounce when its diagnostic matches', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeBounceEvent(
          'ses-msg-1',
          CapitalizedSesBounceType.Permanent,
          CapitalizedSesBounceSubType.General,
          '2025-06-01T12:00:00Z',
          'smtp; Remote MTA does not support STARTTLS',
        ),
      ),
    );

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: '2025-06-01T12:00:00Z',
          status: EmailStatus.HardBounce,
          reason: CapitalizedSesBounceSubType.General,
        },
      ],
    );
    expect(handleSoftBounceRetry).not.toHaveBeenCalled();
  });
});

describe('emailStatus.service blacklist flow', () => {
  it('blacklists every bounced recipient on a hard bounce', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeBounceEvent(
          'ses-msg-1',
          CapitalizedSesBounceType.Permanent,
          CapitalizedSesBounceSubType.General,
          '2025-06-01T12:00:00Z',
          undefined,
          ['first@example.com', 'second@example.com'],
        ),
      ),
    );

    expect(addToBlacklist).toHaveBeenCalledTimes(2);
    expect(addToBlacklist).toHaveBeenCalledWith({
      emailAddress: 'first@example.com',
      tenantName: email.tenantName,
    });
    expect(addToBlacklist).toHaveBeenCalledWith({
      emailAddress: 'second@example.com',
      tenantName: email.tenantName,
    });
  });

  it.each([
    CapitalizedSesBounceSubType.Suppressed,
    CapitalizedSesBounceSubType.OnAccountSuppressionList,
  ])('blacklists permanent sub-type %s as well', async (subType) => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeBounceEvent(
          'ses-msg-1',
          CapitalizedSesBounceType.Permanent,
          subType,
          '2025-06-01T12:00:00Z',
        ),
      ),
    );

    expect(addToBlacklist).toHaveBeenCalledTimes(1);
  });

  it.each([
    [CapitalizedSesBounceType.Transient, CapitalizedSesBounceSubType.General],
    [
      CapitalizedSesBounceType.Transient,
      CapitalizedSesBounceSubType.ContentRejected,
    ],
    [
      CapitalizedSesBounceType.Undetermined,
      CapitalizedSesBounceSubType.Undetermined,
    ],
  ])('does not blacklist a %s/%s bounce', async (bounceType, subType) => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeBounceEvent(
          'ses-msg-1',
          bounceType,
          subType,
          '2025-06-01T12:00:00Z',
        ),
      ),
    );

    expect(addToBlacklist).not.toHaveBeenCalled();
  });

  it('keeps processing the record when the blacklist write fails', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);
    addToBlacklist.mockRejectedValue(new Error('Throttled'));

    await expect(
      sqsEventHandler(
        makeQueueRecord(
          makeBounceEvent(
            'ses-msg-1',
            CapitalizedSesBounceType.Permanent,
            CapitalizedSesBounceSubType.General,
            '2025-06-01T12:00:00Z',
          ),
        ),
      ),
    ).resolves.toBeUndefined();

    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'EmailHardBounce',
        dimensions: { tenantName: 'tenant-1', clientId: 'client-1' },
      },
    ]);
  });
});

describe('emailStatus.service complaint flow', () => {
  it('updates email status to Complaint and publishes metric', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeComplaintEvent('ses-msg-1', '2025-06-01T12:00:00Z', 'abuse'),
      ),
    );

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: '2025-06-01T12:00:00Z',
          status: EmailStatus.Complaint,
          reason: 'abuse',
        },
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'EmailComplaint',
        dimensions: { tenantName: 'tenant-1', clientId: 'client-1' },
      },
    ]);
  });

  it('passes undefined reason when complaintSubType is null', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(makeComplaintEvent('ses-msg-1', '2025-06-01T12:00:00Z')),
    );

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        {
          timestamp: '2025-06-01T12:00:00Z',
          status: EmailStatus.Complaint,
          reason: undefined,
        },
      ],
    );
  });
});

describe('emailStatus.service reject flow', () => {
  it('updates email status to Rejected with reason and publishes metric', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(makeRejectEvent('ses-msg-1', 'Bad content')),
    );

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        expect.objectContaining({
          status: EmailStatus.Rejected,
          reason: 'Bad content',
        }),
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'EmailRejected',
        dimensions: { tenantName: 'tenant-1', clientId: 'client-1' },
      },
    ]);
  });

  it('uses fallback reason when reject reason is null', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(makeQueueRecord(makeRejectEvent('ses-msg-1', null)));

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        expect.objectContaining({
          status: EmailStatus.Rejected,
          reason: 'Bad content',
        }),
      ],
    );
  });
});

describe('emailStatus.service retryable error flow', () => {
  it('propagates updateEmailStatus rejection as-is (SQS retries the record)', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);
    const cause = new Error('DynamoDB timeout');
    updateEmailStatus.mockRejectedValueOnce(cause);

    await expect(
      sqsEventHandler(makeQueueRecord(makeDeliveryEvent('ses-msg-retry'))),
    ).rejects.toThrow(cause);
  });
});

describe('emailStatus.service rendering failure flow', () => {
  it('updates email status to Rejected with template failure reason and publishes metric', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeRenderingFailureEvent('ses-msg-1', 'my-template', 'missing var'),
      ),
    );

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        expect.objectContaining({
          status: EmailStatus.Rejected,
          reason: 'Template rendering failure "my-template": missing var',
        }),
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'EmailRenderingFailure',
        dimensions: { tenantName: 'tenant-1', clientId: 'client-1' },
      },
    ]);
  });

  it('omits error suffix when errorMessage is null', async () => {
    const email = makeEmailStatusHistoryItem({
      status: EmailStatus.Dispatched,
    });
    findEmailByProviderMessageId.mockResolvedValue(email);

    await sqsEventHandler(
      makeQueueRecord(
        makeRenderingFailureEvent('ses-msg-1', 'my-template', null),
      ),
    );

    expect(updateEmailStatus).toHaveBeenCalledWith(
      email.emailId,
      email.status,
      [
        expect.objectContaining({
          status: EmailStatus.Rejected,
          reason: 'Template rendering failure "my-template"',
        }),
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'EmailRenderingFailure',
        dimensions: { tenantName: 'tenant-1', clientId: 'client-1' },
      },
    ]);
  });
});
