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
export const EmailContentSchema = z
  .object({
    html: stringCheckedSchema({ max: 200000 })
      .optional()
      .describe('HTML content of the email'), // TODO: consider stricter validation for HTML content, e.g., sanitization or specific tags allowed
    text: stringCheckedSchema({ max: 200000 })
      .optional()
      .describe(
        'Text content of the email used as fallback if HTML content is not supported by the email client',
      ),
  })
  .refine((data) => data.html || data.text, {
    message: 'Either html or text is required',
  });

export const EmailHighPriorityBodySchema = z
  .object({
    subject: stringCheckedSchema()
      .optional()
      .describe('Subject of the email, required if emailContent is present'),
    from: EmailAddressSchema.describe('Sender of the email'),
    to: EmailAddressSchema.describe('Recipient of the email'),
    extendedHeaders: ExtendedHeadersSchema.optional(),
    tag: TagSchema.optional(),
    emailContent: EmailContentSchema.optional().describe(
      'Content of the email to be sent if templateContent is not provided',
    ),
    templateContent: TemplateContentSchema.optional().describe(
      'Template content of the email to be sent if emailContent is not provided',
    ),
  })
  .refine(
    (data) => {
      if (data.emailContent && data.templateContent) return false;
      return data.emailContent || data.templateContent;
    },
    {
      message:
        'One of emailContent or templateContent is required, but not both',
    },
  )
  .refine(
    (data) => {
      if (data.emailContent && !data.subject) return false;
      return true;
    },
    {
      message: 'Subject is required if emailContent is present',
      path: ['subject'],
    },
  )
  .openapi('EmailHighPriorityBodyDTO');

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
