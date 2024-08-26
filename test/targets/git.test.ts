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
