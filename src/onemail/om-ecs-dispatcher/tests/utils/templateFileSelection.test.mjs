import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ spawnSync: vi.fn() }));
vi.mock('node:child_process', () => ({ spawnSync: mocks.spawnSync }));

import { selectTemplateFiles } from '../../test-html-sanitization/selectTemplateFiles.mjs';

describe('template file selection', () => {
  it('enumerates only tracked candidate template paths as NUL-delimited data', () => {
    mocks.spawnSync.mockReturnValue({
      status: 0,
      stdout:
        'templates/demo/welcome/v2/template.json\0templates/demo/welcome/v1/template.json\0',
    });
    expect(selectTemplateFiles('/assets')).toEqual([
      'templates/demo/welcome/v1/template.json',
      'templates/demo/welcome/v2/template.json',
    ]);
    expect(mocks.spawnSync).toHaveBeenCalledWith(
      'git',
      [
        '-C',
        '/assets',
        'ls-tree',
        '-r',
        '--name-only',
        '-z',
        'HEAD',
        '--',
        'templates/',
      ],
      expect.objectContaining({ maxBuffer: 1024 * 1024, timeout: 30_000 }),
    );
  });

  it('uses an exact base commit and excludes deletions without executing candidate code', () => {
    const base = 'a'.repeat(40);
    mocks.spawnSync.mockReturnValue({ status: 0, stdout: '' });
    expect(selectTemplateFiles('/assets', base)).toEqual([]);
    expect(mocks.spawnSync).toHaveBeenCalledWith(
      'git',
      [
        '-C',
        '/assets',
        'diff',
        '--no-renames',
        '--name-only',
        '-z',
        '--diff-filter=ACMT',
        base,
        'HEAD',
        '--',
        'templates/',
      ],
      expect.any(Object),
    );
  });

  it.each(['main', '--output=escape', 'a'.repeat(39)])(
    'rejects a non-SHA base ref: %s',
    (base) => {
      expect(() => selectTemplateFiles('/assets', base)).toThrow(
        'base_ref must be a full lowercase commit SHA',
      );
      expect(mocks.spawnSync).not.toHaveBeenCalled();
    },
  );

  it.each([
    'templates/demo/welcome/v01/template.json',
    'templates/demo/welcome/v1/other.json',
    'templates/demo/../v1/template.json',
    'templates/demo/welcome/v1/template.json\nother',
  ])('rejects unexpected paths before reading contents: %s', (filename) => {
    mocks.spawnSync.mockReturnValue({ status: 0, stdout: `${filename}\0` });
    expect(() => selectTemplateFiles('/assets')).toThrow(
      'expected templates/<product>/<logical-template>/v<positive-integer>/template.json',
    );
  });

  it('fails unknown base commits and bounded Git errors without exposing stderr', () => {
    mocks.spawnSync.mockReturnValue({
      status: 1,
      stderr: 'PRIVATE_ERROR',
      stdout: '',
    });
    expect(() => selectTemplateFiles('/assets', 'a'.repeat(40))).toThrow(
      'Unable to enumerate template paths from pinned asset commits',
    );
  });

  it('rejects excessive file counts', () => {
    mocks.spawnSync.mockReturnValue({
      status: 0,
      stdout: 'templates/demo/welcome/v1/template.json\0'.repeat(1001),
    });
    expect(() => selectTemplateFiles('/assets')).toThrow('At most 1000');
  });
});
