import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as git from '../../src/help/git';
import * as shell from '../../src/help/shell';

let shellRunSpy: jest.SpyInstance<string, Parameters<typeof shell.run>>;
beforeEach(() => {
  shellRunSpy = jest.spyOn(shell, 'run');
});
afterEach(() => {
  jest.clearAllMocks();
});


test('checkout with createIfMissing', () => {
  withTmpDir(() => {
    git.init();
    git.checkout('main', { createIfMissing: true });
  });
  expect(shellRunSpy.mock.calls).toHaveLength(3); // init, show-branch, checkout -B
  expect(shellRunSpy.mock.calls[2]).toEqual(['git checkout -B main']);
});

function withTmpDir(fn: (tmpDir: string) => void) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const cwd = process.cwd();
  try {
    process.chdir(tmpDir);
    fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.chdir(cwd);
  }
}

test.each([
  ['https://github.com/cdklabs/publib.git', 'cdklabs/publib'],
  ['https://github.com/cdklabs/publib', 'cdklabs/publib'],
  ['git@github.com:cdklabs/publib.git', 'cdklabs/publib'],
  ['ssh://git@github.com/cdklabs/publib.git', 'cdklabs/publib'],
  ['https://github.corporate-enterprise.com/cdklabs/publib.git', 'cdklabs/publib'],
  ['not-a-url', undefined],
  ['', undefined],
])('parseRepositorySlug(%s) returns %s', (url, expected) => {
  expect(git.parseRepositorySlug(url)).toBe(expected);
});

test('repositorySlug reads the origin remote', () => {
  shellRunSpy.mockReturnValue('git@github.com:cdklabs/publib.git');
  expect(git.repositorySlug()).toBe('cdklabs/publib');
  expect(shellRunSpy).toHaveBeenCalledWith('git remote get-url origin', { capture: true });
});

test('repositorySlug returns undefined outside a git repository', () => {
  shellRunSpy.mockImplementation(() => {
    throw new Error('fatal: not a git repository');
  });
  expect(git.repositorySlug()).toBeUndefined();
});

test('head returns the current commit hash', () => {
  shellRunSpy.mockReturnValue('abc123');
  expect(git.head()).toBe('abc123');
  expect(shellRunSpy).toHaveBeenCalledWith('git rev-parse HEAD', { capture: true });
});

test('head returns undefined outside a git repository', () => {
  shellRunSpy.mockImplementation(() => {
    throw new Error('fatal: not a git repository');
  });
  expect(git.head()).toBeUndefined();
});
