import z from 'zod';

import {
  DryRunQueryParams,
  DryRunQueryParamsSchema,
  EmailAddressSchema,
  EmailContentSchema,
  EmailSuccessResponseSchema,
  ExtendedHeadersSchema,
  stringCheckedSchema,
  TagSchema,
  TemplateContentSchema,
} from './common.dto.js';

export const EmailHighPriorityBodySchema = z
  .object({
    subject: stringCheckedSchema().optional(),
    from: EmailAddressSchema,
    to: EmailAddressSchema,
    extendedHeaders: ExtendedHeadersSchema.optional(),
    tag: TagSchema.optional(),
    emailContent: EmailContentSchema.optional(),
    templateContent: TemplateContentSchema.optional(),
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
  );

export type EmailHighPriorityBodyDTO = z.infer<
  typeof EmailHighPriorityBodySchema
>;

export const EmailHighPriorityQueryParamsSchema = DryRunQueryParamsSchema;

export type EmailHighPriorityQueryParams = DryRunQueryParams;

export const EmailHighPriorityResponseSchema = EmailSuccessResponseSchema;

export type EmailHighPriorityResponseDTO = z.infer<
  typeof EmailHighPriorityResponseSchema
>;
