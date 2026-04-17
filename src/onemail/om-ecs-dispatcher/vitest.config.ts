import { createPackageVitestConfig } from '../vitest.shared.js';

export default createPackageVitestConfig({
  packageUrl: import.meta.url,
  coverageInclude: [
    './src/controllers/**/*.ts',
    './src/middlewares/**/*.ts',
    './src/services/**/*.ts',
    './src/utils/**/*.ts',
  ],
});
