import z from 'zod';

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

export const ErrorResponseSchema = z.object({
  message: z.string().describe('Error message'),
  details: z
    .array(
      z.object({
        message: z.string().describe('Detailed error message'),
      }),
    )
    .optional()
    .describe('Array of detailed error messages'),
  errorCode: z.string().optional().describe('Application-specific error code'),
  timestamp: z.string().describe('Timestamp of when the error occurred'),
});

export type ErrorResponseDTO = z.infer<typeof ErrorResponseSchema>;
