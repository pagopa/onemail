export const ERROR_CODES = {
  INVALID_INPUT_DATA: 'I001',
  DB_ERROR: {
    GENERIC: 'D001',
    CONFLICT: 'D002',
    INVALID_INPUT: 'D003',
    THROTTLED: 'D004',
  },
  RESOURCE_NOT_FOUND: 'R001',
  UNEXPECTED_ERROR: 'G001',
};

export type ErrorResponse = {
  message: string;
  details?: { message: string }[];
  errorCode?: string;
  timestamp: string;
};
