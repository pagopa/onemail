import { ERROR_CODES } from '#dtos/error.dto';
import { ApiError } from '#errors/api.error';
import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';

// middleware for input validation (body, path param, query param)
export function validate(schemas: {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
  headers?: ZodType;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // validate and overwrite req with validated data
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) {
        const validatedQuery = schemas.query.parse(req.query);
        updateTargetWithValidatedData(req, 'query', validatedQuery);
      }
      if (schemas.params) {
        const validatedParams = schemas.params.parse(req.params);
        updateTargetWithValidatedData(req, 'params', validatedParams);
      }
      if (schemas.headers) {
        const validatedHeaders = schemas.headers.parse(req.headers);
        updateHeadersWithValidatedData(req, validatedHeaders);
      }
      next();
    } catch (error) {
      if (isAttachmentValidationError(error)) {
        next(
          new ApiError(
            'Invalid attachment',
            400,
            ERROR_CODES.INVALID_ATTACHMENT,
          ),
        );
        return;
      }
      next(error);
    }
  };
}

const isAttachmentValidationError = (error: unknown): boolean =>
  error instanceof ZodError &&
  error.issues.some((issue) => issue.path[0] === 'attachments');

// for req.query and req.params immutability in Express 5
const updateTargetWithValidatedData = (
  req: Request,
  target: 'params' | 'query' | 'body',
  validatedData: unknown,
) => {
  Object.defineProperty(req, target, {
    value: validatedData,
    writable: true,
    enumerable: true,
    configurable: true,
  });
};

const updateHeadersWithValidatedData = (
  req: Request,
  validatedData: unknown,
) => {
  Object.assign(req.headers, validatedData);
};
