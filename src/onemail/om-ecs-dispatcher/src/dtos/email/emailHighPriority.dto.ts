import z from 'zod';

import {
  DryRunQueryParamsSchema,
  EmailAddressSchema,
  EmailSuccessResponseSchema,
  ExtendedHeadersSchema,
  stringCheckedSchema,
  TagSchema,
  TemplateAttributesSchema,
  TemplateIdSchema,
} from './common.dto.js';

// Reference to template and dynamic attributes
export const TemplateContentSchema = z.object({
  templateId: TemplateIdSchema,
  templateAttributes: TemplateAttributesSchema.optional(),
});

// Free HTML or text content
export const EmailContentSchema = z.object({
  subject: stringCheckedSchema().describe('Subject of the email'),
  html: stringCheckedSchema({ max: 200000 }).describe(
    'HTML content of the email',
  ), // TODO: consider stricter validation for HTML content, e.g., sanitization or specific tags allowed
  text: stringCheckedSchema({ max: 200000 })
    .optional()
    .describe(
      'Text content of the email used as fallback if HTML content is not supported by the email client',
    ),
});

const BaseEmailSchema = z.object({
  from: EmailAddressSchema.describe('Sender of the email'),
  to: EmailAddressSchema.describe('Recipient of the email'),
  extendedHeaders: ExtendedHeadersSchema.optional(),
  tag: TagSchema.optional(),
});

export const EmailHighPriorityBodySchema = BaseEmailSchema.and(
  z.union([
    z.object({
      templateContent: TemplateContentSchema.describe(
        'Template content of the email to be sent if emailContent is not provided',
      ),
    }),
    z.object({
      emailContent: EmailContentSchema.describe(
        'Content of the email to be sent if templateContent is not provided',
      ),
    }),
  ]),
).openapi('EmailHighPriorityBodyDTO');

export type EmailHighPriorityBodyDTO = z.infer<
  typeof EmailHighPriorityBodySchema
>;

export const EmailHighPriorityQueryParamsSchema = DryRunQueryParamsSchema;

export type EmailHighPriorityQueryParams = z.infer<
  typeof EmailHighPriorityQueryParamsSchema
>;

export const EmailHighPriorityResponseSchema =
  EmailSuccessResponseSchema.openapi('EmailHighPriorityResponseDTO');

export type EmailHighPriorityResponseDTO = z.infer<
  typeof EmailHighPriorityResponseSchema
>;
