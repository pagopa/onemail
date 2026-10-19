import { deleteAttachments } from '#repositories/attachment.repository';
import { describe, expect, it, vi } from 'vitest';

import {
  expectCommandInput,
  getNthCommand,
} from '../../../testing/commandAssertions.js';

const s3Send = vi.hoisted(() => vi.fn());

vi.mock('#connectors/s3.connector', () => ({
  s3Client: { send: s3Send },
}));

describe('deleteAttachments', () => {
  it('sends a quiet DeleteObjects request for the given keys', async () => {
    s3Send.mockResolvedValue({});

    await deleteAttachments(['a.pdf', 'b.pdf']);

    expect(s3Send).toHaveBeenCalledTimes(1);
    expectCommandInput(s3Send, {
      Bucket: 'attachments-bucket',
      Delete: { Objects: [{ Key: 'a.pdf' }, { Key: 'b.pdf' }], Quiet: true },
    });
  });

  it('splits more than 1000 keys in multiple requests', async () => {
    s3Send.mockResolvedValue({});
    const keys = Array.from({ length: 1001 }, (_, index) => `key-${index}`);

    await deleteAttachments(keys);

    expect(s3Send).toHaveBeenCalledTimes(2);
    const first = getNthCommand(s3Send, 0) as {
      input: { Delete: { Objects: unknown[] } };
    };
    const second = getNthCommand(s3Send, 1) as {
      input: { Delete: { Objects: unknown[] } };
    };
    expect(first.input.Delete.Objects).toHaveLength(1000);
    expect(second.input.Delete.Objects).toEqual([{ Key: 'key-1000' }]);
  });

  it('throws when S3 reports per-key errors', async () => {
    s3Send.mockResolvedValue({
      Errors: [{ Key: 'a.pdf', Code: 'AccessDenied' }],
    });

    await expect(deleteAttachments(['a.pdf'])).rejects.toThrow(
      'Failed to delete 1 attachment(s): AccessDenied',
    );
  });

  it('does nothing when there are no keys', async () => {
    await deleteAttachments([]);

    expect(s3Send).not.toHaveBeenCalled();
  });
});
