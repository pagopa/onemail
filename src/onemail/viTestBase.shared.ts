import { afterEach, beforeEach, vi } from 'vitest';

export const registerVitestBaseHooks = (): void => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
};
