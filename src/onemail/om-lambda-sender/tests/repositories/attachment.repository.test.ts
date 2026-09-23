import { getAttachment } from '#repositories/attachment.repository';
import { describe, expect, it, vi } from 'vitest';

const s3Send = vi.hoisted(() => vi.fn());

vi.mock('#connectors/s3.connector', () => ({
  s3Client: { send: s3Send },
}));

describe('attachment.repository', () => {
  it('returns non-empty S3 object bytes', async () => {
    s3Send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: () => Promise.resolve(Uint8Array.from([1, 2])),
      },
    });

    await expect(getAttachment('bucket-a', 'key-a')).resolves.toEqual(
      Uint8Array.from([1, 2]),
    );
  });

  it('rejects an S3 response without a body', async () => {
    s3Send.mockResolvedValueOnce({ Body: undefined });

    await expect(getAttachment('bucket-a', 'key-a')).rejects.toThrow(
      'Attachment body is empty for key key-a',
    );
  });

  it('rejects an S3 response with an empty byte array', async () => {
    s3Send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: () => Promise.resolve(new Uint8Array()),
      },
    });

    await expect(getAttachment('bucket-a', 'key-a')).rejects.toThrow(
      'Attachment content is empty for key key-a',
    );
  });
});
