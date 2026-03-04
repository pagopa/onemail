import env from '#config/env';
import { emailSanitizerOptions } from '#config/htmlSanitizer';
import { NODE_ENV_VALUES } from '#utils/constants';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

export const stringCheckedSchema = ({
  min,
  max,
}: {
  min?: number;
  max?: number;
} = {}) => {
  const minLength = min || 1;
  const maxLength = max || 255;
  return z
    .string()
    .trim()
    .min(minLength, { message: `Minimum length is ${minLength} characters` })
    .max(maxLength, { message: `Field can't exceed ${maxLength} characters` });
};

// Handles sender and recipients [cite: 828, 866]
export const EmailAddressSchema = z.object({
  name: stringCheckedSchema()
    .optional()
    .describe('Name associated with the email address'),
  email: z.email().describe('Email address'),
});

// Used for custom headers
export const NameValueSchema = z.object({
  N: stringCheckedSchema().describe('Key'),
  V: stringCheckedSchema().describe('Value'),
});

// Custom headers
export const ExtendedHeadersSchema = z
  .array(NameValueSchema)
  .describe('Custom headers for the email');

// Tags for categorization and filtering
export const TagSchema = z
  .array(stringCheckedSchema())
  .describe('Custom tags/categories for the email');

// Dynamic attributes for template rendering
export const TemplateAttributesSchema = z
  .record(stringCheckedSchema().describe('Key'), z.any().describe('Value'))
  .describe('Dynamic attributes for template rendering');

// Identifier of the email template
export const TemplateIdSchema = stringCheckedSchema().describe(
  'Identifier of the email template',
);

// Dry Run Query Parameters
export const DryRunQueryParamsSchema = z
  .object({
    dryRun: z
      .stringbool()
      .default(false)
      .describe(
        'Indicates whether the request is a dry run, ignored in production',
      ),
  })
  .refine(
    (data) => {
      if (
        data.dryRun &&
        env.server.environment === NODE_ENV_VALUES.production
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'dryRun is not allowed in production',
    },
  );

export const EmailSuccessResponseSchema = z.object({
  requestId: z
    .string()
    .describe(
      'Unique identifier for the request, used for checking the status of the email in the system',
    ),
});

export const htmlContentSchema = stringCheckedSchema({ min: 10, max: 200000 })
  .transform((html) => sanitizeHtml(html, emailSanitizerOptions))
  .refine((cleanHtml) => cleanHtml.trim().length > 0, {
    message:
      'Invalid HTML provided: content was removed due to security rules.',
  });
