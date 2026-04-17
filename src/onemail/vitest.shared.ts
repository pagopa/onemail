import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

type CreatePackageVitestConfigInput = {
  packageUrl: string;
  srcRoot?: string;
  omCommonSrcRoot?: string;
  setupFiles: string[];
  coverageInclude: string[];
  coverageExclude?: string[];
  coverageReportsDirectory?: string;
};

const fromPackage = (packageUrl: string, path: string): string =>
  fileURLToPath(new URL(path, packageUrl));

export const createPackageVitestConfig = ({
  packageUrl,
  srcRoot = './src',
  omCommonSrcRoot = '../om-common/src',
  setupFiles,
  coverageInclude,
  coverageExclude = ['./src/utils/constants.ts'],
  coverageReportsDirectory = './coverage',
}: CreatePackageVitestConfigInput) => {
  const absoluteSrcRoot = fromPackage(packageUrl, srcRoot);
  const absoluteOmCommonSrcRoot = fromPackage(packageUrl, omCommonSrcRoot);

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
      setupFiles: setupFiles.map((path) => fromPackage(packageUrl, path)),
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        ...(coverageReportsDirectory
          ? {
              reportsDirectory: fromPackage(
                packageUrl,
                coverageReportsDirectory,
              ),
            }
          : {}),
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
