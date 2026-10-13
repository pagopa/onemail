import Handlebars from 'handlebars';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

import { sanitizeEmailHtml } from '../src/utils/htmlSanitizer.js';

export const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * MAX_INPUT_BYTES;
const MAX_FILES = 1000;
const DEFAULT_INPUT_DIR = fileURLToPath(new URL('./input', import.meta.url));
const templateSchema = z.object({
  TemplateName: z.string().trim().min(1).max(64),
  TemplateContent: z.object({
    Subject: z.string().min(1).max(998),
    Html: z.string().min(1),
    Text: z.string().optional(),
  }),
});
const fileListSchema = z.array(z.string().min(1)).max(MAX_FILES);

class InputError extends Error {}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InputError('Unsupported Handlebars syntax');
  }
  return value as Record<string, unknown>;
};

const validatePath = (value: unknown): void => {
  const node = record(value);
  if (
    node['type'] !== 'PathExpression' ||
    !Array.isArray(node['parts']) ||
    node['parts'].some((part: unknown) =>
      ['__proto__', 'constructor', 'prototype'].includes(String(part)),
    )
  ) {
    throw new InputError('Unsupported Handlebars path');
  }
};

const validateProgram = (value: unknown): void => {
  const program = record(value);
  if (!Array.isArray(program['body'])) {
    throw new InputError('Unsupported Handlebars syntax');
  }
  for (const value of program['body']) {
    const node = record(value);
    if (
      ['CommentStatement', 'ContentStatement'].includes(String(node['type']))
    ) {
      continue;
    }
    const params = node['params'];
    const pairs = node['hash'] ? record(node['hash'])['pairs'] : [];
    if (!Array.isArray(params) || !Array.isArray(pairs) || pairs.length !== 0) {
      throw new InputError('Unsupported Handlebars helper');
    }
    validatePath(node['path']);
    if (node['type'] === 'MustacheStatement') {
      if (node['escaped'] !== true || params.length !== 0) {
        throw new InputError(
          'Only escaped Handlebars placeholders are supported',
        );
      }
      continue;
    }
    if (
      node['type'] !== 'BlockStatement' ||
      !['each', 'if', 'unless', 'with'].includes(
        String(record(node['path'])['original']),
      ) ||
      params.length !== 1
    ) {
      throw new InputError('Unsupported Handlebars block');
    }
    validatePath(params[0]);
    validateProgram(node['program']);
    if (node['inverse']) validateProgram(node['inverse']);
  }
};

export const validateHandlebars = (source: string): void => {
  let program: unknown;
  try {
    program = Handlebars.parse(source);
  } catch {
    throw new InputError('Invalid Handlebars syntax');
  }
  validateProgram(program);
};

export const validateTemplateJson = (source: string) => {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new InputError('Invalid SES JSON');
  }
  const parsed = templateSchema.safeParse(value);
  if (!parsed.success) {
    throw new InputError(
      'Expected TemplateName and TemplateContent.Subject/Html strings; Text is optional',
    );
  }
  const { Subject, Html, Text } = parsed.data.TemplateContent;
  validateHandlebars(Subject);
  validateHandlebars(Html);
  if (Text !== undefined) validateHandlebars(Text);
  const result = sanitizeEmailHtml(Html);
  validateHandlebars(result.sanitizedHtml);
  return {
    ...result,
    textMissing: Text === undefined,
    serializationChanged: result.sanitizedHtml !== Html,
  };
};

const readBoundedFile = async (
  root: string,
  filename: string,
): Promise<string> => {
  const pathname = resolve(root, filename);
  const localPath = relative(root, pathname);
  if (
    !localPath ||
    localPath === '..' ||
    localPath.startsWith(`..${sep}`) ||
    isAbsolute(localPath)
  ) {
    throw new InputError('Input path must stay inside --root');
  }
  let current = root;
  for (const segment of localPath.split(sep)) {
    current = resolve(current, segment);
    if ((await lstat(current)).isSymbolicLink()) {
      throw new InputError('Symlink inputs and ancestors are not supported');
    }
  }
  const file = await open(
    pathname,
    constants.O_RDONLY + constants.O_NOFOLLOW + constants.O_NONBLOCK,
  );
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size > MAX_INPUT_BYTES) {
      throw new InputError('Input must be a regular file no larger than 1 MiB');
    }
    const buffer = Buffer.alloc(MAX_INPUT_BYTES + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await file.read(
        buffer,
        total,
        buffer.length - total,
        null,
      );
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    if (total > MAX_INPUT_BYTES) throw new InputError('Input exceeds 1 MiB');
    return new TextDecoder('utf-8', { fatal: true }).decode(
      buffer.subarray(0, total),
    );
  } finally {
    await file.close();
  }
};

const readBoundedStdin = async (
  input: AsyncIterable<string | Buffer>,
): Promise<string> => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of input) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_INPUT_BYTES) throw new InputError('Stdin exceeds 1 MiB');
    chunks.push(buffer);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(
    Buffer.concat(chunks),
  );
};

const parseFileList = (source: string): string[] => {
  if (Buffer.byteLength(source) > MAX_INPUT_BYTES)
    throw new InputError('File list exceeds 1 MiB');
  try {
    return fileListSchema.parse(JSON.parse(source));
  } catch {
    throw new InputError('Expected a JSON array of at most 1000 file paths');
  }
};

const parseOptions = (args: string[]) => {
  let ci = false;
  let root = process.cwd();
  let stdin = false;
  let filesStdin = false;
  let explicit = false;
  let help = false;
  const files: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    switch (arg) {
      case '--ci':
        ci = true;
        break;
      case '--file':
      case '--files-json':
      case '--root': {
        const value = args[++index];
        if (!value || value.startsWith('--'))
          throw new InputError('Missing option value');
        switch (arg) {
          case '--file':
            files.push(value);
            explicit = true;
            break;
          case '--files-json':
            files.push(...parseFileList(value));
            explicit = true;
            break;
          case '--root':
            root = value;
            break;
        }
        break;
      }
      case '--files-stdin':
        filesStdin = true;
        explicit = true;
        break;
      case '--help':
        help = true;
        break;
      case '--stdin':
        stdin = true;
        explicit = true;
        break;
      default:
        if (!arg || arg.startsWith('-')) throw new InputError('Unknown option');
        files.push(arg);
        explicit = true;
    }
  }
  return { ci, root, stdin, filesStdin, explicit, help, files };
};

const resolveSources = async (
  options: ReturnType<typeof parseOptions>,
  input: AsyncIterable<string | Buffer>,
) => {
  const { stdin, filesStdin, explicit, files } = options;
  let { root } = options;
  if ((stdin && filesStdin) || ((stdin || filesStdin) && files.length)) {
    throw new InputError(
      'Stdin modes cannot be combined with other input sources',
    );
  }
  if (!explicit) {
    root = DEFAULT_INPUT_DIR;
    const entries = await readdir(root, { withFileTypes: true });
    files.push(
      ...entries
        .filter((entry) => entry.name.endsWith('.txt'))
        .map((entry) => entry.name)
        .sort(),
    );
    if (!files.length)
      throw new InputError(
        'No local HTML inputs found; provide explicit SES JSON input',
      );
  }
  if (filesStdin) files.push(...parseFileList(await readBoundedStdin(input)));
  if (files.length > MAX_FILES)
    throw new InputError('At most 1000 files are supported');
  return {
    canonicalRoot: await realpath(root),
    sources: stdin ? ['stdin'] : [...new Set(files)],
  };
};

const reportResult = (
  filename: string,
  result: ReturnType<typeof validateTemplateJson>,
  ci: boolean,
  log: (message: string) => void,
): void => {
  log(
    `${JSON.stringify(filename)}: ${result.isSanitized ? 'HTML requires sanitization' : 'HTML check passed'}`,
  );
  if (ci) return;
  if (result.serializationChanged && !result.isSanitized) {
    log(
      `${JSON.stringify(filename)}: serialization-only normalization accepted`,
    );
  }
  if (result.textMissing)
    log(`${JSON.stringify(filename)}: optional Text is missing`);
};

export const runSanitizer = async (
  args: string[],
  input: AsyncIterable<string | Buffer> = process.stdin,
  log: (message: string) => void = (message) =>
    process.stdout.write(`${message}\n`),
): Promise<number> => {
  try {
    const options = parseOptions(args);
    if (options.help) {
      log(
        'Usage: testSanitizeHtml.ts [--ci] [--root DIRECTORY] [--file SES.json ... | --files-json JSON_ARRAY | --files-stdin | --stdin]',
      );
      return 0;
    }
    const { ci, stdin, explicit } = options;
    const { canonicalRoot, sources } = await resolveSources(options, input);
    let failed = false;
    let totalBytes = 0;
    for (const filename of sources) {
      try {
        const source = stdin
          ? await readBoundedStdin(input)
          : await readBoundedFile(canonicalRoot, filename);
        totalBytes += Buffer.byteLength(source);
        if (totalBytes > MAX_TOTAL_BYTES)
          throw new InputError('Input batch exceeds 10 MiB');
        const result = explicit
          ? validateTemplateJson(source)
          : (() => {
              validateHandlebars(source);
              const result = sanitizeEmailHtml(source);
              validateHandlebars(result.sanitizedHtml);
              return {
                ...result,
                textMissing: false,
                serializationChanged: result.sanitizedHtml !== source,
              };
            })();
        reportResult(filename, result, ci, log);
        if (result.isSanitized && ci) failed = true;
      } catch (error) {
        failed = true;
        log(
          `${JSON.stringify(filename)}: ${error instanceof InputError ? error.message : 'Unable to read or validate input'}`,
        );
      }
      if (totalBytes > MAX_TOTAL_BYTES) break;
    }
    log(
      `Checked ${sources.length} input(s); ${failed ? 'validation failed' : 'validation passed'}${ci ? ' (CI)' : ' (developer)'}`,
    );
    return failed ? 1 : 0;
  } catch (error) {
    log(
      `Validation failed: ${error instanceof InputError ? error.message : 'Unable to read or validate input'}`,
    );
    return 1;
  }
};

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = await runSanitizer(process.argv.slice(2));
}
