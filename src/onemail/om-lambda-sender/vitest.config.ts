import { createPackageVitestConfig } from '../vitest.shared.js';

export default createPackageVitestConfig({
  packageUrl: import.meta.url,
  srcRoot: './src',
  testsInclude: ['./tests/**/*.test.ts'],
  setupFiles: ['./tests/setup/vi.test.base.ts'],
  coverageReportsDirectory: './coverage',
  coverageInclude: ['./src/services/**/*.ts', './src/utils/**/*.ts'],
});
