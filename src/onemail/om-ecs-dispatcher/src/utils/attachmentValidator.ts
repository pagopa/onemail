import type {
  AttachmentAllowedContentType,
  AttachmentInputDTO,
} from '#dtos/email/common.dto';

import { ERROR_CODES } from '#dtos/error.dto';
import { ApiError } from '#errors/api.error';
import { fileTypeFromBuffer } from 'file-type';

const MAX_TOTAL_ATTACHMENT_SIZE = 7 * 1024 * 1024;

export type ValidatedAttachment = {
  filename: string;
  contentType: AttachmentAllowedContentType;
  bytes: Uint8Array;
};

const throwInvalidAttachment = (message: string): never => {
  throw new ApiError(message, 400, ERROR_CODES.INVALID_ATTACHMENT);
};

const decodeBase64 = (content: string): Uint8Array => {
  const bytes = Buffer.from(content, 'base64');
  if (bytes.length === 0) {
    throwInvalidAttachment('Attachment content must be valid base64');
  }
  return bytes;
};

const isUtf8Text = (bytes: Uint8Array): boolean => {
  const text = Buffer.from(bytes).toString('utf8');
  return Buffer.from(text, 'utf8').equals(Buffer.from(bytes));
};

const containsDisallowedTextMarkup = (bytes: Uint8Array): boolean => {
  const text = Buffer.from(bytes).toString('utf8');
  return /<\/?(html|script|svg|xml)\b|javascript\s*:/i.test(text);
};

const validateDecodedFileType = async (
  bytes: Uint8Array,
  contentType: AttachmentAllowedContentType,
): Promise<void> => {
  const detected = await fileTypeFromBuffer(bytes);

  if (isTextContentType(contentType)) {
    validateTextContent(bytes, detected);
    return;
  }

  if (
    detected?.mime === contentType ||
    isAllowedContainer(contentType, detected?.mime)
  ) {
    return;
  }
  throwInvalidAttachment('Attachment content does not match its content type');
};

const isTextContentType = (
  contentType: AttachmentAllowedContentType,
): boolean => contentType === 'text/plain' || contentType === 'text/csv';

const validateTextContent = (
  bytes: Uint8Array,
  detected: Awaited<ReturnType<typeof fileTypeFromBuffer>>,
): void => {
  if (detected || !isUtf8Text(bytes) || containsDisallowedTextMarkup(bytes)) {
    throwInvalidAttachment(
      'Attachment content does not match its content type',
    );
  }
};

const isAllowedContainer = (
  contentType: AttachmentAllowedContentType,
  detectedMime: string | undefined,
): boolean => {
  // For office/openDocument files, the detected mime type is often 'application/zip'
  if (detectedMime === 'application/zip') {
    return (
      contentType.startsWith('application/vnd.openxmlformats.') ||
      contentType === 'application/vnd.oasis.opendocument.text'
    );
  }
  // For older Microsoft Office files, the detected mime type is often 'application/x-cfb'
  if (detectedMime === 'application/x-cfb') {
    return (
      contentType === 'application/msword' ||
      contentType === 'application/vnd.ms-excel' ||
      contentType === 'application/vnd.ms-powerpoint'
    );
  }
  return false;
};

export const validateAttachments = async (
  attachments: readonly AttachmentInputDTO[] = [],
): Promise<ValidatedAttachment[]> => {
  let totalSize = 0;
  const validatedAttachments: ValidatedAttachment[] = [];

  for (const attachment of attachments) {
    const bytes = decodeBase64(attachment.content);
    totalSize += bytes.length;
    if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
      throwInvalidAttachment(
        'Attachments exceed the maximum total size of 7 MiB',
      );
    }

    await validateDecodedFileType(bytes, attachment.contentType);
    validatedAttachments.push({
      filename: attachment.filename,
      contentType: attachment.contentType,
      bytes,
    });
  }

  return validatedAttachments;
};
