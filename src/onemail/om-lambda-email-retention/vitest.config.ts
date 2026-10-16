import { createPackageVitestConfig } from '../testing/vitest.shared.config.js';

export default createPackageVitestConfig({
  packageUrl: import.meta.url,
  setupFiles: ['./tests/__helpers__/envSetup.ts'],
  coverageInclude: ['./src/services/**/*.ts', './src/repositories/**/*.ts'],
});
