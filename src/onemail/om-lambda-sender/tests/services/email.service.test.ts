import {
  BulkEmailStatus,
  SendBulkEmailCommand,
  SendEmailCommand,
} from '@aws-sdk/client-sesv2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getNthCommand } from '../../../testing/commandAssertions.js';
import { makeEmailStatusHistoryItem } from '../__helpers__/emailFixtures.js';

describe('email.service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('sends a high priority email through SES and returns the message id', async () => {
    const sesSend = vi.fn().mockResolvedValue({ MessageId: 'ses-message-id' });
    const sesInput = { some: 'payload' };
    const item = makeEmailStatusHistoryItem();

    vi.doMock('#connectors/ses.connector', () => ({
      sesClient: { send: sesSend },
    }));
    vi.doMock('#utils/dbMapper', () => ({
      mapDbHighPriorityItemToSesModel: vi.fn(() => sesInput),
      mapDbLowPriorityItemToSesModel: vi.fn(),
    }));

    const { sendHighPriorityEmail } = await import('#services/email.service');

    await expect(sendHighPriorityEmail(item)).resolves.toBe('ses-message-id');
    expect(sesSend).toHaveBeenCalledTimes(1);
    const command = getNthCommand(sesSend, 0);
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect((command as SendEmailCommand).input).toEqual(sesInput);
  });

  it('returns undefined when SES returns no message id for a high priority email', async () => {
    const sesSend = vi.fn().mockResolvedValue({ MessageId: undefined });
    const sesInput = { some: 'payload' };
    const item = makeEmailStatusHistoryItem();

    vi.doMock('#connectors/ses.connector', () => ({
      sesClient: { send: sesSend },
    }));
    vi.doMock('#utils/dbMapper', () => ({
      mapDbHighPriorityItemToSesModel: vi.fn(() => sesInput),
      mapDbLowPriorityItemToSesModel: vi.fn(),
    }));

    const { sendHighPriorityEmail } = await import('#services/email.service');

    await expect(sendHighPriorityEmail(item)).resolves.toBeUndefined();
    expect(sesSend).toHaveBeenCalledTimes(1);
  });

  it('correlates low priority bulk send results with the original items', async () => {
    const sesSend = vi.fn().mockResolvedValue({
      BulkEmailEntryResults: [
        { Status: BulkEmailStatus.SUCCESS, MessageId: 'msg-1' },
        { Status: BulkEmailStatus.FAILED, Error: 'boom' },
      ],
    });
    const sesInput = { bulk: 'payload' };
    const items = [
      makeEmailStatusHistoryItem({ emailId: 'email-1' }),
      makeEmailStatusHistoryItem({ emailId: 'email-2' }),
    ];

    vi.doMock('#connectors/ses.connector', () => ({
      sesClient: { send: sesSend },
    }));
    vi.doMock('#utils/dbMapper', () => ({
      mapDbHighPriorityItemToSesModel: vi.fn(),
      mapDbLowPriorityItemToSesModel: vi.fn(() => sesInput),
    }));

    const { sendLowPriorityEmail } = await import('#services/email.service');

    await expect(sendLowPriorityEmail(items)).resolves.toEqual({
      successful: [
        {
          item: items[0],
          result: { Status: BulkEmailStatus.SUCCESS, MessageId: 'msg-1' },
        },
      ],
      failed: [
        {
          item: items[1],
          result: { Status: BulkEmailStatus.FAILED, Error: 'boom' },
        },
      ],
    });

    expect(sesSend).toHaveBeenCalledTimes(1);
    const command = getNthCommand(sesSend, 0);
    expect(command).toBeInstanceOf(SendBulkEmailCommand);
    expect((command as SendBulkEmailCommand).input).toEqual(sesInput);
  });
});
