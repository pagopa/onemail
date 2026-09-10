export enum EmailPriority {
  HIGH = 'HIGH',
  LOW = 'LOW',
}

export enum EmailStatus {
  Delivered = 'Delivered',
  Dispatched = 'Dispatched',
  HardBounce = 'HardBounce',
  NonRetryableSoftBounce = 'NonRetryableSoftBounce',
  Queued = 'Queued',
  Rejected = 'Rejected',
  DryRunError = 'DryRunError',
  SoftBounce = 'SoftBounce',
  Complaint = 'Complaint',
  MaxRetriesReached = 'MaxRetriesReached',
}

export interface EmailAttachmentRef {
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
  s3Bucket: string;
  s3Key: string;
}

export interface DbEmailContent {
  subject?: string;
  from: EmailAddress;
  to: EmailAddress;
  replyTo?: EmailAddress;
  extendedHeaders?: NameValue[];
  template?: TemplateContent; // mutually exclusive with Body
  body?: EmailContent; // mutually exclusive with Template
  attachments?: EmailAttachmentRef[];
}

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface EmailContent {
  html: string;
  text?: string;
}

export interface EmailEvent {
  status: EmailStatus;
  changedAt: string; // Timestamp
  reason?: string;
}

export interface EmailStatusHistoryItem {
  emailId: string; // PK
  requestId: string; // GSI
  providerMessageId?: string;
  priority: EmailPriority;
  status: EmailStatus;
  history: EmailEvent[];
  content: DbEmailContent;
  tag?: string[];
  clientId: string;
  dryRun: boolean;
  configSetName: string;
  tenantName: string;
}

export interface NameValue {
  N: string;
  V: string;
}

export interface TemplateContent {
  id: string;
  matchedAttributes?: string;
}
