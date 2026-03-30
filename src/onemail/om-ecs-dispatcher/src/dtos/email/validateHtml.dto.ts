import z from 'zod';

import { htmlContentSchema } from './common.dto.js';

export const SanitizeHtmlSchema = z
  .object({
    htmlContent: htmlContentSchema
      .describe('HTML content to be sanitized')
      .openapi({ example: '<p>Hello <strong>World</strong></p>' }),
  })
  .openapi('SanitizeHtmlBodyDTO');

export type SanitizeHtmlDTO = z.infer<typeof SanitizeHtmlSchema>;

export const SanitizeHtmlResponseSchema = z
  .object({
    sanitizedHtml: z.string().describe('Sanitized HTML content'),
  })
  .openapi('SanitizeHtmlResponseDTO');

export type SanitizeHtmlResponseDTO = z.infer<
  typeof SanitizeHtmlResponseSchema
>;
