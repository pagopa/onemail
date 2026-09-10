import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  hasMeaningfulHtmlSanitizationChange,
  normalizeHtml,
  sanitizeEmailHtml,
} from '../src/utils/htmlSanitizer.js';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_INPUT_DIR = resolve(SCRIPT_DIR, 'input');
const DEFAULT_OUTPUT_DIR = resolve(SCRIPT_DIR, 'outputs');
const REPO_ROOT = resolve(SCRIPT_DIR, '../../../..');
const PRETTIER_IGNORE_PATH = resolve(REPO_ROOT, '.prettierignore');

const decodeEscapedQuotes = (html: string): string => html.replace(/\\"/g, '"');

const listInputFiles = async (): Promise<string[]> => {
  const entries = await readdir(DEFAULT_INPUT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extname(entry.name) === '.txt')
    .map((entry) => resolve(DEFAULT_INPUT_DIR, entry.name))
    .sort();
};

const loadOriginalHtml = async (inputFilePath: string): Promise<string> => {
  const htmlFromFile = await readFile(inputFilePath, 'utf8');

  return decodeEscapedQuotes(htmlFromFile);
};

const formatGeneratedHtml = (paths: string[]): void => {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'prettier',
      '--ignore-path',
      PRETTIER_IGNORE_PATH,
      '--write',
      ...paths,
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() ||
        'Prettier failed while formatting generated HTML files',
    );
  }
};

const checkSingleFile = async (inputFilePath: string): Promise<void> => {
  const inputName = basename(inputFilePath, extname(inputFilePath));
  const originalHtml = await loadOriginalHtml(inputFilePath);

  const sanitizedHtml = sanitizeEmailHtml(originalHtml);
  const isSanitized = hasMeaningfulHtmlSanitizationChange(
    originalHtml,
    sanitizedHtml,
  );

  if (!isSanitized) {
    console.log(`[${inputName}] HTML check passed: not sanitized`);
    return;
  }

  const normalizedOriginalHtml = normalizeHtml(originalHtml);
  const normalizedSanitizedHtml = normalizeHtml(sanitizedHtml);
  const outputDir = resolve(DEFAULT_OUTPUT_DIR, inputName);
  const originalPath = resolve(outputDir, 'original.html');
  const sanitizedPath = resolve(outputDir, 'sanitized.html');

  await mkdir(outputDir, { recursive: true });
  await writeFile(originalPath, normalizedOriginalHtml, 'utf8');
  await writeFile(sanitizedPath, normalizedSanitizedHtml, 'utf8');
  formatGeneratedHtml([originalPath, sanitizedPath]);

  console.log(`[${inputName}] HTML check failed: sanitized`);
};

const main = async (): Promise<void> => {
  try {
    const inputFiles = await listInputFiles();

    if (inputFiles.length === 0) {
      console.log(`No files to check found in: ${DEFAULT_INPUT_DIR}`);
      return;
    }

    for (const inputFilePath of inputFiles) {
      await checkSingleFile(inputFilePath);
    }
  } catch (error) {
    console.error(`HTML sanitizer check failed: ${error}`);
    process.exit(1);
  }
};

void main();
