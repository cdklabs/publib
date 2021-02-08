import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GoReleaser, GoReleaserProps } from '../src';
import * as utils from '../src/utils';

function initRepo(repoDir: string) {
  process.chdir(repoDir);
  utils.shell('git init');
  utils.shell('git config user.name jsii-release-tests');
  utils.shell('git config user.email <>');
  utils.shell('git add .');
  utils.shell('git commit -m "Initial commit"');
}

function createReleaser(fixture: string, props: Omit<GoReleaserProps, 'dir' | 'dryRun'> = {}) {

  const fixturePath = path.join(__dirname, '__fixtures__', fixture);
  const sourceDir = path.join(fs.mkdtempSync(os.tmpdir()), path.basename(fixture));
  utils.shell(`cp -r ${fixturePath} ${sourceDir}`);

  // create the releaser with a copy of the fixture to allow
  // source customization.
  const releaser = new GoReleaser({
    dir: sourceDir,
    dryRun: true,
    ...props,
  });
  (releaser as any)._cloner = function(_: string, targetDir: string) {
    // the cloned repo is always the original fixture.
    utils.shell(`cp -r ${fixturePath} ${targetDir}`);
    initRepo(targetDir);
  };

  return { releaser, sourceDir };
}

test('top-level produces a tag without prefix', () => {

  const { releaser, sourceDir } = createReleaser('top-level');

  fs.writeFileSync(path.join(sourceDir, 'file'), 'test');
  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0']);

});

test('sub-modules produce tags with prefixes', () => {

  const { releaser, sourceDir } = createReleaser('sub-modules');

  fs.writeFileSync(path.join(sourceDir, 'module1', 'file'), 'test');
  const release = releaser.release();

  expect(release.tags).toEqual(['module1/v1.1.0', 'module2/v1.1.0']);

});

test('combined procudes tags both with an without a prefix', () => {

  const { releaser, sourceDir } = createReleaser('combined');

  fs.writeFileSync(path.join(sourceDir, 'file'), 'test');
  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0', 'module1/v1.1.0', 'module2/v1.1.0']);

});

test('multi-version produces tags with different versions', () => {

  const { releaser, sourceDir } = createReleaser('multi-version');
  fs.writeFileSync(path.join(sourceDir, 'module1', 'file'), 'test');

  const release = releaser.release();

  expect(release.tags).toEqual(['module1/v1.1.0', 'module2/v1.2.0']);

});

test('throws when submodules use different repos', () => {});

test('throws when version file doesnt exist and no global version', () => {});

test('uses global version', () => {});

test('throws is domain if module repo domain is not github.com', () => {});

test('considers deleted files', () => {

  const { releaser, sourceDir } = createReleaser('top-level');

  fs.unlinkSync(path.join(sourceDir, 'source.go'));
  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0']);

});

test('considers deleted modules', () => {});

test('considers added files', () => {

  const { releaser, sourceDir } = createReleaser('top-level');

  fs.writeFileSync(path.join(sourceDir, 'file'), 'test');
  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0']);

});

test('considers added modules', () => {});

test('skips when no changes', () => {});