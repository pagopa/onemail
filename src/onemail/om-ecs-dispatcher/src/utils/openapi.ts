import { registry } from '#config/apidocs';
import { ErrorResponseSchema } from '#dtos/error.dto';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';

const applicationJsonContentType = 'application/json';

type OpenApiResponse = OpenApiResponseConfig | z.ZodType;
interface OpenApiResponseConfig {
  description?: string;
  schema?: z.ZodType;
  headers?: z.ZodObject;
  content?: string;
}
type OpenApiResponses = Record<number, OpenApiResponse>;

const defaultErrorResponses = {
  [StatusCodes.BAD_REQUEST]: {
    description: 'Bad request - invalid data',
    content: { [applicationJsonContentType]: { schema: ErrorResponseSchema } },
  },
  [StatusCodes.UNAUTHORIZED]: {
    description:
      'Unauthorized - authentication required or invalid credentials',
    content: { [applicationJsonContentType]: { schema: ErrorResponseSchema } },
  },
  [StatusCodes.FORBIDDEN]: {
    description: 'Forbidden - permission denied to perform the request',
    content: { [applicationJsonContentType]: { schema: ErrorResponseSchema } },
  },
  [StatusCodes.NOT_FOUND]: {
    description: 'Resource not found',
    content: { [applicationJsonContentType]: { schema: ErrorResponseSchema } },
  },
  [StatusCodes.CONFLICT]: {
    description: 'Conflict - resource already exists',
    content: { [applicationJsonContentType]: { schema: ErrorResponseSchema } },
  },
  [StatusCodes.TOO_MANY_REQUESTS]: {
    description: 'Too many requests',
    content: { [applicationJsonContentType]: { schema: ErrorResponseSchema } },
  },
  [StatusCodes.INTERNAL_SERVER_ERROR]: {
    description: 'Generic error',
    content: { [applicationJsonContentType]: { schema: ErrorResponseSchema } },
  },
};

const buildResponses = (responses: OpenApiResponses) => {
  const customResponses: Record<number, unknown> = {};

  for (const statusCode in responses) {
    if (!Object.prototype.hasOwnProperty.call(responses, statusCode)) continue;
    const status = Number(statusCode);
    const response = responses[status];

    const responseConfig: OpenApiResponseConfig =
      response instanceof z.ZodType ? { schema: response } : response;

    customResponses[status] = {
      description: responseConfig.description || 'Response schema',
      // add response schema only it it exists
      ...(responseConfig.schema
        ? {
            content: {
              [responseConfig.content || applicationJsonContentType]: {
                schema: responseConfig.schema,
              },
            },
          }
        : {}),
      // add response headers only it they exist
      ...(responseConfig.headers ? { headers: responseConfig.headers } : {}), // add headers only if they exists
    };
  }

  return {
    ...customResponses,
    ...defaultErrorResponses,
  };
};

type OpenApiRequestBody = OpenApiRequestBodyConfig | z.ZodType;
interface OpenApiRequestBodyConfig {
  description?: string;
  content?: string;
  schema: z.ZodType;
}

export const registerOpenApiRoute = ({
  method,
  path,
  summary,
  requestBody,
  pathParams,
  queryParams,
  responses,
  tags,
  headers,
  isAuthenticated = false,
}: {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  summary: string;
  requestBody?: OpenApiRequestBody;
  pathParams?: z.ZodObject;
  queryParams?: z.ZodObject;
  responses: OpenApiResponses;
  tags?: string[];
  headers?: z.ZodObject;
  isAuthenticated?: boolean;
}) => {
  const requestBodyConfig =
    requestBody instanceof z.ZodType ? { schema: requestBody } : requestBody;

  registry.registerPath({
    method,
    path,
    tags,
    summary,
    ...(isAuthenticated && { security: [{ api_key: [] }] }),
    request: {
      // add request body only if it exists
      ...(requestBodyConfig
        ? {
            body: {
              description: requestBodyConfig.description || 'Request body',
              content: {
                [requestBodyConfig.content || applicationJsonContentType]: {
                  schema: requestBodyConfig.schema,
                },
              },
            },
          }
        : {}),
      // add path params only if they exist
      ...(pathParams ? { params: pathParams } : {}),
      // add query param only if they exist
      ...(queryParams ? { query: queryParams } : {}),
      // add headers only if they exist
      ...(headers ? { headers } : {}),
    },
    responses: buildResponses(responses),
  });
};
