import { ERROR_CODES } from '#dtos/error.dto';
import {
  ConditionalCheckFailedException,
  DynamoDBServiceException,
  ProvisionedThroughputExceededException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const loadErrorHandler = async () => {
  const logger = { error: vi.fn() };

  vi.doMock('#config/logger', () => ({
    getLogger: vi.fn(() => logger),
  }));

  const { errorHandler } = await import('#middlewares/errorHandler.middleware');
  const response = createResponseMock();

  return { errorHandler, logger, response };
};

const registerZodErrorTest = () => {
  it('returns a bad request response for zod errors', async () => {
    const { errorHandler, logger, response } = await loadErrorHandler();
    const error = new ZodError([]);

    errorHandler(error, {} as never, response as never, vi.fn());

    expect(logger.error).toHaveBeenCalledWith('Error occurred:', { error });
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
  it('returns the original api error response when the error is already normalized', async () => {
    const { ApiError } = await import('#errors/api.error');
    const { errorHandler, response } = await loadErrorHandler();
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
  it('maps conflict-like DynamoDB errors to a conflict response', async () => {
    const { errorHandler, response } = await loadErrorHandler();

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

  it('maps conditional check failures to a conflict response', async () => {
    const { errorHandler, response } = await loadErrorHandler();

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
  it('maps validation-like DynamoDB errors to a bad request response', async () => {
    const { errorHandler, response } = await loadErrorHandler();

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
  it('maps throttling-like DynamoDB errors to a too many requests response', async () => {
    const { errorHandler, response } = await loadErrorHandler();

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
  it('falls back to a generic database error for unmapped DynamoDB exceptions', async () => {
    const { errorHandler, response } = await loadErrorHandler();

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
  it('falls back to an unexpected error response for unknown errors', async () => {
    const { errorHandler, response } = await loadErrorHandler();

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
  beforeEach(() => {
    vi.resetModules();
  });

  registerZodErrorTest();
  registerApiErrorTest();
  registerConflictMappingTests();
  registerValidationMappingTest();
  registerThrottleMappingTest();
  registerGenericDatabaseFallbackTest();
  registerUnexpectedErrorFallbackTest();
});
