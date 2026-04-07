import { BulkEmailStatus } from '@aws-sdk/client-sesv2';

export const RetryableBulkEmailStatuses = [
  BulkEmailStatus.ACCOUNT_DAILY_QUOTA_EXCEEDED,
  BulkEmailStatus.ACCOUNT_SENDING_PAUSED,
  BulkEmailStatus.FAILED,
  BulkEmailStatus.CONFIGURATION_SET_SENDING_PAUSED,
  BulkEmailStatus.ACCOUNT_THROTTLED,
  BulkEmailStatus.TRANSIENT_FAILURE,
];
