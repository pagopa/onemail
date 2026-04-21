import { registerOpenApiRoute } from '#utils/openapi';
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';

const registerPath = vi.hoisted(() => vi.fn());

vi.mock('#config/apidocs', () => ({
  registry: {
    registerPath,
  },
}));

describe('openapi utils', () => {
  it('registers a route with request body, params, query and schema responses', () => {
    const requestBody = z.object({ email: z.string().email() });
    const pathParams = z.object({ requestId: z.string() });
    const queryParams = z.object({ dryRun: z.boolean() });
    const successSchema = z.object({ requestId: z.string() });
    const headerSchema = z.object({ location: z.string() });

    registerOpenApiRoute({
      method: 'post',
      path: '/emails',
      summary: 'Create email',
      requestBody: {
        description: 'Email payload',
        content: 'application/custom+json',
        schema: requestBody,
      },
      pathParams,
      queryParams,
      responses: {
        201: {
          description: 'Created',
          schema: successSchema,
          headers: headerSchema,
          content: 'application/custom+json',
        },
      },
      tags: ['emails'],
    });

    expect(registerPath).toHaveBeenCalledTimes(1);
    expect(registerPath).toHaveBeenCalledWith({
      method: 'post',
      path: '/emails',
      tags: ['emails'],
      summary: 'Create email',
      request: {
        body: {
          description: 'Email payload',
          content: {
            'application/custom+json': {
              schema: requestBody,
            },
          },
        },
        params: pathParams,
        query: queryParams,
      },
      responses: expect.objectContaining({
        201: {
          description: 'Created',
          content: {
            'application/custom+json': {
              schema: successSchema,
            },
          },
          headers: headerSchema,
        },
        400: expect.objectContaining({
          description: 'Bad request - invalid data',
        }),
        500: expect.objectContaining({ description: 'Generic error' }),
      }),
    });
  });

  it('registers a route without optional request parts and supports schema-less responses', () => {
    registerOpenApiRoute({
      method: 'get',
      path: '/emails/status',
      summary: 'Get status',
      responses: {
        204: {
          description: 'No content',
        },
        200: z.object({ status: z.string() }),
      },
    });

    expect(registerPath).toHaveBeenCalledTimes(1);
    expect(registerPath).toHaveBeenCalledWith({
      method: 'get',
      path: '/emails/status',
      tags: undefined,
      summary: 'Get status',
      request: {},
      responses: expect.objectContaining({
        204: {
          description: 'No content',
        },
        200: {
          description: 'Response schema',
          content: {
            'application/json': {
              schema: expect.any(z.ZodType),
            },
          },
        },
      }),
    });
  });
});
