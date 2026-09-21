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

  it('throws validation errors instead of mapping them in the middleware', () => {
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

    expect(() => middleware(request as never, {} as never, next)).toThrow(
      ZodError,
    );
    expect(next).not.toHaveBeenCalled();
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

  it('passes attachment schema errors through as ZodError', () => {
    const next = vi.fn();
    const middleware = validate({
      body: z.object({
        attachments: z.array(
          z.object({
            content: z.string().min(1),
          }),
        ),
      }),
    });

    expect(() =>
      middleware(
        { body: { attachments: [{ content: '' }] } } as never,
        {} as never,
        next,
      ),
    ).toThrow(ZodError);
    expect(next).not.toHaveBeenCalled();
  });

  it('preserves non-attachment schema errors as a thrown ZodError', () => {
    const next = vi.fn();
    const middleware = validate({
      body: z.object({ subject: z.string().min(1) }),
    });

    expect(() =>
      middleware({ body: { subject: '' } } as never, {} as never, next),
    ).toThrow(ZodError);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts five attachment entries', () => {
    const next = vi.fn();
    const middleware = validate({
      body: z.object({
        attachments: z.array(z.object({ content: z.string().min(1) })).max(5),
      }),
    });

    middleware(
      {
        body: {
          attachments: Array.from({ length: 5 }, () => ({
            content: 'encoded',
          })),
        },
      } as never,
      {} as never,
      next,
    );

    expect(next).toHaveBeenCalledWith();
  });
});
