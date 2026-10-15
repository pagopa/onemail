import type { EmailPriority, EmailStatus } from 'om-common/types';

export interface FinalizedEmail {
  emailId: string;
  requestId?: string;
  priority: EmailPriority;
  status: EmailStatus;
  attachmentKeys: string[];
}
