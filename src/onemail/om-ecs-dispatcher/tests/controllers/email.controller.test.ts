import { ERROR_CODES } from '#dtos/error.dto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  makeHighPriorityEmailDto,
  makeLowPriorityEmailDto,
} from '../setup/dtoFactories.js';

const createResponseMock = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);

  return response;
};

const mockEmailService = (
  overrides: Partial<{
    sendEmailTransactional: ReturnType<typeof vi.fn>;
    sendEmailLowPriority: ReturnType<typeof vi.fn>;
    getEmailStatus: ReturnType<typeof vi.fn>;
  }> = {},
) => {
  const service = {
    sendEmailTransactional: vi.fn(),
    sendEmailLowPriority: vi.fn(),
    getEmailStatus: vi.fn(),
    ...overrides,
  };

  vi.doMock('#services/email.service', () => service);

  return service;
};

describe('email.controller', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('forwards transactional email requests to the service and returns accepted', async () => {
    const sendEmailTransactional = vi.fn().mockResolvedValue({
      requestId: 'request-id-1',
    });
    mockEmailService({ sendEmailTransactional });

    const { sendEmailTransactional: controller } =
      await import('#controllers/email.controller');
    const response = createResponseMock();

    await controller(
      {
        body: makeHighPriorityEmailDto(),
        query: { dryRun: false },
        headers: { 'tenant-id': 'tenant-a' },
      } as never,
      response as never,
    );

    expect(sendEmailTransactional).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.objectContaining({ email: 'user@example.com' }),
      }),
      false,
      'tenant-a',
    );
    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({ requestId: 'request-id-1' });
  });

  it('rejects duplicate recipients for low priority emails when dryRun is false', async () => {
    mockEmailService();

    const { sendEmailLowPriority: controller } =
      await import('#controllers/email.controller');
    const response = createResponseMock();

    await expect(
      controller(
        {
          body: makeLowPriorityEmailDto({
            sendingInfo: [
              { to: { email: 'user@example.com' } },
              { to: { email: 'USER@example.com' } },
            ],
          }),
          query: { dryRun: false },
          headers: { 'tenant-id': 'tenant-a' },
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
    const sendEmailLowPriority = vi.fn().mockResolvedValue({
      requestId: 'request-id-2',
    });
    mockEmailService({ sendEmailLowPriority });

    const { sendEmailLowPriority: controller } =
      await import('#controllers/email.controller');
    const response = createResponseMock();

    await controller(
      {
        body: makeLowPriorityEmailDto({
          sendingInfo: [
            { to: { email: 'user@example.com' } },
            { to: { email: 'USER@example.com' } },
          ],
        }),
        query: { dryRun: true },
        headers: { 'tenant-id': 'tenant-a' },
      } as never,
      response as never,
    );

    expect(sendEmailLowPriority).toHaveBeenCalledWith(
      expect.objectContaining({ sendingInfo: expect.any(Array) }),
      true,
      'tenant-a',
    );
    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({ requestId: 'request-id-2' });
  });

  it('returns sanitized html content as-is', async () => {
    mockEmailService();

    const { sanitizeHtmlContent } =
      await import('#controllers/email.controller');
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
    const getEmailStatus = vi
      .fn()
      .mockResolvedValue([{ emailId: 'email-id-1' }]);
    mockEmailService({ getEmailStatus });

    const { getEmailStatus: controller } =
      await import('#controllers/email.controller');
    const response = createResponseMock();

    await controller(
      {
        query: { requestId: 'request-id-3' },
        headers: { 'tenant-id': 'tenant-a' },
      } as never,
      response as never,
    );

    expect(getEmailStatus).toHaveBeenCalledWith('request-id-3', 'tenant-a');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith([{ emailId: 'email-id-1' }]);
  });
});
