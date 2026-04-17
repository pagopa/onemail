import { createPackageVitestConfig } from '../vitest.shared.js';

export default createPackageVitestConfig({
  packageUrl: import.meta.url,
  coverageInclude: ['./src/services/**/*.ts', './src/utils/**/*.ts'],
});
