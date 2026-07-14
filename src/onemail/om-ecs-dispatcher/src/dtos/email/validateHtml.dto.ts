import z from 'zod';

import { htmlInputSchema } from './common.dto.js';

export const SanitizeHtmlSchema = z
  .object({
    htmlContent: htmlInputSchema
      .describe('HTML content to be sanitized')
      .openapi({ example: '<p>Hello <strong>World</strong></p>' }),
  })
  .openapi('SanitizeHtmlBodyDTO');

export type SanitizeHtmlDTO = z.infer<typeof SanitizeHtmlSchema>;

export const SanitizeHtmlResponseSchema = z
  .object({
    sanitizedHtml: z.string().describe('Sanitized HTML content'),
    isSanitized: z
      .boolean()
      .describe('Indicates if the HTML content was sanitized'),
  })
  .openapi('SanitizeHtmlResponseDTO');

export type SanitizeHtmlResponseDTO = z.infer<
  typeof SanitizeHtmlResponseSchema
>;
