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

const HealthCommonSchema = z.object({
  status: z.enum(HealthStatus).describe('Overall health status of the service'),
  timestamp: z.string().describe('Timestamp of the health check'),
  uptime: z.number().describe('Uptime of the service in seconds'),
});

export const HealthResponseSchema = HealthCommonSchema.extend({
  services: z
    .object({
      db: z.enum(ServiceStatus).describe('Status of the DynamoDB service'),
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
