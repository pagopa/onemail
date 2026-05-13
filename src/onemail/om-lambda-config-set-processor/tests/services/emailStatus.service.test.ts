import { sqsEventHandler } from '#services/emailStatus.service';
import {
  CapitalizedSesBounceSubType,
  CapitalizedSesBounceType,
  CapitalizedSesConfigurationSetEventType,
} from '#types/ses.type';
import { EmailStatus } from 'om-common/types';
import { describe, expect, it, vi } from 'vitest';

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

vi.mock('#repositories/email.repository', () => ({
  findEmailByProviderMessageId,
  updateEmailStatus,
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

  it('publishes EmailNotFound when no email record matches the SES message id', async () => {
    findEmailByProviderMessageId.mockResolvedValue(undefined);

    await sqsEventHandler(makeQueueRecord(makeDeliveryEvent('ses-msg-1')));

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

  it('escalates to Rejected and publishes ExhaustedInternalRetries when max attempts exceeded', async () => {
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
          timestamp: expect.any(String),
          status: EmailStatus.Rejected,
          reason: 'Max internal retries exceeded',
        },
      ],
    );
    expect(publishMetrics).toHaveBeenCalledWith([
      {
        name: 'ExhaustedInternalRetries',
        dimensions: { tenantName: 'tenant-1' },
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
      { name: 'EmailDelivered', dimensions: { tenantName: 'tenant-1' } },
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
      { name: 'EmailHardBounce', dimensions: { tenantName: 'tenant-1' } },
    ]);
  });

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
        dimensions: { tenantName: 'tenant-1' },
      },
    ]);
    expect(handleSoftBounceRetry).not.toHaveBeenCalled();
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
      { name: 'EmailComplaint', dimensions: { tenantName: 'tenant-1' } },
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
      { name: 'EmailRejected', dimensions: { tenantName: 'tenant-1' } },
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
      { name: 'EmailRenderingFailure', dimensions: { tenantName: 'tenant-1' } },
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
      { name: 'EmailRenderingFailure', dimensions: { tenantName: 'tenant-1' } },
    ]);
  });
});
