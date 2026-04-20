import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

type CreatePackageVitestConfigInput = {
  packageUrl: string;
  setupFiles?: string[];
  coverageInclude: string[];
  coverageExclude?: string[];
};

const fromPackage = (packageUrl: string, path: string): string =>
  fileURLToPath(new URL(path, packageUrl));

const SETUP_HOOKS_PATH = fileURLToPath(
  new URL('./setupHooks.ts', import.meta.url),
);

export const createPackageVitestConfig = ({
  packageUrl,
  setupFiles = [],
  coverageInclude,
  coverageExclude = ['./src/utils/constants.ts'],
}: CreatePackageVitestConfigInput) => {
  const absoluteSrcRoot = fromPackage(packageUrl, './src');
  const absoluteOmCommonSrcRoot = fromPackage(packageUrl, '../om-common/src');

  return defineConfig({
    resolve: {
      alias: [
        {
          find: /^#(.+)$/,
          replacement: `${absoluteSrcRoot}/$1`,
        },
        {
          find: 'om-common',
          replacement: absoluteOmCommonSrcRoot,
        },
      ],
      conditions: ['local'],
    },
    test: {
      environment: 'node',
      silent: process.env['CI'] === 'true',
      setupFiles: [SETUP_HOOKS_PATH].concat(
        setupFiles.map((path) => fromPackage(packageUrl, path)),
      ),
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: coverageInclude.map((path) => fromPackage(packageUrl, path)),
        exclude: coverageExclude.map((path) => fromPackage(packageUrl, path)),
        thresholds: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  });
};
