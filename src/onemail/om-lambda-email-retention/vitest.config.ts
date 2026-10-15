import { createPackageVitestConfig } from '../testing/vitest.shared.config.js';

export default createPackageVitestConfig({
  packageUrl: import.meta.url,
  setupFiles: ['./tests/__helpers__/envSetup.ts'],
  coverageInclude: [
    './src/config/**/*.ts',
    './src/dtos/**/*.ts',
    './src/services/**/*.ts',
    './src/repositories/**/*.ts',
  ],
  coverageExclude: ['./src/config/logger.ts', './src/utils/constants.ts'],
});
