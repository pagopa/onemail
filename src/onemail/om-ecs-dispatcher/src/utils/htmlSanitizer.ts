import {
  emailSanitizerOptions,
  htmlNormalizationOptions,
} from '#config/htmlSanitizerOptions';
import sanitizeHtml from 'sanitize-html';

const normalizeHtml = (html: string): string =>
  sanitizeHtml(html, htmlNormalizationOptions).replace(/>\s+</g, '><').trim();

const preserveDoctype = (
  originalHtml: string,
  sanitizedHtml: string,
): string => {
  const htmlDoctypeRegex = /^\s*(<!doctype\s+html[^>]*>)/i;
  // Check if the original HTML contains a DOCTYPE declaration
  const doctypeMatch = originalHtml.match(htmlDoctypeRegex);

  // If a DOCTYPE is present, prepend it to the sanitized HTML
  if (!doctypeMatch) {
    return sanitizedHtml;
  }
  return `${doctypeMatch[1]}\n${sanitizedHtml}`;
};

export const sanitizeEmailHtml = (html: string): string => {
  // Sanitize HTML content using configured allowlists and preserve the DOCTYPE if present
  const sanitizedHtml = sanitizeHtml(html, emailSanitizerOptions);
  return preserveDoctype(html, sanitizedHtml);
};

export const hasMeaningfulHtmlSanitizationChange = (
  originalHtml: string,
  sanitizedHtml: string,
): boolean => normalizeHtml(originalHtml) !== normalizeHtml(sanitizedHtml);
