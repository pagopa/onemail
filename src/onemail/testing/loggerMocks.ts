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

vi.mock('#config/logger', () => ({
  getLogger: vi.fn(() => createMockLogger()),
  getNamedLogger: vi.fn(() => createMockLogger()),
}));
