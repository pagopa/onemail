import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromPackage = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

const senderSrcRoot = fromPackage('./src');
const omCommonSrcRoot = fromPackage('../om-common/src');
const senderTestsGlob = fromPackage('./tests/**/*.test.ts');

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^#(.+)$/,
        replacement: `${senderSrcRoot}/$1`,
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
    include: [senderTestsGlob],
    setupFiles: [fromPackage('./tests/setup/vi.test.base.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: fromPackage('./coverage'),
      include: [
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
