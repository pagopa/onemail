import { AttachmentsSchema } from '#dtos/email/common.dto';
import { describe, expect, it } from 'vitest';

const validAttachment = {
  filename: 'document.pdf',
  contentType: 'application/pdf',
  content: 'JVBERi0xLjc=',
};

describe('AttachmentsSchema', () => {
  it('accepts an empty list and a valid attachment', () => {
    expect(AttachmentsSchema.safeParse([]).success).toBe(true);
    expect(AttachmentsSchema.safeParse([validAttachment]).success).toBe(true);
  });

  it('rejects more than five attachments', () => {
    expect(
      AttachmentsSchema.safeParse(
        Array.from({ length: 6 }, () => validAttachment),
      ).success,
    ).toBe(false);
  });

  it.each(['../document.pdf', 'folder/document.pdf', 'file+.pdf', 'doc-à.pdf'])(
    'rejects filename %s',
    (filename) => {
      const result = AttachmentsSchema.safeParse([
        { ...validAttachment, filename },
      ]);
      expect(result.success).toBe(false);
      const errorMessage = result.success
        ? undefined
        : result.error.issues[0]?.message;
      expect(errorMessage).toBe('Attachment filename is invalid');
    },
  );

  it('rejects missing fields and unsupported content types', () => {
    expect(
      AttachmentsSchema.safeParse([{ filename: 'document.pdf' }]).success,
    ).toBe(false);
    expect(
      AttachmentsSchema.safeParse([
        { ...validAttachment, contentType: 'application/octet-stream' },
      ]).success,
    ).toBe(false);
  });

  it.each(['photo.jpg', 'photo.JPEG', 'report.final.pdf'])(
    'accepts filename %s when the extension matches the content type',
    (filename) => {
      const contentType = filename.toLowerCase().endsWith('pdf')
        ? 'application/pdf'
        : 'image/jpeg';

      expect(
        AttachmentsSchema.safeParse([
          { ...validAttachment, filename, contentType },
        ]).success,
      ).toBe(true);
    },
  );

  it.each([
    ['document.jpeg', 'application/pdf'],
    ['document', 'application/pdf'],
    ['notes.pdf', 'text/plain'],
    [
      'report.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  ])('rejects filename %s for content type %s', (filename, contentType) => {
    const result = AttachmentsSchema.safeParse([
      { ...validAttachment, filename, contentType },
    ]);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Attachment filename extension does not match content type',
    );
  });

  it('accepts a docx filename for the docx content type', () => {
    expect(
      AttachmentsSchema.safeParse([
        {
          ...validAttachment,
          filename: 'report.docx',
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ]).success,
    ).toBe(true);
  });
});
