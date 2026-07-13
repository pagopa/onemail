import sanitizeHtml from 'sanitize-html';

// 1. Define the allowed rules for Email HTML
export const emailSanitizerOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    // DOCUMENT STRUCTURE
    'html',
    'head',
    'meta',
    'title',
    'style',
    'body',
    'link', // to check
    // TEXT
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
    'dl',
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
    'pre',
    'span',
    // TABLE
    'table',
    'thead',
    'caption',
    'tbody',
    'tr',
    'th',
    'td',
    // MEDIA
    'img',
    // LEGACY (useful with old client e.g. OUTLOOK)
    'center',
    'u',
    'font',
  ],
  allowedAttributes: {
    // document structure
    html: ['lang', 'dir', 'xmlns'],
    meta: ['charset', 'name', 'content', 'http-equiv'],
    link: ['href', 'rel', 'type'],
    // text and media
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    // global (on each tag) - e.g. allow inline styles and classes
    '*': [
      'style',
      'class',
      'id',
      'dir',
      'lang',
      'align',
      'valign',
      'role',
      'aria-label',
      'aria-hidden',
      'aria-roledescription',
      'aria-describedby',
      'aria-labelledby',
    ],
    // table
    table: [
      'width',
      'border',
      'cellspacing',
      'cellpadding',
      'bgcolor',
      'presentation',
    ],
    tr: ['bgcolor', 'height'],
    td: ['width', 'height', 'bgcolor', 'colspan', 'rowspan'],
    th: ['width', 'height', 'bgcolor', 'colspan', 'rowspan'],
    // legacy attributes
    font: ['face', 'size', 'color'],
  },
  allowedSchemes: ['https', 'mailto', 'tel'],
  // Explicitly remove dangerous tags (sanitize-html does this by default, but it's good to be explicit)
  disallowedTagsMode: 'discard',
  allowProtocolRelative: false,

  // Allow style tags (on head) and preserve their content, since sanitize-html treats <style> as a "vulnerable tag" due to XSS risks
  // If this option is not set to true, the <style> tag is preserved but the CSS inside it is removed.
  allowVulnerableTags: true,
};

// HTML normalization (no validation)
export const htmlNormalizationOptions: sanitizeHtml.IOptions = {
  allowedTags: false,
  allowedAttributes: false,
  allowedSchemesAppliedToAttributes: [],
  allowProtocolRelative: true,
  // Suppress the style-tag XSS warning: normalization is intentionally permissive
  // and is used only for comparison, never for producing output sent to users.
  allowVulnerableTags: true,
};
