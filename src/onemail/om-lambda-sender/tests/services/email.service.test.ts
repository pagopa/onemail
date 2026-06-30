import {
  sendHighPriorityEmail,
  sendLowPriorityEmail,
} from '#services/email.service';
import {
  BulkEmailStatus,
  SendBulkEmailCommand,
  SendEmailCommand,
} from '@aws-sdk/client-sesv2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getNthCommand } from '../../../testing/commandAssertions.js';
import { makeEmailStatusHistoryItem } from '../__helpers__/emailFixtures.js';

const sesSend = vi.hoisted(() => vi.fn());
const mapDbHighPriorityItemToSesModel = vi.hoisted(() => vi.fn());
const mapDbLowPriorityItemToSesModel = vi.hoisted(() => vi.fn());
const envConfig = vi.hoisted(() => ({
  ses: {
    sesMultiRegionEndpointId: undefined as string | undefined,
  },
}));

vi.mock('#connectors/ses.connector', () => ({
  sesClient: { send: sesSend },
}));
vi.mock('#config/env', () => ({
  default: envConfig,
}));
vi.mock('#utils/dbMapper', () => ({
  mapDbHighPriorityItemToSesModel,
  mapDbLowPriorityItemToSesModel,
}));

describe('email.service', () => {
  beforeEach(() => {
    envConfig.ses.sesMultiRegionEndpointId = undefined;
    vi.clearAllMocks();
  });

  it('sends a high priority email through SES and returns the message id', async () => {
    const sesInput = { some: 'payload' };
    const item = makeEmailStatusHistoryItem();
    sesSend.mockResolvedValue({ MessageId: 'ses-message-id' });
    mapDbHighPriorityItemToSesModel.mockReturnValue(sesInput);

    await expect(sendHighPriorityEmail(item)).resolves.toBe('ses-message-id');
    expect(sesSend).toHaveBeenCalledTimes(1);
    const command = getNthCommand(sesSend, 0);
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect((command as SendEmailCommand).input).toEqual(sesInput);
  });

  it('adds the SES multi-region endpoint id to high priority email requests when configured', async () => {
    const sesInput = { some: 'payload' };
    const item = makeEmailStatusHistoryItem();
    envConfig.ses.sesMultiRegionEndpointId = 'ses-endpoint-id';
    sesSend.mockResolvedValue({ MessageId: 'ses-message-id' });
    mapDbHighPriorityItemToSesModel.mockReturnValue(sesInput);

    await expect(sendHighPriorityEmail(item)).resolves.toBe('ses-message-id');

    const command = getNthCommand(sesSend, 0);
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect((command as SendEmailCommand).input).toEqual({
      ...sesInput,
      EndpointId: 'ses-endpoint-id',
    });
  });

  it('returns undefined when SES returns no message id for a high priority email', async () => {
    const sesInput = { some: 'payload' };
    const item = makeEmailStatusHistoryItem();
    sesSend.mockResolvedValue({ MessageId: undefined });
    mapDbHighPriorityItemToSesModel.mockReturnValue(sesInput);

    await expect(sendHighPriorityEmail(item)).resolves.toBeUndefined();
    expect(sesSend).toHaveBeenCalledTimes(1);
  });

  it('correlates low priority bulk send results with the original items', async () => {
    const sesInput = { bulk: 'payload' };
    const items = [
      makeEmailStatusHistoryItem({ emailId: 'email-1' }),
      makeEmailStatusHistoryItem({ emailId: 'email-2' }),
    ];
    sesSend.mockResolvedValue({
      BulkEmailEntryResults: [
        { Status: BulkEmailStatus.SUCCESS, MessageId: 'msg-1' },
        { Status: BulkEmailStatus.FAILED, Error: 'boom' },
      ],
    });
    mapDbLowPriorityItemToSesModel.mockReturnValue(sesInput);

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

  it('adds the SES multi-region endpoint id to bulk email requests when configured', async () => {
    const sesInput = { bulk: 'payload' };
    const items = [makeEmailStatusHistoryItem({ emailId: 'email-1' })];
    envConfig.ses.sesMultiRegionEndpointId = 'ses-endpoint-id';
    sesSend.mockResolvedValue({ BulkEmailEntryResults: [] });
    mapDbLowPriorityItemToSesModel.mockReturnValue(sesInput);

    await expect(sendLowPriorityEmail(items)).resolves.toEqual({
      successful: [],
      failed: [],
    });

    const command = getNthCommand(sesSend, 0);
    expect(command).toBeInstanceOf(SendBulkEmailCommand);
    expect((command as SendBulkEmailCommand).input).toEqual({
      ...sesInput,
      EndpointId: 'ses-endpoint-id',
    });
  });
});
