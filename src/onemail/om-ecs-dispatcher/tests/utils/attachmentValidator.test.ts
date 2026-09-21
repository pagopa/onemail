import { validateAttachments } from '#utils/attachmentValidator';
import { describe, expect, it } from 'vitest';

const encode = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64');
const pdf = (): Buffer => Buffer.from('%PDF-1.7\nOneMail attachment');
const png = (): Buffer =>
  Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  ]);
const jpeg = (): Buffer =>
  Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);

const attachment = (
  bytes: Uint8Array,
  filename: string,
  contentType:
    | 'application/pdf'
    | 'image/jpeg'
    | 'image/jpg'
    | 'image/png'
    | 'text/plain'
    | 'text/csv',
) => ({ filename, contentType, content: encode(bytes) });

const expectInvalidAttachment = async (
  input: Parameters<typeof validateAttachments>[0],
) => {
  await expect(validateAttachments(input)).rejects.toMatchObject({
    name: 'ApiError',
    statusCode: 400,
    errorCode: 'A001',
  });
};

describe('validateAttachments', () => {
  it('returns decoded bytes for supported files', async () => {
    const bytes = pdf();
    const result = await validateAttachments([
      attachment(bytes, 'document.pdf', 'application/pdf'),
      attachment(png(), 'image.png', 'image/png'),
      attachment(jpeg(), 'photo.jpg', 'image/jpeg'),
      attachment(jpeg(), 'photo.jpg', 'image/jpg'),
      attachment(Buffer.from('first,last\n1,2'), 'data.csv', 'text/csv'),
    ]);

    expect(result).toHaveLength(5);
    expect(result[0]).toMatchObject({
      filename: 'document.pdf',
      contentType: 'application/pdf',
      bytes,
    });
  });

  it('accepts omitted and empty attachments', async () => {
    await expect(validateAttachments()).resolves.toEqual([]);
    await expect(validateAttachments([])).resolves.toEqual([]);
  });

  it('does not duplicate filename validation from the HTTP DTO schema', async () => {
    await expect(
      validateAttachments([
        attachment(pdf(), 'document.txt', 'application/pdf'),
      ]),
    ).resolves.toHaveLength(1);
  });

  it('does not duplicate the max-attachments HTTP DTO check', async () => {
    await expect(
      validateAttachments(
        Array.from({ length: 6 }, (_, index) =>
          attachment(
            Buffer.from(`file-${index}`),
            `file-${index}.txt`,
            'text/plain',
          ),
        ),
      ),
    ).resolves.toHaveLength(6);
  });

  it('accepts five files within the limits', async () => {
    await expect(
      validateAttachments(
        Array.from({ length: 5 }, (_, index) =>
          attachment(
            Buffer.from(`file-${index}`),
            `file-${index}.txt`,
            'text/plain',
          ),
        ),
      ),
    ).resolves.toHaveLength(5);
  });

  it.each([
    [
      'invalid base64',
      [{ filename: 'file.txt', contentType: 'text/plain', content: '%%%=' }],
    ],
    [
      'empty content',
      [{ filename: 'file.txt', contentType: 'text/plain', content: '' }],
    ],
    [
      'data URI content',
      [
        {
          filename: 'file.txt',
          contentType: 'text/plain',
          content: 'data:text/plain;base64,WA==',
        },
      ],
    ],
    ['MIME mismatch', [attachment(png(), 'file.pdf', 'application/pdf')]],
    [
      'disallowed markup',
      [
        attachment(
          Buffer.from('<script>alert(1)</script>'),
          'file.txt',
          'text/plain',
        ),
      ],
    ],
  ])('rejects %s', async (_name, input) => {
    expect.assertions(1);
    await expectInvalidAttachment(
      input as Parameters<typeof validateAttachments>[0],
    );
  });

  it('accepts one file and multiple files whose decoded total is exactly 7 MiB', async () => {
    await expect(
      validateAttachments([
        attachment(
          Buffer.alloc(7 * 1024 * 1024, 'a'),
          'large.txt',
          'text/plain',
        ),
      ]),
    ).resolves.toHaveLength(1);

    await expect(
      validateAttachments([
        attachment(
          Buffer.alloc(4 * 1024 * 1024, 'a'),
          'first.txt',
          'text/plain',
        ),
        attachment(
          Buffer.alloc(3 * 1024 * 1024, 'b'),
          'second.txt',
          'text/plain',
        ),
      ]),
    ).resolves.toHaveLength(2);
  });

  it('rejects a file and multiple files whose decoded total exceeds 7 MiB', async () => {
    expect.assertions(2);
    await expectInvalidAttachment([
      attachment(
        Buffer.alloc(7 * 1024 * 1024 + 1, 'a'),
        'large.txt',
        'text/plain',
      ),
    ]);
    await expectInvalidAttachment([
      attachment(Buffer.alloc(4 * 1024 * 1024, 'a'), 'first.txt', 'text/plain'),
      attachment(
        Buffer.alloc(3 * 1024 * 1024 + 1, 'b'),
        'second.txt',
        'text/plain',
      ),
    ]);
  });
});
