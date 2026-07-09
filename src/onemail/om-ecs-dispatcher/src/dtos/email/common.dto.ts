import env from '#config/env';
import { ERROR_CODES } from '#dtos/error.dto';
import { ApiError } from '#errors/api.error';
import { APP_ENV_VALUES, headerTenantName } from '#utils/constants';
import {
  hasMeaningfulHtmlSanitizationChange,
  sanitizeEmailHtml,
} from '#utils/htmlSanitizer';
import { StatusCodes } from 'http-status-codes';
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

// Handles sender and recipients
export const EmailAddressSchema = z
  .object({
    name: stringCheckedSchema()
      .regex(/^[^\r\n]+$/, {
        message: 'Display name must not contain line breaks',
      })
      .optional()
      .describe('Name associated with the email address'),
    email: z.email().describe('Email address'),
  })
  .openapi('EmailAddress');

// Used for custom headers
export const NameValueSchema = z
  .object({
    N: stringCheckedSchema({ max: 126 }).describe('Key'),
    V: stringCheckedSchema({ max: 995 }).describe('Value'),
  })
  .openapi('NameValue');

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
  .openapi('TemplateAttributes', {
    description:
      'Dynamic attributes for template rendering. Each key represents the attribute name used in the template (e.g., "user_name"), and its value will be substituted during rendering.',
    additionalProperties: {
      description:
        'Value for the template attribute. Can be a string, number, boolean, object, or array.',
    },
    example: {
      user_name: 'John Doe',
      payment_id: 12345,
      items: ['book', 'pen'],
      metadata: { source: 'web' },
    },
  });

// Identifier of the email template
export const TemplateIdSchema = stringCheckedSchema().describe(
  'Identifier of the email template',
);

// Dry Run Query Parameters
export const DryRunQueryParamsSchema = z
  .object({
    dryRun: z.stringbool().default(false).openapi({
      type: 'boolean',
      default: false,
      description:
        'Indicates whether the request is a dry run, ignored in production',
    }),
  })
  .refine(
    (data) => {
      if (data.dryRun && env.server.environment === APP_ENV_VALUES.production) {
        return false;
      }
      return true;
    },
    {
      message: 'dryRun is not allowed in production',
    },
  );

export const RequestIdSchema = stringCheckedSchema().describe(
  'Unique identifier for the request, used for checking the status of the emails in the system',
);

export const EmailSuccessResponseSchema = z
  .object({
    requestId: RequestIdSchema,
  })
  .openapi('EmailSuccessResponseDTO');

export const htmlInputSchema = stringCheckedSchema({ min: 10, max: 150000 });
export const htmlContentSchema = htmlInputSchema.transform((html) => {
  const sanitizedHtml = sanitizeEmailHtml(html);
  if (hasMeaningfulHtmlSanitizationChange(html, sanitizedHtml)) {
    throw new ApiError(
      'Invalid HTML provided: unsafe content was detected.',
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.INVALID_INPUT_DATA,
    );
  }
  return sanitizedHtml;
});

export const TenantNameHeaderSchema = z.object({
  [headerTenantName]: stringCheckedSchema(),
});
