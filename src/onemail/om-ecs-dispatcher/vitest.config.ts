import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromPackage = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

const dispatcherSrcRoot = fromPackage('./src');
const dispatcherTestsGlob = fromPackage('./tests/**/*.test.ts');

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^#(.+)$/,
        replacement: `${dispatcherSrcRoot}/$1`,
      },
    ],
    conditions: ['local'],
  },
  test: {
    environment: 'node',
    include: [dispatcherTestsGlob],
    setupFiles: [
      fromPackage('./tests/setup/vi.test.base.ts'),
      fromPackage('./src/config/zodExtend.ts'),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: fromPackage('./coverage'),
      include: [
        fromPackage('./src/controllers/**/*.ts'),
        fromPackage('./src/services/**/*.ts'),
        fromPackage('./src/utils/**/*.ts'),
      ],
      exclude: [dispatcherTestsGlob],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
