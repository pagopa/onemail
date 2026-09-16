import env from '#config/env';
import { InvalidHtmlRawError } from '#errors/invalidHtmlRawError.error';
import { APP_ENV_VALUES, headerTenantName } from '#utils/constants';
import { sanitizeEmailHtml } from '#utils/htmlSanitizer';
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

export const AttachmentInputSchema = z
  .object({
    filename: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[\w.\- ()]+$/, {
        message: 'Attachment filename contains unsupported characters',
      })
      .refine((filename) => !filename.includes('..'), {
        message:
          'Attachment filename must not contain path traversal sequences',
      })
      .refine(
        (filename) => !filename.includes('/') && !filename.includes('\\'),
        {
          message: 'Attachment filename must not contain path separators',
        },
      )
      .describe(
        'Attachment filename including its extension. Allowed characters: ASCII letters, digits, underscore, dots, hyphens, spaces, and parentheses. Path separators and path traversal sequences are not allowed.',
      ),
    contentType: z
      .enum([
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
      ])
      .describe('Declared attachment MIME type'),
    content: z
      .string()
      .describe('Base64-encoded attachment content without a data URI prefix.'),
  })
  .openapi('AttachmentInput');

export const AttachmentsSchema = z
  .array(AttachmentInputSchema)
  .max(5)
  .describe(
    'Up to 5 base64-encoded attachments. The decoded total is limited to 7 MiB. Invalid attachments return HTTP 400 with error code A001.',
  )
  .openapi('Attachments');

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
  const { sanitizedHtml, isSanitized } = sanitizeEmailHtml(html);
  if (isSanitized) {
    throw new InvalidHtmlRawError();
  }
  return sanitizedHtml;
});

export const TenantNameHeaderSchema = z.object({
  [headerTenantName]: stringCheckedSchema(),
});
