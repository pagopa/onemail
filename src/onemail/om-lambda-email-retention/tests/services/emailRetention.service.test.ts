import {
  computeExpirationTime,
  dynamoStreamRecordHandler,
  handleFinalizedEmail,
  toFinalizedEmail,
} from '#services/emailRetention.service';
import { FINAL_EMAIL_STATUSES } from '#utils/constants';
import { EmailPriority, EmailStatus } from 'om-common/types';
import { describe, expect, it, vi } from 'vitest';

import { makeStreamImage, makeStreamRecord } from '../__helpers__/fixtures.js';

const setEmailExpirationTime = vi.hoisted(() => vi.fn());
const hasOpenEmailsInRequest = vi.hoisted(() => vi.fn());
const deleteAttachments = vi.hoisted(() => vi.fn());

vi.mock('#repositories/email.repository', () => ({
  setEmailExpirationTime,
  hasOpenEmailsInRequest,
}));
vi.mock('#repositories/attachment.repository', () => ({
  deleteAttachments,
}));

const NOW_MS = Date.UTC(2026, 9, 14, 10, 0, 0);
const NOW_SECONDS = NOW_MS / 1000;
const FIVE_DAYS_SECONDS = 5 * 86400;

describe('computeExpirationTime', () => {
  it('adds the retention days to now in epoch seconds', () => {
    expect(computeExpirationTime(NOW_MS, 5)).toBe(
      NOW_SECONDS + FIVE_DAYS_SECONDS,
    );
  });

  it('floors milliseconds to whole seconds', () => {
    expect(computeExpirationTime(NOW_MS + 999, 1)).toBe(NOW_SECONDS + 86400);
  });
});

describe('toFinalizedEmail', () => {
  it.each(FINAL_EMAIL_STATUSES)(
    'maps an email in final status %s',
    (status) => {
      expect(toFinalizedEmail(makeStreamImage({ status }))).toEqual({
        emailId: 'email-1',
        requestId: 'request-1',
        priority: EmailPriority.HIGH,
        status,
        attachmentKeys: ['tenant/attachment-1/file.pdf'],
      });
    },
  );

  it.each([
    EmailStatus.Queued,
    EmailStatus.Dispatched,
    EmailStatus.SoftBounce,
    'UnknownStatus',
  ])('returns undefined for non-final status %s', (status) => {
    expect(toFinalizedEmail(makeStreamImage({ status }))).toBeUndefined();
  });

  it('returns undefined when emailId is missing', () => {
    const image: Record<string, unknown> = makeStreamImage();
    delete image['emailId'];

    expect(toFinalizedEmail(image)).toBeUndefined();
  });

  it('returns undefined when the image is missing', () => {
    expect(toFinalizedEmail(undefined)).toBeUndefined();
  });

  it('returns no attachment keys when the content has no attachments', () => {
    const image: Record<string, unknown> = makeStreamImage();
    delete image['content'];

    expect(toFinalizedEmail(image)?.attachmentKeys).toEqual([]);
  });
});

describe('handleFinalizedEmail', () => {
  const finalizedEmail = (overrides = {}) => ({
    emailId: 'email-1',
    requestId: 'request-1',
    priority: EmailPriority.HIGH,
    status: EmailStatus.Delivered,
    attachmentKeys: ['tenant/attachment-1/file.pdf'],
    ...overrides,
  });

  it('sets the expiration time to now plus the configured retention', async () => {
    setEmailExpirationTime.mockResolvedValue(true);

    await handleFinalizedEmail(finalizedEmail({ attachmentKeys: [] }), NOW_MS);

    expect(setEmailExpirationTime).toHaveBeenCalledWith(
      'email-1',
      NOW_SECONDS + FIVE_DAYS_SECONDS,
    );
  });

  it('still deletes the attachments when the expiration time was already set', async () => {
    setEmailExpirationTime.mockResolvedValue(false);

    await handleFinalizedEmail(finalizedEmail(), NOW_MS);

    expect(deleteAttachments).toHaveBeenCalledWith([
      'tenant/attachment-1/file.pdf',
    ]);
  });

  it('deletes high-priority attachments without checking the request', async () => {
    setEmailExpirationTime.mockResolvedValue(true);
    const keys = ['tenant/a1/one.pdf', 'tenant/a2/two.pdf'];

    await handleFinalizedEmail(
      finalizedEmail({ attachmentKeys: keys }),
      NOW_MS,
    );

    expect(hasOpenEmailsInRequest).not.toHaveBeenCalled();
    expect(deleteAttachments).toHaveBeenCalledWith(keys);
  });

  it('does not touch S3 when the email has no attachments', async () => {
    setEmailExpirationTime.mockResolvedValue(true);

    await handleFinalizedEmail(finalizedEmail({ attachmentKeys: [] }), NOW_MS);

    expect(hasOpenEmailsInRequest).not.toHaveBeenCalled();
    expect(deleteAttachments).not.toHaveBeenCalled();
  });

  it('keeps low-priority attachments while other emails of the request are open', async () => {
    setEmailExpirationTime.mockResolvedValue(true);
    hasOpenEmailsInRequest.mockResolvedValue(true);

    await handleFinalizedEmail(
      finalizedEmail({ priority: EmailPriority.LOW }),
      NOW_MS,
    );

    expect(hasOpenEmailsInRequest).toHaveBeenCalledWith('request-1', 'email-1');
    expect(deleteAttachments).not.toHaveBeenCalled();
  });

  it('deletes low-priority attachments when the whole request is finalized', async () => {
    setEmailExpirationTime.mockResolvedValue(true);
    hasOpenEmailsInRequest.mockResolvedValue(false);

    await handleFinalizedEmail(
      finalizedEmail({
        priority: EmailPriority.LOW,
        status: EmailStatus.MaxRetriesReached,
      }),
      NOW_MS,
    );

    expect(deleteAttachments).toHaveBeenCalledWith([
      'tenant/attachment-1/file.pdf',
    ]);
  });

  it('keeps low-priority attachments when the requestId is missing', async () => {
    setEmailExpirationTime.mockResolvedValue(true);

    await handleFinalizedEmail(
      finalizedEmail({ priority: EmailPriority.LOW, requestId: undefined }),
      NOW_MS,
    );

    expect(hasOpenEmailsInRequest).not.toHaveBeenCalled();
    expect(deleteAttachments).not.toHaveBeenCalled();
  });

  it('propagates attachment deletion errors so the record is retried', async () => {
    setEmailExpirationTime.mockResolvedValue(true);
    deleteAttachments.mockRejectedValueOnce(new Error('S3 unavailable'));

    await expect(
      handleFinalizedEmail(finalizedEmail(), NOW_MS),
    ).rejects.toThrow('S3 unavailable');
  });
});

describe('dynamoStreamRecordHandler', () => {
  it('processes a MODIFY record of a finalized email', async () => {
    setEmailExpirationTime.mockResolvedValue(true);

    await dynamoStreamRecordHandler(makeStreamRecord('100'));

    expect(setEmailExpirationTime).toHaveBeenCalledWith(
      'email-1',
      expect.any(Number),
    );
  });

  it('skips records that are not MODIFY events', async () => {
    await dynamoStreamRecordHandler(makeStreamRecord('100', {}, 'REMOVE'));

    expect(setEmailExpirationTime).not.toHaveBeenCalled();
  });

  it('skips records of emails that are not finalized', async () => {
    await dynamoStreamRecordHandler(
      makeStreamRecord('100', { status: EmailStatus.SoftBounce }),
    );

    expect(setEmailExpirationTime).not.toHaveBeenCalled();
  });
});
