import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const TEMPLATE_PATH =
  /^templates\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/v[1-9][0-9]*\/template\.json$/;

export const selectTemplateFiles = (root, baseRef = '') => {
  if (baseRef && !/^[a-f0-9]{40}$/.test(baseRef)) {
    throw new Error('base_ref must be a full lowercase commit SHA');
  }
  const args = baseRef
    ? [
        'diff',
        '--no-renames',
        '--name-only',
        '-z',
        '--diff-filter=ACMT',
        baseRef,
        'HEAD',
        '--',
        'templates/',
      ]
    : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', 'templates/'];
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: 30_000,
  });
  if (result.status !== 0 || result.error) {
    throw new Error(
      'Unable to enumerate template paths from pinned asset commits',
    );
  }
  const files = result.stdout.split('\0').filter(Boolean).sort();
  if (files.length > 1000)
    throw new Error('At most 1000 template files are supported');
  for (const filename of files) {
    if (!TEMPLATE_PATH.test(filename)) {
      throw new Error(
        `Invalid template path ${JSON.stringify(filename)}: expected templates/<product>/<logical-template>/v<positive-integer>/template.json`,
      );
    }
  }
  return files;
};

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    if (process.argv.length < 3 || process.argv.length > 4) {
      throw new Error(
        'Usage: selectTemplateFiles.mjs ASSET_ROOT [BASE_COMMIT_SHA]',
      );
    }
    process.stdout.write(
      `${JSON.stringify(selectTemplateFiles(process.argv[2], process.argv[3]))}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Template selection failed'}\n`,
    );
    process.exitCode = 1;
  }
}
