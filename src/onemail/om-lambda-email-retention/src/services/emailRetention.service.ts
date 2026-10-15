import type { FinalizedEmail } from '#types/finalizedEmail.type';
import type { DynamoDBRecord } from 'aws-lambda';

import env from '#config/env';
import { getNamedLogger } from '#config/logger';
import { EmailStreamImageSchema } from '#dtos/emailStreamImage.dto';
import { deleteAttachments } from '#repositories/attachment.repository';
import {
  hasOpenEmailsInRequest,
  setEmailExpirationTime,
} from '#repositories/email.repository';
import { FINAL_EMAIL_STATUSES, SECONDS_PER_DAY } from '#utils/constants';
import { EmailPriority } from 'om-common/types';

export const computeExpirationTime = (
  nowMs: number,
  retentionDays: number,
): number => Math.floor(nowMs / 1000) + retentionDays * SECONDS_PER_DAY;

/**
 * Maps a stream NewImage to a finalized email.
 * Returns undefined when the image is not an email in a final status.
 */
export const toFinalizedEmail = (
  newImage: unknown,
): FinalizedEmail | undefined => {
  const parsed = EmailStreamImageSchema.safeParse(newImage);
  if (!parsed.success) return undefined;

  const image = parsed.data;
  if (!FINAL_EMAIL_STATUSES.includes(image.status.S)) return undefined;

  return {
    emailId: image.emailId.S,
    requestId: image.requestId?.S,
    priority: image.priority.S,
    status: image.status.S,
    attachmentKeys: (image.content?.M.attachments?.L ?? []).map(
      (attachment) => attachment.M.s3Key.S,
    ),
  };
};

// Low-priority attachments are shared by every email of the same request.
const canDeleteAttachments = async (
  email: FinalizedEmail,
): Promise<boolean> => {
  const logger = getNamedLogger(canDeleteAttachments.name);

  if (email.priority === EmailPriority.HIGH) return true;

  if (!email.requestId) {
    logger.warn('⚠️ Attachments kept: missing requestId', {
      emailId: email.emailId,
    });
    return false;
  }

  const hasOpenEmails = await hasOpenEmailsInRequest(
    email.requestId,
    email.emailId,
  );
  if (hasOpenEmails) {
    logger.info('⏸️ Attachments kept: request still has open emails', {
      emailId: email.emailId,
      requestId: email.requestId,
    });
    return false;
  }

  return true;
};

export const handleFinalizedEmail = async (
  email: FinalizedEmail,
  nowMs: number = Date.now(),
): Promise<void> => {
  const logger = getNamedLogger(handleFinalizedEmail.name);

  const expirationTime = computeExpirationTime(nowMs, env.emailRetentionDays);
  const expirationSet = await setEmailExpirationTime(
    email.emailId,
    expirationTime,
  );
  logger.info(
    expirationSet
      ? '⏳ Expiration time set'
      : 'ℹ️ Expiration time already set or email not found',
    { emailId: email.emailId, status: email.status, expirationTime },
  );

  if (email.attachmentKeys.length === 0) return;

  const deletable = await canDeleteAttachments(email);
  if (!deletable) return;

  await deleteAttachments(email.attachmentKeys);
  logger.info('🗑️ Attachments deleted', {
    emailId: email.emailId,
    requestId: email.requestId,
    attachmentCount: email.attachmentKeys.length,
  });
};

export const dynamoStreamRecordHandler = async (
  record: DynamoDBRecord,
): Promise<void> => {
  const logger = getNamedLogger(dynamoStreamRecordHandler.name);
  const sequenceNumber = record.dynamodb?.SequenceNumber;

  if (record.eventName !== 'MODIFY') {
    logger.info('⏭️ Record skipped: not a MODIFY event', {
      sequenceNumber,
      eventName: record.eventName,
    });
    return;
  }

  const email = toFinalizedEmail(record.dynamodb?.NewImage);
  if (!email) {
    logger.info('⏭️ Record skipped: not a finalized email', {
      sequenceNumber,
    });
    return;
  }

  await handleFinalizedEmail(email);
};
