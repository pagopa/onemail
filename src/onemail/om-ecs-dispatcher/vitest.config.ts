import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromPackage = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

const dispatcherSrcRoot = fromPackage('./src');
const omCommonSrcRoot = fromPackage('../om-common/src');

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^#(.+)$/,
        replacement: `${dispatcherSrcRoot}/$1`,
      },
      {
        find: 'om-common',
        replacement: omCommonSrcRoot,
      },
    ],
    conditions: ['local'],
  },
  test: {
    environment: 'node',
    setupFiles: [fromPackage('./tests/setup/vi.test.base.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        fromPackage('./src/controllers/**/*.ts'),
        fromPackage('./src/services/**/*.ts'),
        fromPackage('./src/utils/**/*.ts'),
      ],
      exclude: [fromPackage('./src/utils/constants.ts')],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
