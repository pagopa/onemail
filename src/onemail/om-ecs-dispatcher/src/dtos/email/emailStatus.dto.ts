import { EmailPriority, EmailStatus } from 'om-common/types';
import z from 'zod';

import {
  EmailAddressSchema,
  RequestIdSchema,
  stringCheckedSchema,
} from './common.dto.js';

export const EmailStatusQueryParamsSchema = z.object({
  requestId: RequestIdSchema,
});

const EmailStatusSchema = z
  .enum(EmailStatus)
  .describe('Status of the email')
  .openapi('EmailStatus');

// Single status history event item
const EmailEventSchema = z
  .object({
    status: EmailStatusSchema,
    changedAt: z.iso
      .datetime()
      .describe('ISO 8601 timestamp of the status change event'),
    reason: stringCheckedSchema()
      .optional()
      .describe('Optional detail or reason for the status change'),
  })
  .describe('Single history event for the email status');

// Full response for the email status endpoint
const EmailStatusItemSchema = z
  .object({
    emailId: z.string().describe('Unique identifier of the email'),
    status: EmailStatusSchema,
    priority: z
      .enum(EmailPriority)
      .describe('Priority of the tracked email request'),
    to: EmailAddressSchema.describe('Recipient email address'),
    history: z
      .array(EmailEventSchema)
      .describe('Chronological history of status changes'),
  })
  .openapi('EmailStatusItemResponseDTO');

export const EmailStatusResponseSchema = z.array(EmailStatusItemSchema);

export type EmailStatusQueryParamsDTO = z.infer<
  typeof EmailStatusQueryParamsSchema
>;
export type EmailStatusResponseDTO = z.infer<typeof EmailStatusResponseSchema>;
