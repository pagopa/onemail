import { vi } from 'vitest';

const createMockLogger = () => {
  const logger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    appendKeys: vi.fn(),
    addContext: vi.fn(),
    createChild: vi.fn(),
  };

  logger.createChild.mockReturnValue(logger);

  return logger;
};

export const setupMockLoggers = () => {
  const logger = createMockLogger();
  const namedLogger = createMockLogger();

  vi.doMock('#config/logger', () => ({
    getLogger: vi.fn(() => logger),
    getNamedLogger: vi.fn(() => namedLogger),
  }));

  return {
    logger,
    namedLogger,
  };
};
