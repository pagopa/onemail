import z from 'zod';

import {
  AttachmentsSchema,
  DryRunQueryParamsSchema,
  EmailAddressSchema,
  EmailSuccessResponseSchema,
  ExtendedHeadersSchema,
  RecipientEmailAddressSchema,
  TagSchema,
  TemplateAttributesSchema,
  TemplateIdSchema,
} from './common.dto.js';

export const SendingInfoSchema = z.object({
  to: RecipientEmailAddressSchema.describe(
    'Recipient of the email. PEC and test domain recipients are not supported. Recipients will be ignored in case of dryRun.',
  ),
  extendedHeaders: ExtendedHeadersSchema.optional(),
  templateAttributes: TemplateAttributesSchema.optional(),
});

export type SendingInfoDTO = z.infer<typeof SendingInfoSchema>;

export const EmailLowPriorityBodySchema = z
  .object({
    from: EmailAddressSchema.describe('Sender of the email'),
    tag: TagSchema.optional(),
    replyTo: EmailAddressSchema.optional().describe(
      'Reply-to address for the email',
    ),
    templateId: TemplateIdSchema,
    attachments: AttachmentsSchema.optional(),
    sendingInfo: z
      .array(SendingInfoSchema)
      .max(10)
      .describe(
        'Information about the recipients and their template email content',
      ),
  })
  .openapi('EmailLowPriorityBodyDTO');

export type EmailLowPriorityBodyDTO = z.infer<
  typeof EmailLowPriorityBodySchema
>;

export const EmailLowPriorityQueryParamsSchema = DryRunQueryParamsSchema;

export type EmailLowPriorityQueryParams = z.infer<
  typeof EmailLowPriorityQueryParamsSchema
>;

export const UnhandledEmailSchema = z
  .object({
    address: z.email().describe('Discarded recipient email address'),
    reason: z.string().describe('Reason why the recipient was discarded'),
  })
  .openapi('UnhandledEmail');

export type UnhandledEmailDTO = z.infer<typeof UnhandledEmailSchema>;

export const EmailLowPriorityResponseSchema = EmailSuccessResponseSchema.extend(
  {
    unhandledEmails: z
      .array(UnhandledEmailSchema)
      .optional()
      .describe(
        'Recipients excluded from the request. Absent when every recipient was accepted.',
      ),
  },
).openapi('EmailLowPriorityResponseDTO');

export type EmailLowPriorityResponseDTO = z.infer<
  typeof EmailLowPriorityResponseSchema
>;
