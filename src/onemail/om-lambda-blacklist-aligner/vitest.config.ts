import { createPackageVitestConfig } from '../testing/vitest.shared.config.js';

export default createPackageVitestConfig({
  packageUrl: import.meta.url,
  coverageInclude: ['./src/services/**/*.ts', './src/repositories/**/*.ts'],
});
