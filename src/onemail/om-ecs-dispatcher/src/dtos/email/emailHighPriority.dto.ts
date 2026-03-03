import sanitizeHtml from 'sanitize-html';
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

// 1. Define the allowed rules for Email HTML
const emailSanitizerOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'p',
    'a',
    'ul',
    'ol',
    'nl',
    'li',
    'b',
    'i',
    'strong',
    'em',
    'strike',
    'code',
    'hr',
    'br',
    'div',
    'table',
    'thead',
    'caption',
    'tbody',
    'tr',
    'th',
    'td',
    'pre',
    'span',
    'img',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target'],
    img: ['src', 'alt', 'width', 'height'],
    // Allow inline styles and classes which are heavy in emails
    '*': ['style', 'class', 'id', 'dir', 'lang'],
    table: ['width', 'border', 'cellspacing', 'cellpadding', 'bgcolor'],
    td: ['width', 'bgcolor', 'valign', 'align'],
  },
  // Explicitly remove dangerous tags (sanitize-html does this by default, but it's good to be explicit)
  disallowedTagsMode: 'discard',
  allowProtocolRelative: false,
};

// Free HTML or text content
export const EmailContentSchema = z.object({
  subject: stringCheckedSchema().describe('Subject of the email'),
  html: stringCheckedSchema({ min: 10, max: 200000 })
    .describe('HTML content of the email')
    .transform((dirtyHtml) =>
      // Check 2: Transform and sanitize the input
      sanitizeHtml(dirtyHtml, emailSanitizerOptions),
    )
    .refine((cleanHtml) => cleanHtml.trim().length > 0, {
      message:
        'Invalid HTML provided: content was removed due to security rules.',
    }),
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
