import { spawnSync } from 'node:child_process';
import {
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sanitizer from '../../src/utils/htmlSanitizer.js';
import {
  MAX_INPUT_BYTES,
  runSanitizer,
  validateTemplateJson,
} from '../../test-html-sanitization/testSanitizeHtml.js';

const template = (
  html = '<p>Hello {{user.name}}</p>',
  subject = 'Hello {{user.name}}',
) =>
  JSON.stringify({
    TemplateName: 'demo_welcome_v1',
    TemplateContent: { Subject: subject, Html: html },
  });

describe('template sanitizer runner', () => {
  let root: string;
  let messages: string[];

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'template-sanitizer-')));
    messages = [];
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  const run = (args: string[], source = '') =>
    runSanitizer(
      ['--root', root, ...args],
      Readable.from([source]),
      (message) => messages.push(message),
    );

  it('passes safe SES JSON and preserves nested attribute placeholders without rendering', async () => {
    const html =
      '<a href="https://example.com/{{user.id}}" title="{{user.name}}">{{#if user.active}}{{#each items}}<p>{{this.name}} {{../user.name}}</p>{{else}}<p>None</p>{{/each}}{{/if}}</a>';
    const result = validateTemplateJson(template(html));
    expect(result.sanitizedHtml).toBe(html);
    expect(result.isSanitized).toBe(false);
    await expect(run(['--ci', '--stdin'], template(html))).resolves.toBe(0);
  });

  it.each([false, true])(
    'never writes files in developer/CI mode (CI=%s)',
    async (ci) => {
      const source = template('<p onclick="evil()">PRIVATE_PERSON</p>');
      await writeFile(join(root, 'template.json'), source);
      const before = await readdir(root);
      await expect(
        run([...(ci ? ['--ci'] : []), '--file', 'template.json']),
      ).resolves.toBe(ci ? 1 : 0);
      await expect(readdir(root)).resolves.toEqual(before);
      await expect(readFile(join(root, 'template.json'), 'utf8')).resolves.toBe(
        source,
      );
      expect(messages.join('\n')).not.toContain('PRIVATE_PERSON');
      expect(messages.join('\n')).not.toContain('evil');
      expect(messages.join('\n')).toContain('HTML requires sanitization');
      expect(messages.join('\n')).toContain(
        ci ? '(CI)' : 'optional Text is missing',
      );
    },
  );

  it('accepts serialization-only changes according to production normalization', async () => {
    await expect(
      run(['--ci', '--stdin'], template('<p title="test">Hello</p>\n<br/>')),
    ).resolves.toBe(1);
    messages = [];
    await expect(
      run(['--ci', '--stdin'], template('<p>Hello</p>\n<br/>')),
    ).resolves.toBe(0);
    await expect(
      run(['--stdin'], template('<p>Hello</p>\n<br/>')),
    ).resolves.toBe(0);
    expect(messages.join('\n')).toContain(
      'serialization-only normalization accepted',
    );
  });

  it.each(['--files-json', '--files-stdin'])(
    'accepts an explicit JSON file list using %s',
    async (option) => {
      await writeFile(join(root, 'external.json'), template());
      const list = JSON.stringify(['external.json']);
      await expect(
        run(
          ['--ci', option, ...(option === '--files-json' ? [list] : [])],
          list,
        ),
      ).resolves.toBe(0);
    },
  );

  it('accepts an explicitly empty file list without scanning any other files', async () => {
    await writeFile(join(root, 'unrelated.json'), 'not json');
    await expect(run(['--ci', '--files-json', '[]'])).resolves.toBe(0);
    expect(messages.join('\n')).toContain('Checked 0');
  });

  it.each([
    '{PRIVATE_JSON',
    '{}',
    '{"TemplateName":"name","TemplateContent":{"Subject":123,"Html":"<p>Hi</p>"}}',
  ])(
    'fails malformed/missing SES fields in both modes without exposing content',
    async (source) => {
      await expect(run(['--stdin'], source)).resolves.toBe(1);
      await expect(run(['--ci', '--stdin'], source)).resolves.toBe(1);
      expect(messages.join('\n')).not.toContain('PRIVATE_JSON');
    },
  );

  it.each([
    '{{#if user}}',
    '{{{user.name}}}',
    '{{& user.name}}',
    '{{lookup user "name"}}',
    '{{> partial}}',
    '{{user.constructor}}',
    '{{#custom user}}{{name}}{{/custom}}',
  ])(
    'rejects malformed or unsafe Handlebars without rendering: %s',
    async (syntax) => {
      await expect(
        run(['--stdin'], template(`<p>${syntax}</p>`)),
      ).resolves.toBe(1);
      await expect(
        run(['--ci', '--stdin'], template('<p>Safe</p>', syntax)),
      ).resolves.toBe(1);
    },
  );

  it('parses escaped JSON structurally and preserves literal backslashes', () => {
    const html = '<p>Literal \\&quot; {{user.name}}</p>';
    expect(validateTemplateJson(template(html)).sanitizedHtml).toBe(
      '<p>Literal \\" {{user.name}}</p>',
    );
  });

  it('fails missing files, path escapes, symlink files and symlink ancestors', async () => {
    await writeFile(join(root, 'safe.json'), template());
    await symlink(join(root, 'safe.json'), join(root, 'link.json'));
    await symlink(root, join(root, 'linked'));
    for (const pathname of [
      'missing.json',
      '../escape.json',
      'link.json',
      'linked/safe.json',
    ]) {
      await expect(run(['--ci', '--file', pathname])).resolves.toBe(1);
    }
  });

  it('rejects oversized files, stdin and file lists', async () => {
    const source = 'x'.repeat(MAX_INPUT_BYTES + 1);
    await writeFile(join(root, 'large.json'), source);
    await expect(run(['--file', 'large.json'])).resolves.toBe(1);
    await expect(run(['--stdin'], source)).resolves.toBe(1);
    await expect(
      run([
        '--files-json',
        JSON.stringify(Array.from({ length: 1001 }, () => 'x')),
      ]),
    ).resolves.toBe(1);
  });

  it('fails runtime errors in developer mode without logging exception contents', async () => {
    vi.spyOn(sanitizer, 'sanitizeEmailHtml').mockImplementation(() => {
      throw new Error('PRIVATE_RUNTIME');
    });
    await expect(run(['--stdin'], template())).resolves.toBe(1);
    expect(messages.join('\n')).not.toContain('PRIVATE_RUNTIME');
  });

  it('fails invalid CLI sources instead of silently passing', async () => {
    for (const args of [
      ['--unknown'],
      ['--file'],
      ['--stdin', '--file', 'x'],
      ['--files-json', '{}'],
    ]) {
      await expect(run(args)).resolves.toBe(1);
    }
  });
});

describe('executable template sanitizer', () => {
  it('propagates CI and invalid-input exit codes through the executable CLI', () => {
    const executable = fileURLToPath(
      new URL('../../node_modules/tsx/dist/cli.mjs', import.meta.url),
    );
    const runner = fileURLToPath(
      new URL(
        '../../test-html-sanitization/testSanitizeHtml.ts',
        import.meta.url,
      ),
    );
    const tsconfig = fileURLToPath(
      new URL('../../tsconfig.json', import.meta.url),
    );
    for (const [args, source, expected] of [
      [['--stdin'], template('<p onclick="evil()">Hello</p>'), 0],
      [['--ci', '--stdin'], template('<p onclick="evil()">Hello</p>'), 1],
      [['--ci', '--stdin'], template(), 0],
      [['--stdin'], 'bad json', 1],
    ] as const) {
      const result = spawnSync(
        process.execPath,
        [executable, '--tsconfig', tsconfig, '-C', 'local', runner, ...args],
        { input: source, encoding: 'utf8', cwd: tmpdir() },
      );
      expect(result.stderr).toBe('');
      expect(result.status).toBe(expected);
    }
  });
});
