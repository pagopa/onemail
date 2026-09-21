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
  const attachmentBytes = await fetchAttachments([input]);
  //1. from dynamodb to ses model
  const sesInput = mapDbHighPriorityItemToSesModel(input, attachmentBytes);

  //2. send email with ses connector
  //const command = new SendEmailCommand(sesInput);
  const command = new SendEmailCommand(
    env.ses.sesMultiRegionEndpointId
      ? { ...sesInput, EndpointId: env.ses.sesMultiRegionEndpointId }
      : sesInput,
  );
  const { MessageId } = await sesClient.send(command);
  return MessageId;
};

export const sendLowPriorityEmail = async (
  items: EmailStatusHistoryItem[],
): Promise<BulkSendResult> => {
  const attachmentBytes = await fetchAttachments(items);
  //1. from dynamodb to ses model
  const sesInput = mapDbLowPriorityItemToSesModel(items, attachmentBytes);

  //2. send email with ses connector
  const command = new SendBulkEmailCommand(
    env.ses.sesMultiRegionEndpointId
      ? { ...sesInput, EndpointId: env.ses.sesMultiRegionEndpointId }
      : sesInput,
  );
  const { BulkEmailEntryResults } = await sesClient.send(command);

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
): Promise<Map<string, Uint8Array> | undefined> => {
  const attachments = items[0]?.content.attachments;
  if (!attachments?.length) return undefined;

  const uniqueAttachments = [
    ...new Map(attachments.map((attachment) => [attachment.s3Key, attachment])),
  ];
  try {
    const fetched = await Promise.all(
      uniqueAttachments.map(async ([key, attachment]) => {
        const bucket = env.aws.attachmentsBucket;
        return [key, await getAttachment(bucket, attachment.s3Key)] as const;
      }),
    );
    return new Map(fetched);
  } catch (error) {
    publishMetrics([{ name: SenderMetricName.AttachmentFetchFailed }]);
    throw error;
  }
};
