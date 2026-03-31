import z from 'zod';

import {
  DryRunQueryParamsSchema,
  EmailAddressSchema,
  EmailSuccessResponseSchema,
  ExtendedHeadersSchema,
  TagSchema,
  TemplateAttributesSchema,
  TemplateIdSchema,
} from './common.dto.js';

export const SendingInfoSchema = z.object({
  to: EmailAddressSchema.describe(
    'Recipient of the email, ignored in case of dryRun',
  ),
  extendedHeaders: ExtendedHeadersSchema.optional(),
  templateAttributes: TemplateAttributesSchema.optional(),
});

export const EmailLowPriorityBodySchema = z
  .object({
    from: EmailAddressSchema.describe('Sender of the email'),
    tag: TagSchema.optional(),
    replyTo: EmailAddressSchema.optional().describe(
      'Reply-to address for the email',
    ),
    templateId: TemplateIdSchema,
    sendingInfo: z
      .array(SendingInfoSchema)
      .max(10)
      .superRefine((items, ctx) => {
        const seen = new Set<string>();
        const duplicates = new Set<string>();
        for (const item of items) {
          const email = item.to.email.trim().toLowerCase();
          if (seen.has(email)) duplicates.add(email);
          seen.add(email);
        }
        if (duplicates.size > 0) {
          ctx.addIssue({
            code: 'custom',
            message: `Duplicate recipient addresses are not allowed: ${[...duplicates].join(', ')}`,
          });
        }
      })
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

export const EmailLowPriorityResponseSchema = EmailSuccessResponseSchema;

export type EmailLowPriorityResponseDTO = z.infer<
  typeof EmailLowPriorityResponseSchema
>;
