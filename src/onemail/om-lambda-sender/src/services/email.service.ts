import { sesClient } from '#connector/ses.connector';
import {
  mapDbHighPriorityItemToSesModel,
  mapDbLowPriorityItemToSesModel,
} from '#utils/dbMapper';
import { SendBulkEmailCommand, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { EmailStatusHistoryItem } from 'om-common/types';

import { BulkSendResult } from '../types/bulkSendResult.js';

export const sendHighPriorityEmail = async (
  input: EmailStatusHistoryItem,
): Promise<string | undefined> => {
  //1. from dynamodb to ses model
  const sesInput = mapDbHighPriorityItemToSesModel(input);
  //2. send email with ses connector
  const command = new SendEmailCommand(sesInput);
  const { MessageId } = await sesClient.send(command);
  return MessageId;
};

export const sendLowPriorityEmail = async (
  items: EmailStatusHistoryItem[],
): Promise<BulkSendResult> => {
  //1. from dynamodb to ses model
  const sesInput = mapDbLowPriorityItemToSesModel(items);
  //2. send email with ses connector
  const command = new SendBulkEmailCommand(sesInput);
  const { BulkEmailEntryResults } = await sesClient.send(command);

  //3. correlate results with input items (positional mapping)
  const result: BulkSendResult = { successful: [], failed: [] };

  BulkEmailEntryResults?.forEach((entryResult, index) => {
    const itemResult = { item: items[index], result: entryResult };
    if (entryResult.Status === 'SUCCESS') {
      result.successful.push(itemResult);
    } else {
      result.failed.push(itemResult);
    }
  });

  return result;
};
