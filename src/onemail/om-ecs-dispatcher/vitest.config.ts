import { createPackageVitestConfig } from '../vitest.shared.js';

export default createPackageVitestConfig({
  packageUrl: import.meta.url,
  setupFiles: ['./tests/setup/vi.test.base.ts'],
  coverageInclude: [
    './src/controllers/**/*.ts',
    './src/middlewares/**/*.ts',
    './src/services/**/*.ts',
    './src/utils/**/*.ts',
  ],
});
