import { hasNonFinalEmailsInRequest } from '#repositories/email.repository';
import { FINAL_EMAIL_STATUSES } from '#utils/constants';
import { describe, expect, it, vi } from 'vitest';

import {
  expectCommandInput,
  getNthCommand,
} from '../../../testing/commandAssertions.js';

const dynamoSend = vi.hoisted(() => vi.fn());

vi.mock('#connectors/dynamo.connector', () => ({
  dynamoClient: { send: dynamoSend },
}));

describe('hasOpenEmailsInRequest', () => {
  it('queries the request GSI excluding the current email and final statuses', async () => {
    dynamoSend.mockResolvedValue({ Count: 0 });

    await hasNonFinalEmailsInRequest('request-1', 'email-1');

    const command = expectCommandInput(dynamoSend, {
      TableName: 'email-table',
      IndexName: 'request-id-gsi',
      KeyConditionExpression: '#requestId = :requestId',
      Select: 'COUNT',
    }) as { input: Record<string, unknown> };
    expect(command.input['FilterExpression']).toMatch(
      /^#emailId <> :excludedEmailId AND NOT \(#status IN \(/,
    );
    const values = command.input['ExpressionAttributeValues'] as Record<
      string,
      string
    >;
    expect(values[':requestId']).toBe('request-1');
    expect(values[':excludedEmailId']).toBe('email-1');
    expect(
      Object.entries(values)
        .filter(([placeholder]) => placeholder.startsWith(':finalStatus'))
        .map(([, status]) => status),
    ).toEqual([...FINAL_EMAIL_STATUSES]);
  });

  it('paginates and returns false when no page has open emails', async () => {
    dynamoSend
      .mockResolvedValueOnce({
        Count: 0,
        LastEvaluatedKey: { emailId: 'email-9' },
      })
      .mockResolvedValueOnce({ Count: 0 });

    await expect(
      hasNonFinalEmailsInRequest('request-1', 'email-1'),
    ).resolves.toBe(false);

    expect(dynamoSend).toHaveBeenCalledTimes(2);
    const secondCommand = getNthCommand(dynamoSend, 1) as {
      input: Record<string, unknown>;
    };
    expect(secondCommand.input['ExclusiveStartKey']).toEqual({
      emailId: 'email-9',
    });
  });

  it('returns true as soon as a page contains an open email', async () => {
    dynamoSend
      .mockResolvedValueOnce({
        Count: 0,
        LastEvaluatedKey: { emailId: 'email-9' },
      })
      .mockResolvedValueOnce({
        Count: 1,
        LastEvaluatedKey: { emailId: 'email-20' },
      });

    await expect(
      hasNonFinalEmailsInRequest('request-1', 'email-1'),
    ).resolves.toBe(true);
    expect(dynamoSend).toHaveBeenCalledTimes(2);
  });

  it('treats a missing Count as no open emails', async () => {
    dynamoSend.mockResolvedValue({});

    await expect(
      hasNonFinalEmailsInRequest('request-1', 'email-1'),
    ).resolves.toBe(false);
  });
});
