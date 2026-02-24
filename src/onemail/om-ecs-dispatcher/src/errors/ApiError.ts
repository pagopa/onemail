import { ErrorResponse } from '#dtos/error.dto';

export class ApiError extends Error implements ErrorResponse {
  details?: { message: string }[];
  errorCode?: string;
  statusCode: number;
  timestamp: string;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
    this.timestamp = new Date().toISOString();

    if (errorCode) {
      this.errorCode = errorCode;
    }
  }

  setDetails(details: { message: string }[]) {
    this.details = details;
  }

  toJSON(): ErrorResponse {
    return {
      message: this.message,
      timestamp: this.timestamp,
      errorCode: this.errorCode || undefined,
    };
  }
}
