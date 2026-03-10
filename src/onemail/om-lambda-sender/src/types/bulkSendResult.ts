import { BulkEmailEntryResult } from '@aws-sdk/client-sesv2';
import { EmailStatusHistoryItem } from 'om-common/types';

export interface BulkSendItemResult {
  item: EmailStatusHistoryItem;
  result: BulkEmailEntryResult;
}

export interface BulkSendResult {
  successful: BulkSendItemResult[];
  failed: BulkSendItemResult[];
}
