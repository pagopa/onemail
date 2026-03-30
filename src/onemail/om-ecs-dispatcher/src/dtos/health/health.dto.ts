import z from 'zod';

export enum HealthStatus {
  Healthy = 'Healthy',
  Unhealthy = 'Unhealthy',
}

export enum ServiceStatus {
  Initialized = 'Initialized',
  NotInitialized = 'NotInitialized',
  Unavailable = 'Unavailable',
}

const HealthStatusSchema = z
  .enum(HealthStatus)
  .describe('Overall health status of the service')
  .openapi('HealthStatus');

const HealthCommonSchema = z.object({
  status: HealthStatusSchema,
  timestamp: z.iso.datetime().describe('Timestamp of the health check'),
  uptime: z.number().describe('Uptime of the service in seconds'),
});

export const HealthResponseSchema = HealthCommonSchema.extend({
  services: z
    .object({
      db: z.enum(ServiceStatus).describe('Status of the DynamoDB service'),
      queue: z
        .object({
          highPriority: z
            .enum(ServiceStatus)
            .describe('Status of the high priority queue'),
          lowPriority: z
            .enum(ServiceStatus)
            .describe('Status of the low priority queue'),
        })
        .describe('Status of SQS queues'),
    })
    .describe('Status of individual services'),
}).openapi('HealthResponseDTO');

export type HealthResponseDTO = z.infer<typeof HealthResponseSchema>;

export const SimpleHealthResponseSchema = HealthCommonSchema.openapi(
  'SimpleHealthResponseDTO',
);

export type SimpleHealthResponseDTO = z.infer<
  typeof SimpleHealthResponseSchema
>;
