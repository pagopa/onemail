import { validate } from '#middlewares/validateApiInput.middleware';
import { describe, expect, it, vi } from 'vitest';
import z, { ZodError } from 'zod';

describe('validateApiInput middleware', () => {
  it('validates body, query and params before calling next', () => {
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

  it('passes validation errors to next', () => {
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

  it('validates headers and assigns parsed values to request', () => {
    const next = vi.fn();
    const request = {
      body: {},
      query: {},
      params: {},
      headers: {
        'x-tenant-name': '  tenant-a  ',
        host: 'localhost',
      },
    };

    const middleware = validate({
      headers: z.object({
        'x-tenant-name': z.string().min(1).trim(),
      }),
    });

    middleware(request as never, {} as never, next);

    expect(request.headers['x-tenant-name']).toBe('tenant-a');
    expect(request.headers.host).toBe('localhost');
    expect(next).toHaveBeenCalledWith();
  });
});
