import { afterEach, beforeEach, vi } from 'vitest';

const registerVitestBaseHooks = (): void => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
};

registerVitestBaseHooks();
