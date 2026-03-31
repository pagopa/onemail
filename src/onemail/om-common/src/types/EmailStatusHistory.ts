export const EmailStatus = {
  Delivered: 'Delivered',
  Dispatched: 'Dispatched',
  HardBounce: 'HardBounce',
  Queued: 'Queued',
  RejectedBySES: 'RejectedBySES',
  DryRunError: 'DryRunError',
  SoftBounce: 'SoftBounce',
  Complaint: 'Complaint',
} as const;

export const EmailPriority = {
  HIGH: 'HIGH',
  LOW: 'LOW',
} as const;

export interface DbEmailContent {
  subject?: string;
  from: EmailAddress;
  to: EmailAddress;
  replyTo?: EmailAddress;
  extendedHeaders?: NameValue[];
  template?: TemplateContent; // mutually exclusive with Body
  body?: EmailContent; // mutually exclusive with Template
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

export type EmailPriority = (typeof EmailPriority)[keyof typeof EmailPriority];

export type EmailStatus = (typeof EmailStatus)[keyof typeof EmailStatus];

export interface EmailStatusHistoryItem {
  emailId: string; // PK
  requestId: string; // GSI
  sesMessageId?: string;
  priority: EmailPriority;
  status: EmailStatus;
  history: EmailEvent[];
  content: DbEmailContent;
  tag?: string[];
  clientId: string;
  dryRun: boolean;
}

export interface NameValue {
  N: string;
  V: string;
}

export interface TemplateContent {
  id: string;
  matchedAttributes?: string;
}
