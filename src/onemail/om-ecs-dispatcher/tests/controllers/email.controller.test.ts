import {
  getEmailStatus,
  sanitizeHtmlContent,
  sendEmailLowPriority,
  sendEmailTransactional,
} from '#controllers/email.controller';
import { ERROR_CODES } from '#dtos/error.dto';
import { describe, expect, it, vi } from 'vitest';

import {
  makeHighPriorityEmailDto,
  makeLowPriorityEmailDto,
} from '../__helpers__/dtoFactories.js';

const createResponseMock = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);

  return response;
};

const sendEmailTransactionalMock = vi.hoisted(() => vi.fn());
const sendEmailLowPriorityMock = vi.hoisted(() => vi.fn());
const getEmailStatusMock = vi.hoisted(() => vi.fn());

vi.mock('#services/email.service', () => ({
  sendEmailTransactional: sendEmailTransactionalMock,
  sendEmailLowPriority: sendEmailLowPriorityMock,
  getEmailStatus: getEmailStatusMock,
}));

describe('email.controller', () => {
  it('forwards transactional email requests to the service and returns accepted', async () => {
    sendEmailTransactionalMock.mockResolvedValue({ requestId: 'request-id-1' });
    const response = createResponseMock();

    await sendEmailTransactional(
      {
        body: makeHighPriorityEmailDto(),
        query: { dryRun: false },
      } as never,
      response as never,
    );

    expect(sendEmailTransactionalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.objectContaining({ email: 'user@example.com' }),
      }),
      false,
    );
    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({ requestId: 'request-id-1' });
  });

  it('rejects duplicate recipients for low priority emails when dryRun is false', async () => {
    const response = createResponseMock();

    await expect(
      sendEmailLowPriority(
        {
          body: makeLowPriorityEmailDto({
            sendingInfo: [
              { to: { email: 'user@example.com' } },
              { to: { email: 'USER@example.com' } },
            ],
          }),
          query: { dryRun: false },
        } as never,
        response as never,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      errorCode: ERROR_CODES.EMAIL_DUPLICATE_ERROR,
    });

    expect(response.status).not.toHaveBeenCalled();
  });

  it('skips duplicate validation for low priority dry runs and returns accepted', async () => {
    sendEmailLowPriorityMock.mockResolvedValue({ requestId: 'request-id-2' });
    const response = createResponseMock();

    await sendEmailLowPriority(
      {
        body: makeLowPriorityEmailDto({
          sendingInfo: [
            { to: { email: 'user@example.com' } },
            { to: { email: 'USER@example.com' } },
          ],
        }),
        query: { dryRun: true },
      } as never,
      response as never,
    );

    expect(sendEmailLowPriorityMock).toHaveBeenCalledWith(
      expect.objectContaining({ sendingInfo: expect.any(Array) }),
      true,
    );
    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({ requestId: 'request-id-2' });
  });

  it('returns sanitized html content as-is', async () => {
    const response = createResponseMock();

    await sanitizeHtmlContent(
      {
        body: { htmlContent: '<p>safe</p>' },
      } as never,
      response as never,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      sanitizedHtml: '<p>safe</p>',
    });
  });

  it('gets email status and returns ok', async () => {
    getEmailStatusMock.mockResolvedValue([{ emailId: 'email-id-1' }]);
    const response = createResponseMock();

    await getEmailStatus(
      {
        query: { requestId: 'request-id-3' },
      } as never,
      response as never,
    );

    expect(getEmailStatusMock).toHaveBeenCalledWith('request-id-3');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith([{ emailId: 'email-id-1' }]);
  });
});
