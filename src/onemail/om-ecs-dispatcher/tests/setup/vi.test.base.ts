import { configDotenv } from 'dotenv';
import { fileURLToPath, URL } from 'node:url';
import { afterEach, beforeEach, vi } from 'vitest';
import '#config/zodExtend';

configDotenv({
  path: fileURLToPath(new URL('../../.env.test', import.meta.url)),
  quiet: true,
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
