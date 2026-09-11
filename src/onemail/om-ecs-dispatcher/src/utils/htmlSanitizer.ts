import {
  emailSanitizerOptions,
  htmlNormalizationOptions,
} from '#config/htmlSanitizerOptions';
import sanitizeHtml from 'sanitize-html';

// Strips directive markers before normalizing
export const normalizeHtml = (
  html: string,
  hasDirectives?: boolean,
): string => {
  const htmlContainsDirective = hasDirectives ?? containsDirectives(html);
  const htmlToNormalize = htmlContainsDirective
    ? stripDirectivesMarkers(html)
    : html;
  return sanitizeHtml(htmlToNormalize, htmlNormalizationOptions)
    .replace(/>\s+</g, '><')
    .trim();
};

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

// Matches opening directives <!--[if condition]>
const DIRECTIVE_OPENING_REGEX = /<!--\[if[^\]]*\]>(?:<!--)?(?:>)?/gi;
// Matches closing directives <![endif]-->
const DIRECTIVE_CLOSING_REGEX = /(?:<!--)?<!\[endif\]-->/gi;
// Matches any directive marker - for detection purposes
const DIRECTIVE_MARKER_REGEX = /<!--\[if[^\]]*\]>/i;

const containsDirectives = (html: string): boolean =>
  DIRECTIVE_MARKER_REGEX.test(html);

// Tokenizes directives to prevent them from being altered during sanitization
const tokenizeDirectives = (
  html: string,
): { processedHtml: string; tokens: Map<string, string> } => {
  // nonce prevents token injection via crafted content
  const nonce = Math.random().toString(36).slice(2, 10);
  const tokens = new Map<string, string>();
  let counter = 0;

  const toToken = (match: string, type: 'OPEN' | 'CLOSE'): string => {
    const token = `__DIRECTIVE_${type}_${nonce}_${counter++}__`;
    tokens.set(token, match);
    return token;
  };

  const processedHtml = html
    .replace(DIRECTIVE_OPENING_REGEX, (directive) => toToken(directive, 'OPEN'))
    .replace(DIRECTIVE_CLOSING_REGEX, (directive) =>
      toToken(directive, 'CLOSE'),
    );

  return { processedHtml, tokens };
};

const restoreDirectives = (
  html: string,
  tokens: Map<string, string>,
): string => {
  let result = html;
  for (const [token, original] of tokens) {
    result = result.replaceAll(token, original);
  }
  return result;
};

// Remove the enclosing directive markers, exposing the inner content to normalize
const stripDirectivesMarkers = (html: string): string =>
  html
    .replace(DIRECTIVE_OPENING_REGEX, '_DIRECTIVE_')
    .replace(DIRECTIVE_CLOSING_REGEX, '_DIRECTIVE_');

export const hasHtmlSanitizationChange = (
  originalHtml: string,
  sanitizedHtml: string,
  hasDirectives?: boolean,
): boolean =>
  normalizeHtml(originalHtml, hasDirectives) !==
  normalizeHtml(sanitizedHtml, hasDirectives);

export type SanitizationResult = {
  sanitizedHtml: string;
  isSanitized: boolean;
};

// Sanitize HTML content using configured allowlists and preserve the DOCTYPE if present
export const sanitizeEmailHtml = (html: string): SanitizationResult => {
  const hasDirectives = containsDirectives(html);
  let sanitized: string;

  if (hasDirectives) {
    // keep and sanitize directives
    const { processedHtml, tokens } = tokenizeDirectives(html);
    sanitized = sanitizeHtml(processedHtml, emailSanitizerOptions);
    sanitized = restoreDirectives(sanitized, tokens);
  } else {
    sanitized = sanitizeHtml(html, emailSanitizerOptions);
  }

  const result = preserveDoctype(html, sanitized);
  const isSanitized = hasHtmlSanitizationChange(html, result, hasDirectives);

  return { sanitizedHtml: result, isSanitized };
};
