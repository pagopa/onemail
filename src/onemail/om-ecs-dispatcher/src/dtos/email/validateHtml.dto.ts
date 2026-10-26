import z from 'zod';

import { htmlInputSchema, stringCheckedSchema } from './common.dto.js';

export const SanitizeHtmlSchema = z
  .object({
    htmlContent: htmlInputSchema
      .describe('HTML content to be sanitized')
      .openapi({ example: '<p>Hello <strong>World</strong></p>' }),
  })
  .openapi('SanitizeHtmlBodyDTO');

export type SanitizeHtmlDTO = z.infer<typeof SanitizeHtmlSchema>;

export const SanitizeTemplateSchema = z
  .object({
    htmlContent: stringCheckedSchema({ min: 1, max: 500000 })
      .describe('Handlebars template HTML to sanitize')
      .openapi({ example: '<p>Hello {{name}}</p>' }),
  })
  .openapi('SanitizeTemplateBodyDTO');

export type SanitizeTemplateDTO = z.infer<typeof SanitizeTemplateSchema>;

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
