import { livenessCheck, readinessCheck } from '#controllers/health.controller';
import { HealthStatus } from '#dtos/health/health.dto';
import { describe, expect, it, vi } from 'vitest';

const healthCheck = vi.hoisted(() => vi.fn());

vi.mock('#services/health.service', () => ({ healthCheck }));

const createResponseMock = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);

  return response;
};

describe('health.controller', () => {
  it('returns readiness payload from the health service', async () => {
    healthCheck.mockResolvedValue({
      status: HealthStatus.Healthy,
      timestamp: '2026-01-01T00:00:00.000Z',
      services: {
        db: 'Initialized',
        queue: {
          highPriority: 'Initialized',
          lowPriority: 'Initialized',
        },
      },
      uptime: 42,
    });
    const response = createResponseMock();

    await readinessCheck({} as never, response as never);

    expect(healthCheck).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: HealthStatus.Healthy,
      timestamp: '2026-01-01T00:00:00.000Z',
      services: {
        db: 'Initialized',
        queue: {
          highPriority: 'Initialized',
          lowPriority: 'Initialized',
        },
      },
      uptime: 42,
    });
  });

  it('returns liveness payload with healthy status and uptime', async () => {
    vi.spyOn(process, 'uptime').mockReturnValue(9);
    const response = createResponseMock();

    await livenessCheck({} as never, response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: HealthStatus.Healthy,
      timestamp: expect.any(String),
      uptime: 9,
    });
  });
});
