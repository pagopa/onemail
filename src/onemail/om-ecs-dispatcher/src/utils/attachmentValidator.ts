import { ERROR_CODES } from '#dtos/error.dto';
import { ApiError } from '#errors/api.error';
import { fileTypeFromBuffer } from 'file-type';

const MAX_TOTAL_ATTACHMENT_SIZE = 7 * 1024 * 1024;

type AttachmentContentType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/jpg'
  | 'image/png'
  | 'image/heic'
  | 'application/vnd.ms-excel'
  | 'application/vnd.ms-powerpoint'
  | 'application/vnd.oasis.opendocument.text'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  | 'text/plain'
  | 'text/csv';

type AttachmentInput = {
  filename: string;
  contentType: AttachmentContentType;
  content: string;
};

export type ValidatedAttachment = {
  filename: string;
  contentType: AttachmentInput['contentType'];
  bytes: Uint8Array;
};

const invalidAttachment = (message: string): never => {
  throw new ApiError(message, 400, ERROR_CODES.INVALID_ATTACHMENT);
};

const isBase64Character = (character: string): boolean => {
  const code = character.charCodeAt(0);
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    character === '+' ||
    character === '/'
  );
};

const decodeBase64 = (content: string): Uint8Array => {
  if (!content || content.trim().length === 0) {
    invalidAttachment('Attachment content must be valid base64');
  }

  if (content.length % 4 !== 0) {
    invalidAttachment('Attachment content must be valid base64');
  }

  const firstPaddingIndex = content.indexOf('=');
  const contentEnd =
    firstPaddingIndex === -1 ? content.length : firstPaddingIndex;
  const paddingLength = content.length - contentEnd;
  if (paddingLength > 2) {
    invalidAttachment('Attachment content must be valid base64');
  }
  for (let index = 0; index < contentEnd; index += 1) {
    if (!isBase64Character(content[index])) {
      invalidAttachment('Attachment content must be valid base64');
    }
  }
  for (let index = contentEnd; index < content.length; index += 1) {
    if (content[index] !== '=') {
      invalidAttachment('Attachment content must be valid base64');
    }
  }

  try {
    const bytes = Buffer.from(content, 'base64');
    if (bytes.length === 0) {
      throw new ApiError(
        'Attachment content must be valid base64',
        400,
        ERROR_CODES.INVALID_ATTACHMENT,
      );
    }
    return bytes;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    invalidAttachment('Attachment content must be valid base64');
    throw new Error('Attachment content must be valid base64');
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
  contentType: AttachmentContentType,
): Promise<void> => {
  const detected = await fileTypeFromBuffer(bytes);
  const expectedMime = contentType === 'image/jpg' ? 'image/jpeg' : contentType;

  if (isTextContentType(contentType)) {
    validateTextContent(bytes, detected);
    return;
  }

  if (
    detected?.mime === expectedMime ||
    isAllowedContainer(contentType, detected?.mime)
  ) {
    return;
  }
  invalidAttachment('Attachment content does not match its content type');
};

const isTextContentType = (contentType: AttachmentContentType): boolean =>
  contentType === 'text/plain' || contentType === 'text/csv';

const validateTextContent = (
  bytes: Uint8Array,
  detected: Awaited<ReturnType<typeof fileTypeFromBuffer>>,
): void => {
  if (detected || !isUtf8Text(bytes) || containsDisallowedTextMarkup(bytes)) {
    invalidAttachment('Attachment content does not match its content type');
  }
};

const isAllowedContainer = (
  contentType: AttachmentContentType,
  detectedMime: string | undefined,
): boolean => {
  if (detectedMime === 'application/zip') {
    return (
      contentType.startsWith('application/vnd.openxmlformats.') ||
      contentType === 'application/vnd.oasis.opendocument.text'
    );
  }
  if (detectedMime === 'application/x-cfb') {
    return (
      contentType === 'application/vnd.ms-excel' ||
      contentType === 'application/vnd.ms-powerpoint'
    );
  }
  return (
    contentType === 'image/heic' &&
    (detectedMime === 'image/heic' || detectedMime === 'image/heif')
  );
};

export const validateAttachments = async (
  attachments: readonly AttachmentInput[] = [],
): Promise<ValidatedAttachment[]> => {
  let totalSize = 0;
  const validatedAttachments: ValidatedAttachment[] = [];

  for (const attachment of attachments) {
    const bytes = decodeBase64(attachment.content);
    totalSize += bytes.length;
    if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
      invalidAttachment('Attachments exceed the maximum total size of 7 MiB');
    }

    await validateFileType(bytes, attachment.contentType);
    validatedAttachments.push({
      filename: attachment.filename,
      contentType: attachment.contentType,
      bytes,
    });
  }

  return validatedAttachments;
};
