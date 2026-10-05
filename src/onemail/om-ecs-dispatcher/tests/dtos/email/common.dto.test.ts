import { AttachmentsSchema } from '#dtos/email/common.dto';
import { EmailHighPriorityBodySchema } from '#dtos/email/emailHighPriority.dto';
import { EmailLowPriorityBodySchema } from '#dtos/email/emailLowPriority.dto';
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

describe('recipient PEC validation', () => {
  it.each([
    'pec.it',
    'pec.net',
    'cert.legalmail.it',
    'legalmail.it',
    'postecert.it',
    'arubapec.it',
    'mypec.eu',
    'gigapec.it',
    'postecertifica.it',
    'sicurezzapostale.it',
    'namirialpec.it',
    'spidmail.it',
  ])('rejects a PEC domain: %s', (domain) => {
    const result = EmailHighPriorityBodySchema.safeParse({
      from: { email: 'sender@example.com' },
      to: { email: `recipient@${domain}` },
      emailContent: { subject: 'Subject', html: '<p>Body</p>' },
    });

    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['to', 'email'],
          message: 'Domain recipient not supported',
        }),
      ]),
    );
  });

  it.each(['legalpec.it', 'testpec.eu', 'examplepec.it'])(
    'accepts a domain that does not start with pec or cert: %s',
    (domain) => {
      const result = EmailHighPriorityBodySchema.safeParse({
        from: { email: 'sender@example.com' },
        to: { email: `recipient@${domain}` },
        emailContent: { subject: 'Subject', html: '<p>Body</p>' },
      });

      expect(result.success).toBe(true);
    },
  );

  it('rejects the entire low priority request when one recipient is PEC', () => {
    const result = EmailLowPriorityBodySchema.safeParse({
      from: { email: 'sender@example.com' },
      templateId: 'template-id',
      sendingInfo: [
        { to: { email: 'valid@example.com' } },
        { to: { email: 'recipient@PEC.IT' } },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['sendingInfo', 1, 'to', 'email'],
          message: 'Domain recipient not supported',
        }),
      ]),
    );
  });

  it('does not reject PEC in sender or reply-to addresses', () => {
    const result = EmailLowPriorityBodySchema.safeParse({
      from: { email: 'sender@pec.it' },
      replyTo: { email: 'reply@legalmail.it' },
      templateId: 'template-id',
      sendingInfo: [{ to: { email: 'valid@example.com' } }],
    });

    expect(result.success).toBe(true);
  });

  it('does not reject pec in the local part', () => {
    const result = EmailHighPriorityBodySchema.safeParse({
      from: { email: 'sender@example.com' },
      to: { email: 'pec-recipient@example.com' },
      emailContent: { subject: 'Subject', html: '<p>Body</p>' },
    });

    expect(result.success).toBe(true);
  });
});
