import z from 'zod';

import {
  EmailAddressSchema,
  EmailSuccessResponseSchema,
  ExtendedHeadersSchema,
  stringCheckedSchema,
  TagSchema,
  TemplateAttributesSchema,
} from './common.dto.js';

export const SendingInfoSchema = z.object({
  to: EmailAddressSchema,
  extendedHeaders: ExtendedHeadersSchema.optional(),
  templateAttributes: TemplateAttributesSchema.optional(),
});

export const EmailLowPriorityBodySchema = z.object({
  from: EmailAddressSchema,
  tag: TagSchema.optional(),
  replyTo: EmailAddressSchema.optional(),
  templateId: stringCheckedSchema(),
  sendingInfo: z.array(SendingInfoSchema).max(50),
});

export type EmailLowPriorityBodyDTO = z.infer<
  typeof EmailLowPriorityBodySchema
>;

export const EmailLowPriorityResponseSchema = EmailSuccessResponseSchema;

export type EmailLowPriorityResponseDTO = z.infer<
  typeof EmailLowPriorityResponseSchema
>;
