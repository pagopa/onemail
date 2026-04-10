import { vi } from 'vitest';

export const createMockAwsClient = () => ({
  send: vi.fn().mockResolvedValue(undefined),
});
