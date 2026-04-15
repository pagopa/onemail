import { vi } from 'vitest';

import { createMockLogger } from './loggerMocks.js';

export type PriorityServiceOverrides = {
  getEmailById?: ReturnType<typeof vi.fn>;
  getEmailsByRequestId?: ReturnType<typeof vi.fn>;
  updateEmailStatus?: ReturnType<typeof vi.fn>;
  batchUpdateEmailStatuses?: ReturnType<typeof vi.fn>;
  sendHighPriorityEmail?: ReturnType<typeof vi.fn>;
  sendLowPriorityEmail?: ReturnType<typeof vi.fn>;
  publishMetrics?: ReturnType<typeof vi.fn>;
};

export const loadPriorityService = async (
  overrides?: PriorityServiceOverrides,
) => {
  const rootLogger = createMockLogger();
  const namedLogger = createMockLogger();
  const publishMetrics = overrides?.publishMetrics ?? vi.fn();

  vi.doMock('#config/logger', () => ({
    getLogger: vi.fn(() => rootLogger),
    getNamedLogger: vi.fn(() => namedLogger),
  }));
  vi.doMock('#repositories/email.repository', () => ({
    getEmailById: overrides?.getEmailById ?? vi.fn(),
    getEmailsByRequestId: overrides?.getEmailsByRequestId ?? vi.fn(),
    updateEmailStatus: overrides?.updateEmailStatus ?? vi.fn(),
    batchUpdateEmailStatuses: overrides?.batchUpdateEmailStatuses ?? vi.fn(),
  }));
  vi.doMock('#services/email.service', () => ({
    sendHighPriorityEmail: overrides?.sendHighPriorityEmail ?? vi.fn(),
    sendLowPriorityEmail: overrides?.sendLowPriorityEmail ?? vi.fn(),
  }));
  vi.doMock('om-common/repositories', () => ({
    publishMetrics,
    SenderMetricName: {
      InvalidRecord: 'InvalidRecord',
      EmailNotFound: 'EmailNotFound',
      EmailBatchNotFound: 'EmailBatchNotFound',
      HighPriorityDryRunError: 'HighPriorityDryRunError',
      HighPriorityRejectedBySES: 'HighPriorityRejectedBySES',
      HighPriorityDispatched: 'HighPriorityDispatched',
      LowPriorityDryRunError: 'LowPriorityDryRunError',
      LowPriorityRejectedBySES: 'LowPriorityRejectedBySES',
      LowPriorityDispatched: 'LowPriorityDispatched',
      LowPriorityRetryableFailure: 'LowPriorityRetryableFailure',
    },
  }));

  const module = await import('#services/priority.service');

  return {
    ...module,
    rootLogger,
    namedLogger,
    publishMetrics,
  };
};
