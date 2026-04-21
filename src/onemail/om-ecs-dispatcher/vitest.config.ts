import { createPackageVitestConfig } from '../testing/vitest.shared.config.js';

export default createPackageVitestConfig({
  packageUrl: import.meta.url,
  setupFiles: ['./tests/__helpers__/envSetup.ts'],
  coverageInclude: [
    './src/controllers/**/*.ts',
    './src/middlewares/**/*.ts',
    './src/services/**/*.ts',
    './src/utils/**/*.ts',
  ],
});
