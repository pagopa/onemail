import { getLogger } from '#config/logger';
import { ERROR_CODES } from '#dtos/error.dto';
import { ApiError } from '#errors/api.error';
import {
  ConditionalCheckFailedException,
  DynamoDBServiceException,
  ProvisionedThroughputExceededException,
  RequestLimitExceeded,
  ThrottlingException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import { NextFunction, Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';

const logger = getLogger();

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  logger.error('Error occurred:', { error: err });

  let errorResponse: ApiError;

  if (err instanceof ZodError) {
    errorResponse = new ApiError(
      'Invalid data',
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.INVALID_INPUT_DATA,
    );
  } else if (err instanceof DynamoDBServiceException) {
    errorResponse = handleDynamoDBError(err);
  } else if (err instanceof ApiError) {
    errorResponse = err;
  } else {
    errorResponse = new ApiError(
      ReasonPhrases.INTERNAL_SERVER_ERROR,
      StatusCodes.INTERNAL_SERVER_ERROR,
      ERROR_CODES.UNEXPECTED_ERROR,
    );
  }

  res.status(errorResponse.statusCode).json(errorResponse.toJSON());
};

function handleDynamoDBError(err: DynamoDBServiceException): ApiError {
  const errName = err.name;

  if (
    err instanceof TransactionCanceledException ||
    err instanceof ConditionalCheckFailedException
  ) {
    return new ApiError(
      'The request could not be completed due to a conflict with the current state of the resource',
      StatusCodes.CONFLICT,
      ERROR_CODES.DB_ERROR.CONFLICT,
    );
  }

  if (
    errName === 'ValidationException' ||
    errName === 'SerializationException'
  ) {
    return new ApiError(
      'The data provided is invalid or malformed',
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.DB_ERROR.INVALID_INPUT,
    );
  }

  if (
    err instanceof ProvisionedThroughputExceededException ||
    err instanceof RequestLimitExceeded ||
    err instanceof ThrottlingException
  ) {
    return new ApiError(
      'Too many requests to the database, please try again later',
      StatusCodes.TOO_MANY_REQUESTS,
      ERROR_CODES.DB_ERROR.THROTTLED,
    );
  }

  return new ApiError(
    'An unexpected database error occurred',
    StatusCodes.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DB_ERROR.GENERIC,
  );
}
