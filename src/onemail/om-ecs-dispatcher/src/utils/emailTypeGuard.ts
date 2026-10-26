import type { EmailHighPriorityBodyDTO } from '#dtos/email/emailHighPriority.dto';

export const isTemplatedEmail = (email: EmailHighPriorityBodyDTO) =>
  'templateContent' in email;
