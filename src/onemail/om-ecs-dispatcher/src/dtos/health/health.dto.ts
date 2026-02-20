export enum HealthStatus {
  Healthy = 'Healthy',
  Unhealthy = 'Unhealthy',
}

export enum ServiceStatus {
  Initialized = 'Initialized',
  NotInitialized = 'NotInitialized',
  Unavailable = 'Unavailable',
}

export type HealthResponse = {
  status: HealthStatus;
  timestamp: string;
  services: {
    dynamo: ServiceStatus;
  };
  uptime: number;
};
