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

const attachmentExtensionByContentType = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/heic': ['heic'],
  'image/heif': ['heif'],
  'application/msword': ['doc'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.oasis.opendocument.text': ['odt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'docx',
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    'pptx',
  ],
  'text/plain': ['txt'],
  'text/csv': ['csv'],
} as const;

type AttachmentContentTypeKey = keyof typeof attachmentExtensionByContentType;

const attachmentContentTypes = Object.keys(
  attachmentExtensionByContentType,
) as [AttachmentContentTypeKey, ...AttachmentContentTypeKey[]];

const attachmentContentTypeSchema = z.enum(attachmentContentTypes);

const filenameExtension = (filename: string): string | undefined => {
  const extension = filename.split('.').at(-1);
  if (!extension || extension === filename) return undefined;
  return extension.toLowerCase();
};

export const AttachmentInputSchema = z
  .object({
    filename: stringCheckedSchema({ min: 1, max: 255 })
      .regex(/^(?!.*\.\.)(?!.*[\\/])[\w.\- ()]+$/, {
        message: 'Attachment filename is invalid',
      })
      .describe(
        'Attachment filename including an extension allowed for the declared content type. Allowed characters: ASCII letters, digits, underscores, dots, hyphens, spaces, and parentheses. Path separators and path traversal sequences are not allowed.',
      ),
    contentType: attachmentContentTypeSchema.describe(
      'Declared attachment MIME type',
    ),
    content: z
      .base64('Attachment content must be valid base64')
      .min(1)
      .describe('Base64-encoded attachment content without a data URI prefix.'),
  })
  .superRefine((attachment, context) => {
    const extension = filenameExtension(attachment.filename);
    const allowedExtensions =
      attachmentExtensionByContentType[attachment.contentType];
    if (
      extension &&
      (allowedExtensions as readonly string[]).includes(extension)
    ) {
      return;
    }

    context.addIssue({
      code: 'custom',
      path: ['filename'],
      message: 'Attachment filename extension does not match content type',
    });
  })
  .openapi('AttachmentInput');

export const AttachmentsSchema = z
  .array(AttachmentInputSchema)
  .max(5)
  .describe(
    'Up to 5 base64-encoded attachments. The decoded total is limited to 7 MiB. Invalid attachments return HTTP 400 with error code A001.',
  )
  .openapi('Attachments');

export type AttachmentInputDTO = z.infer<typeof AttachmentInputSchema>;
export type AttachmentAllowedContentType = AttachmentInputDTO['contentType'];

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
