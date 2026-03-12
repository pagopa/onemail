import { EmailPriority, EmailStatus } from 'om-common/types';
import z from 'zod';

import { RequestIdSchema, stringCheckedSchema } from './common.dto.js';

export const EmailStatusQueryParamsSchema = z
  .object({
    requestId: RequestIdSchema,
  })
  .openapi('EmailStatusQueryParamsDTO');

// Single status history event item
export const EmailEventSchema = z
  .object({
    status: z.enum(EmailStatus).describe('Status value at this point in time'),
    changedAt: z.iso
      .datetime()
      .describe('ISO 8601 timestamp of the status change event'),
    reason: stringCheckedSchema()
      .optional()
      .describe('Optional detail or reason for the status change'),
  })
  .describe('Single history event for the email status');

// Full response for the email status endpoint
export const EmailStatusResponseSchema = z
  .object({
    status: z.enum(EmailStatus).describe('Current status of the email'),
    priority: z
      .enum(EmailPriority)
      .describe('Priority of the tracked email request'),
    history: z
      .array(EmailEventSchema)
      .describe('Chronological history of status changes'),
  })
  .openapi('EmailStatusResponseDTO');

export type EmailEventDTO = z.infer<typeof EmailEventSchema>;
export type EmailStatusQueryParamsDTO = z.infer<
  typeof EmailStatusQueryParamsSchema
>;
export type EmailStatusResponseDTO = z.infer<typeof EmailStatusResponseSchema>;
