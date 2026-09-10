import env from '#config/env';
import { sesClient } from '#connectors/ses.connector';
import { getAttachment } from '#repositories/attachment.repository';
import {
  mapDbHighPriorityItemToSesModel,
  mapDbLowPriorityItemToSesModel,
} from '#utils/dbMapper';
import {
  BulkEmailStatus,
  SendBulkEmailCommand,
  SendEmailCommand,
} from '@aws-sdk/client-sesv2';
import { publishMetrics, SenderMetricName } from 'om-common/repositories';
import { EmailStatusHistoryItem } from 'om-common/types';

import { BulkSendResult } from '../types/bulkSendResult.type.js';

export const sendHighPriorityEmail = async (
  input: EmailStatusHistoryItem,
): Promise<string | undefined> => {
  const attachmentsBytes = await fetchAttachments([input]);

  //1. from dynamodb to ses model
  const sesInput = mapDbHighPriorityItemToSesModel(input, attachmentsBytes);

  //2. send email with ses connector
  //const command = new SendEmailCommand(sesInput);
  const command = new SendEmailCommand(
    env.ses.sesMultiRegionEndpointId
      ? { ...sesInput, EndpointId: env.ses.sesMultiRegionEndpointId }
      : sesInput,
  );
  const { MessageId } = await sesClient.send(command);
  publishAttachmentDispatchMetric([input]);
  return MessageId;
};

export const sendLowPriorityEmail = async (
  items: EmailStatusHistoryItem[],
): Promise<BulkSendResult> => {
  const attachmentsBytes = await fetchAttachments(items);

  //1. from dynamodb to ses model
  const sesInput = mapDbLowPriorityItemToSesModel(items, attachmentsBytes);

  //2. send email with ses connector
  const command = new SendBulkEmailCommand(
    env.ses.sesMultiRegionEndpointId
      ? { ...sesInput, EndpointId: env.ses.sesMultiRegionEndpointId }
      : sesInput,
  );
  const { BulkEmailEntryResults } = await sesClient.send(command);
  publishAttachmentDispatchMetric(items);

  //3. correlate results with input items (positional mapping)
  const result: BulkSendResult = { successful: [], failed: [] };
  BulkEmailEntryResults?.forEach((entryResult, index) => {
    const itemResult = { item: items[index], result: entryResult };
    if (entryResult.Status === BulkEmailStatus.SUCCESS) {
      result.successful.push(itemResult);
    } else {
      result.failed.push(itemResult);
    }
  });

  return result;
};

const fetchAttachments = async (
  items: EmailStatusHistoryItem[],
): Promise<Uint8Array[] | undefined> => {
  if (!items.length) return undefined;

  const attachments = items.flatMap((item) => item.content.attachments ?? []);
  if (!attachments.length) return undefined;

  const uniqueAttachments = [
    ...new Map(
      attachments.map((attachment) => [attachment.s3Key, attachment]),
    ).values(),
  ];

  try {
    const bytesByKey = new Map(
      await Promise.all(
        uniqueAttachments.map(
          async (attachment) =>
            [
              attachment.s3Key,
              await getAttachment(attachment.s3Bucket, attachment.s3Key),
            ] as const,
        ),
      ),
    );

    return (items[0].content.attachments ?? []).map(
      (attachment) => bytesByKey.get(attachment.s3Key) as Uint8Array,
    );
  } catch (error) {
    publishMetrics([{ name: SenderMetricName.AttachmentFetchFailed }]);
    throw error;
  }
};

const publishAttachmentDispatchMetric = (
  items: EmailStatusHistoryItem[],
): void => {
  const hasAttachments = items.some(
    (item) => (item.content.attachments?.length ?? 0) > 0,
  );
  if (!hasAttachments) return;

  publishMetrics([
    {
      name: SenderMetricName.EmailWithAttachmentsDispatched,
      value: items.length,
    },
  ]);
};
