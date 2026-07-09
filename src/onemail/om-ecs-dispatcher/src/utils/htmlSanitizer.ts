import {
  emailSanitizerOptions,
  htmlNormalizationOptions,
} from '#config/htmlSanitizer';
import sanitizeHtml from 'sanitize-html';

const normalizeHtml = (html: string): string =>
  sanitizeHtml(html, htmlNormalizationOptions).replace(/>\s+</g, '><').trim();

export const sanitizeEmailHtml = (html: string): string =>
  sanitizeHtml(html, emailSanitizerOptions);

export const hasMeaningfulHtmlSanitizationChange = (
  originalHtml: string,
  sanitizedHtml: string,
): boolean => normalizeHtml(originalHtml) !== normalizeHtml(sanitizedHtml);
