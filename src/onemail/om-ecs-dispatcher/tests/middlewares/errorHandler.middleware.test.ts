import { ERROR_CODES } from '#dtos/error.dto';
import { ApiError } from '#errors/api.error';
import { errorHandler } from '#middlewares/errorHandler.middleware';
import {
  ConditionalCheckFailedException,
  DynamoDBServiceException,
  ProvisionedThroughputExceededException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

const createResponseMock = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);

  return response;
};

const createDynamoDbServiceError = (name: string) => {
  const error = new DynamoDBServiceException({
    name,
    $fault: 'client',
    $metadata: {},
    message: `${name} message`,
  });

  error.name = name;

  return error;
};

const loadErrorHandler = () => {
  const response = createResponseMock();

  return { errorHandler, response };
};

const registerZodErrorTest = () => {
  it('returns a bad request response for zod errors', () => {
    const { errorHandler, response } = loadErrorHandler();
    const error = new ZodError([]);

    errorHandler(error, {} as never, response as never, vi.fn());

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid data',
        errorCode: ERROR_CODES.INVALID_INPUT_DATA,
      }),
    );
  });
};

const registerApiErrorTest = () => {
  it('returns the original api error response when the error is already normalized', () => {
    const { errorHandler, response } = loadErrorHandler();
    const error = new ApiError('Forbidden operation', 403, 'X001');

    errorHandler(error, {} as never, response as never, vi.fn());

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Forbidden operation',
        errorCode: 'X001',
      }),
    );
  });
};

const registerConflictMappingTests = () => {
  it('maps conflict-like DynamoDB errors to a conflict response', () => {
    const { errorHandler, response } = loadErrorHandler();

    errorHandler(
      new TransactionCanceledException({
        $metadata: {},
        message: 'Transaction cancelled',
      }),
      {} as never,
      response as never,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: ERROR_CODES.DB_ERROR.CONFLICT,
      }),
    );
  });

  it('maps conditional check failures to a conflict response', () => {
    const { errorHandler, response } = loadErrorHandler();

    errorHandler(
      new ConditionalCheckFailedException({
        $metadata: {},
        message: 'Conditional check failed',
      }),
      {} as never,
      response as never,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: ERROR_CODES.DB_ERROR.CONFLICT,
      }),
    );
  });
};

const registerValidationMappingTest = () => {
  it('maps validation-like DynamoDB errors to a bad request response', () => {
    const { errorHandler, response } = loadErrorHandler();

    errorHandler(
      createDynamoDbServiceError('ValidationException'),
      {} as never,
      response as never,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: ERROR_CODES.DB_ERROR.INVALID_INPUT,
      }),
    );
  });
};

const registerThrottleMappingTest = () => {
  it('maps throttling-like DynamoDB errors to a too many requests response', () => {
    const { errorHandler, response } = loadErrorHandler();

    errorHandler(
      new ProvisionedThroughputExceededException({
        $metadata: {},
        message: 'Provisioned throughput exceeded',
      }),
      {} as never,
      response as never,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: ERROR_CODES.DB_ERROR.THROTTLED,
      }),
    );
  });
};

const registerGenericDatabaseFallbackTest = () => {
  it('falls back to a generic database error for unmapped DynamoDB exceptions', () => {
    const { errorHandler, response } = loadErrorHandler();

    errorHandler(
      createDynamoDbServiceError('InternalServerError'),
      {} as never,
      response as never,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: ERROR_CODES.DB_ERROR.GENERIC,
      }),
    );
  });
};

const registerUnexpectedErrorFallbackTest = () => {
  it('falls back to an unexpected error response for unknown errors', () => {
    const { errorHandler, response } = loadErrorHandler();

    errorHandler(new Error('boom'), {} as never, response as never, vi.fn());

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Internal Server Error',
        errorCode: ERROR_CODES.UNEXPECTED_ERROR,
      }),
    );
  });
};

describe('errorHandler middleware', () => {
  registerZodErrorTest();
  registerApiErrorTest();
  registerConflictMappingTests();
  registerValidationMappingTest();
  registerThrottleMappingTest();
  registerGenericDatabaseFallbackTest();
  registerUnexpectedErrorFallbackTest();
});
