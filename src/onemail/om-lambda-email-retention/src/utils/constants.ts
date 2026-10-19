import { EmailStatus } from 'om-common/types';

// Statuses after which an email is never sent again. Keep aligned with
// local.email_final_statuses in src/infra/src/70_domains/onemail_app/99_locals.tf (stream filter).
export const FINAL_EMAIL_STATUSES: readonly EmailStatus[] = [
  EmailStatus.Delivered,
  EmailStatus.HardBounce,
  EmailStatus.NonRetryableSoftBounce,
  EmailStatus.Rejected,
  EmailStatus.Complaint,
  EmailStatus.MaxRetriesReached,
  EmailStatus.DryRunError,
  EmailStatus.EventProcessingFailed,
];

export const SECONDS_PER_DAY = 86400;

export const S3_DELETE_OBJECTS_MAX_KEYS = 1000;
