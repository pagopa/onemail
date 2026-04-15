import { beforeEach, describe, expect, it, vi } from 'vitest';
import z, { ZodError } from 'zod';

describe('validateApiInput middleware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('validates body, query and params before calling next', async () => {
    const { validate } =
      await import('#middlewares/validateApiInput.middleware');
    const next = vi.fn();
    const request = {
      body: {
        subject: '  subject  ',
      },
      query: {
        page: '2',
      },
      params: {
        emailId: 'abc123',
      },
    };

    const middleware = validate({
      body: z.object({
        subject: z.string().trim(),
      }),
      query: z.object({
        page: z.coerce.number().int().positive(),
      }),
      params: z.object({
        emailId: z.string().transform((value) => value.toUpperCase()),
      }),
    });

    middleware(request as never, {} as never, next);

    expect(request.body).toEqual({ subject: 'subject' });
    expect(request.query).toEqual({ page: 2 });
    expect(request.params).toEqual({ emailId: 'ABC123' });
    expect(next).toHaveBeenCalledWith();
  });

  it('passes validation errors to next', async () => {
    const { validate } =
      await import('#middlewares/validateApiInput.middleware');
    const next = vi.fn();
    const request = {
      body: {},
      query: {
        page: 'not-a-number',
      },
      params: {},
    };

    const middleware = validate({
      query: z.object({
        page: z.coerce.number().int().positive(),
      }),
    });

    middleware(request as never, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ZodError);
  });
});
