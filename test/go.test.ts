import * as path from 'path';
import * as fs from 'fs-extra';
import { GoReleaser, GoReleaserProps } from '../src';
import * as git from '../src/help/git';
import * as os from '../src/help/os';
import * as shell from '../src/help/shell';

function initRepo(repoDir: string) {
  const cwd = process.cwd();
  try {
    process.chdir(repoDir);
    git.init();
    git.add('.');
    git.identify('jsii-release-test', '<>');
    git.commit('Initial Commit');
  } finally {
    process.chdir(cwd);
  }
}

function createReleaser(fixture: string, props: Omit<GoReleaserProps, 'dir' | 'dryRun'> = {}) {

  const fixturePath = path.join(__dirname, '__fixtures__', fixture);
  const sourceDir = path.join(os.mkdtempSync(), path.basename(fixture));
  fs.copySync(fixturePath, sourceDir, { recursive: true });

  // create the releaser with a copy of the fixture to allow
  // source customization.
  const releaser = new GoReleaser({
    dir: sourceDir,
    dryRun: true,
    ...props,
  });

  (git as any).clone = function(_: string, targetDir: string) {
    // the cloned repo is always the original fixture.
    fs.copySync(fixturePath, targetDir, { recursive: true });
    initRepo(targetDir);
  };

  return { releaser, sourceDir };
}

test('top-level', () => {

  const { releaser, sourceDir } = createReleaser('top-level');

  fs.writeFileSync(path.join(sourceDir, 'file'), 'test');
  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0']);
  expect(release.commitMessage).toEqual('chore(release): v1.1.0');

});

test('sub-modules', () => {

  const { releaser, sourceDir } = createReleaser('sub-modules');

  fs.writeFileSync(path.join(sourceDir, 'module1', 'file'), 'test');
  const release = releaser.release();

  expect(release.tags).toEqual(['module1/v1.1.0', 'module2/v1.1.0']);
  expect(release.commitMessage).toEqual('chore(release): v1.1.0');

});

test('combined', () => {

  const { releaser, sourceDir } = createReleaser('combined');

  fs.writeFileSync(path.join(sourceDir, 'file'), 'test');
  const release = releaser.release();

  expect(release.tags).toEqual(['module1/v1.1.0', 'module2/v1.1.0', 'v1.1.0']);
  expect(release.commitMessage).toEqual('chore(release): v1.1.0');

});

test('multi-version', () => {

  const { releaser, sourceDir } = createReleaser('multi-version');
  fs.writeFileSync(path.join(sourceDir, 'module1', 'file'), 'test');

  const release = releaser.release();

  expect(release.tags).toEqual(['module1/v1.1.0', 'module2/v1.2.0']);
  expect(release.commitMessage).toEqual('chore(release): module1@v1.1.0 module2@v1.2.0');

});

test('throws when submodules use multiple repos', () => {

  const { releaser } = createReleaser('multi-repo');

  expect(() => releaser.release()).toThrow(/Multiple repositories found in module files/);

});

test('throws when version file doesnt exist and no global version', () => {

  const { releaser, sourceDir } = createReleaser('no-version');
  fs.writeFileSync(path.join(sourceDir, 'file'), 'test');

  expect(() => releaser.release()).toThrow(/Unable to determine version of module/);

});

test('uses global version', () => {

  const { releaser, sourceDir } = createReleaser('no-version', { version: '1.0.0' });
  fs.writeFileSync(path.join(sourceDir, 'file'), 'test');

  const release = releaser.release();
  expect(release.tags).toEqual(['v1.0.0']);

});

test('throws if module repo domain is not github.com', () => {

  const { releaser, sourceDir } = createReleaser('not-github');
  fs.writeFileSync(path.join(sourceDir, 'file'), 'test');

  expect(() => releaser.release()).toThrow(/Repository must be hosted on github.com/);

});

test('considers deleted files', () => {

  const { releaser, sourceDir } = createReleaser('top-level');

  fs.unlinkSync(path.join(sourceDir, 'source.go'));
  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0']);

});

test('considers deleted modules', () => {

  const { releaser, sourceDir } = createReleaser('sub-modules');

  fs.removeSync(path.join(sourceDir, 'module1'));
  const release = releaser.release();

  expect(release.tags).toEqual(['module2/v1.1.0']);

});

test('considers added files', () => {

  const { releaser, sourceDir } = createReleaser('top-level');

  fs.writeFileSync(path.join(sourceDir, 'file'), 'test');
  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0']);

});

test('considers added modules', () => {

  const { releaser, sourceDir } = createReleaser('sub-modules');

  const module3 = path.join(sourceDir, 'module3');
  fs.mkdirSync(module3);
  fs.writeFileSync(path.join(module3, 'go.mod'), 'module github.com/aws/sub-modules/module3');
  fs.writeFileSync(path.join(module3, 'version'), '1.0.0');
  const release = releaser.release();

  expect(release.tags).toEqual(['module1/v1.1.0', 'module2/v1.1.0', 'module3/v1.0.0']);

});

test('skips when no changes', () => {

  const { releaser } = createReleaser('top-level');
  const release = releaser.release();

  expect(release.tags).toBeUndefined();

});

test('does not include major version suffix in tag names', () => {

  const { releaser, sourceDir } = createReleaser('major-version');

  fs.writeFileSync(path.join(sourceDir, 'file'), 'test');
  const release = releaser.release();

  expect(release.tags).toEqual(['module1/v3.3.3', 'v3.3.3']);

});

test('no-ops on a directory with no modules', () => {

  const { releaser } = createReleaser('no-modules');
  const release = releaser.release();

  expect(release.tags).toBeUndefined();

});

test('accepts a custom git identity', () => {

  const username = 'some-user';
  const email = 'some-user@example.com';
  const { releaser, sourceDir } = createReleaser('top-level', { username, email });

  fs.writeFileSync(path.join(sourceDir, 'file'), 'test');
  const release = releaser.release();

  const lastCommit = shell.run('git log -1', { capture: true, cwd: release.repoDir });
  expect(lastCommit).toContain(`Author: ${username} <${email}>`);

});

test('throws when global version conflicts with version file', () => {

  const { releaser } = createReleaser('top-level', { version: '10.0.0' });

  expect(() => releaser.release()).toThrow(/Repo version \(10.0.0\) conflicts with module version \(1.1.0\)/);

});

test('throws when no major version suffix', () => {

  const { releaser } = createReleaser('no-major-version-suffix');

  expect(() => releaser.release()).toThrow(/expected to end with '\/v3'/);

});
