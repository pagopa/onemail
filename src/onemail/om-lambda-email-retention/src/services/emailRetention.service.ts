import type { FinalizedEmail } from '#types/finalizedEmail.type';
import type { DynamoDBRecord } from 'aws-lambda';

import env from '#config/env';
import { getNamedLogger } from '#config/logger';
import {
  EmailStreamImage,
  EmailStreamImageSchema,
} from '#dtos/emailStreamImage.dto';
import { deleteAttachments } from '#repositories/attachment.repository';
import {
  hasNonFinalEmailsInRequest,
  setEmailExpirationTime,
} from '#repositories/email.repository';
import { FINAL_EMAIL_STATUSES, SECONDS_PER_DAY } from '#utils/constants';
import { PermanentEventError } from 'om-common/errors';
import { EmailPriority } from 'om-common/types';

export const computeExpirationTime = (
  nowMs: number,
  retentionDays: number,
): number => Math.floor(nowMs / 1000) + retentionDays * SECONDS_PER_DAY;

/**
 * Parses a DynamoDB stream record into an EmailStreamImage.
 */
const parseEmailEventFromRecord = (
  record: DynamoDBRecord,
): EmailStreamImage => {
  const parsed = EmailStreamImageSchema.safeParse(record.dynamodb?.NewImage);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((issue) => `${issue.path.join('.')} - ${issue.message}`)
      .join('; ');

    throw new PermanentEventError('Invalid DynamoDB stream image', {
      error,
    });
  }

  return parsed.data;
};

/**
 * Maps an EmailStreamImage to a FinalizedEmail skipping non-final statuses.
 */
export const toFinalizedEmail = (
  emailStreamImage: EmailStreamImage,
): FinalizedEmail => {
  // Additional check: emails with non-final statuses should not be handled because they are filtered by infrastructure.
  if (!FINAL_EMAIL_STATUSES.includes(emailStreamImage.status.S)) {
    throw new PermanentEventError('Email stream image has a non-final status', {
      emailId: emailStreamImage.emailId.S,
      error: `Unexpected status: ${emailStreamImage.status.S}`,
    });
  }

  return {
    emailId: emailStreamImage.emailId.S,
    requestId: emailStreamImage.requestId.S,
    priority: emailStreamImage.priority.S,
    status: emailStreamImage.status.S,
    attachmentKeys: (emailStreamImage.content?.M.attachments?.L ?? []).map(
      (attachment) => attachment.M.s3Key.S,
    ),
  };
};

/**
 * Determines whether the attachments of a finalized email can be deleted.
 * High-priority emails can always have their attachments deleted.
 * Low-priority emails can only have their attachments deleted if there are no non-final emails in the same request.
 */
const canDeleteAttachments = async (
  email: FinalizedEmail,
): Promise<boolean> => {
  const logger = getNamedLogger(canDeleteAttachments.name);

  if (email.priority === EmailPriority.HIGH) return true;

  // Low priority: check if there are any non-final emails in the same request before deleting attachments.
  // if there are non-final emails, attachments should not be deleted and will be kept until all emails in the request are finalized.
  const hasNonFinalEmails = await hasNonFinalEmailsInRequest(
    email.requestId,
    email.emailId,
  );
  if (hasNonFinalEmails) {
    logger.debug('Attachments kept: request still has non-final emails', {
      emailId: email.emailId,
      requestId: email.requestId,
    });
    return false;
  }

  return true;
};

/**
 * Handles a finalized email by setting its expiration time and deleting attachments if applicable.
 */
export const handleFinalizedEmail = async (
  email: FinalizedEmail,
): Promise<void> => {
  const logger = getNamedLogger(handleFinalizedEmail.name);

  const expirationTime = computeExpirationTime(
    Date.now(),
    env.emailRetentionDays,
  );
  const isExpirationSet = await setEmailExpirationTime(
    email.emailId,
    expirationTime,
  );
  logger.info(
    isExpirationSet
      ? 'Expiration time set'
      : 'Expiration time already set or email not found',
    { emailId: email.emailId, status: email.status, expirationTime },
  );

  if (email.attachmentKeys.length === 0) return;

  const deletable = await canDeleteAttachments(email);
  if (!deletable) return;

  await deleteAttachments(email.attachmentKeys);
  logger.info('Attachments deleted', {
    emailId: email.emailId,
    requestId: email.requestId,
    attachmentCount: email.attachmentKeys.length,
  });
};

export const dynamoStreamRecordHandler = async (
  record: DynamoDBRecord,
): Promise<void> => {
  const logger = getNamedLogger(dynamoStreamRecordHandler.name);

  // skip insert and remove events
  if (record.eventName !== 'MODIFY') {
    return;
  }

  try {
    const emailEvent = parseEmailEventFromRecord(record);
    const email = toFinalizedEmail(emailEvent);
    await handleFinalizedEmail(email);
  } catch (error) {
    // For permanent errors swallow the error to avoid retries
    if (error instanceof PermanentEventError) {
      if (!error.context.silent) {
        logger.error(`Permanent error: ${error.message}`, {
          ...error.context,
          sequenceNumber: record.dynamodb?.SequenceNumber,
          retryable: false,
        });
      }
      return;
    }
    // For other errors (retryable) just re-throw to trigger the retry mechanism of the batch processor
    throw error;
  }
};
