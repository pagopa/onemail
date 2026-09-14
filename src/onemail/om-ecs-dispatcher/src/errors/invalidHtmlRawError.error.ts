const INVALID_HTML_RAW_ERROR_MESSAGE =
  'Invalid HTML provided: unsafe content was detected.';

export class InvalidHtmlRawError extends Error {
  constructor(message = INVALID_HTML_RAW_ERROR_MESSAGE) {
    super(message);
    this.name = 'InvalidHtmlRawError';
  }
}
