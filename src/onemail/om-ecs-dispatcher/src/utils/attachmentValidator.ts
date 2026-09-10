import { ERROR_CODES } from '#dtos/error.dto';
import { ApiError } from '#errors/api.error';
import { fileTypeFromBuffer } from 'file-type';
import { createHash } from 'node:crypto';

const MAX_ATTACHMENT_SIZE = 5_242_880;
const MAX_TOTAL_ATTACHMENT_SIZE = 7_340_032;

const MIME_EXTENSIONS = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    '.docx',
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    '.xlsx',
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    '.pptx',
  ],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
} as const;

type AttachmentInput = {
  filename: string;
  contentType: keyof typeof MIME_EXTENSIONS;
  content: string;
};

export type ValidatedAttachment = {
  filename: string;
  contentType: AttachmentInput['contentType'];
  size: number;
  sha256: string;
  bytes: Uint8Array;
};

const invalidAttachment = (message: string): never => {
  throw new ApiError(message, 400, ERROR_CODES.INVALID_ATTACHMENT);
};

const decodeBase64 = (content: string): Uint8Array => {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(content) || content.length % 4 !== 0) {
    return invalidAttachment('Attachment content must be valid base64');
  }

  const bytes = Buffer.from(content, 'base64');
  if (bytes.length === 0 || bytes.toString('base64') !== content) {
    return invalidAttachment('Attachment content must be valid base64');
  }

  return bytes;
};

const validateFilename = (filename: string): void => {
  if (
    filename.length === 0 ||
    filename.length > 255 ||
    !/^[\w.\- ()]+$/.test(filename) ||
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\')
  ) {
    invalidAttachment('Attachment filename is invalid');
  }
};

const isUtf8Text = (bytes: Uint8Array): boolean => {
  const text = Buffer.from(bytes).toString('utf8');
  return Buffer.from(text, 'utf8').equals(Buffer.from(bytes));
};

const containsDisallowedTextMarkup = (bytes: Uint8Array): boolean => {
  const text = Buffer.from(bytes).toString('utf8');
  return /<\/?(html|script|svg|xml)\b|javascript\s*:/i.test(text);
};

const validateFileType = async (
  bytes: Uint8Array,
  contentType: AttachmentInput['contentType'],
): Promise<void> => {
  const detected = await fileTypeFromBuffer(bytes);
  if (contentType === 'text/plain' || contentType === 'text/csv') {
    if (detected || !isUtf8Text(bytes) || containsDisallowedTextMarkup(bytes)) {
      invalidAttachment('Attachment content does not match its content type');
    }
    return;
  }

  if (!detected || detected.mime !== contentType) {
    invalidAttachment('Attachment content does not match its content type');
  }
};

export const validateAttachments = async (
  attachments: readonly AttachmentInput[] = [],
): Promise<ValidatedAttachment[]> => {
  if (attachments.length > 5) {
    invalidAttachment('A maximum of 5 attachments is allowed');
  }

  let totalSize = 0;
  const validatedAttachments: ValidatedAttachment[] = [];

  for (const attachment of attachments) {
    validateFilename(attachment.filename);
    const extensions = MIME_EXTENSIONS[attachment.contentType];
    const filename = attachment.filename.toLowerCase();
    if (!extensions.some((extension) => filename.endsWith(extension))) {
      invalidAttachment('Attachment filename does not match its content type');
    }

    const bytes = decodeBase64(attachment.content);
    if (bytes.length > MAX_ATTACHMENT_SIZE) {
      invalidAttachment('Attachment exceeds the maximum size of 5 MB');
    }

    totalSize += bytes.length;
    if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
      invalidAttachment('Attachments exceed the maximum total size of 7 MB');
    }

    await validateFileType(bytes, attachment.contentType);
    validatedAttachments.push({
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes,
    });
  }

  return validatedAttachments;
};
