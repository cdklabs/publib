import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GoReleaser } from '../src';
import * as utils from '../src/utils';

interface ClonerOptions {

  /**
   * Allows manipulating the source directory.
   */
  onSource?: (sourceDir: string) => void;

  /**
   * Allows manipulating the "cloned" repo.
   */
  onTarget?: (targetDir: string) => void;
}

function mockCloner(options: ClonerOptions = {}) {
  return (repository: string, targetDir: string) => {

    // our fixtures represent repositories, so we just copy that over to the target directory
    // to simulate a clone. since we want to test our sync logic, we need to allow for customization
    // of both the cloned repo and the generated source. this is enabled by creating a copy of the fixture
    // and using that as the source, along with the 'onSource' and 'onTarget' hooks.
    const fixture = path.join(__dirname, '__fixtures__', repository.split('/')[1]);
    const sourceDir = path.join(fs.mkdtempSync(os.tmpdir()), path.basename(fixture));

    utils.shell(`cp -r ${fixture} ${sourceDir}`);
    if (options.onSource) {
      options.onSource(sourceDir);
    }
    utils.shell(`cp -r ${sourceDir} ${targetDir}`);
    if (options.onTarget) {
      options.onTarget(targetDir);
    }

    process.chdir(targetDir);

    utils.shell('git init');
    utils.shell('git config user.name jsii-release-tests');
    utils.shell('git config user.email <>');
    utils.shell('git add .');
    utils.shell('git commit -m "Initial commit"');
  };
}

// a cloner that adds a file to the cloned repo. since this file is missing
// from the source, it simulates a deleted file.
const deletedFileCloner = (submodule?: string) => {
  return mockCloner({
    onTarget: (targetDir: string) => {
    // add a file so we have changes
      fs.writeFileSync(path.join(targetDir, submodule ?? '', 'file'), 'test');
    },
  });
};

// a cloner that adds a file to the source. since this file is missing
// from the repo, it simulates an added file.
const addedFileCloner = (submodule?: string) => {
  return mockCloner({
    onSource: (sourceDir: string) => {
    // add a file so we have changes
      fs.writeFileSync(path.join(sourceDir, submodule ?? '', 'file'), 'test');
    },
  });
};

beforeEach(() => {
  process.env.DRY_RUN = 'True';
});

test('top-level produces a tag without prefix', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/top-level`);
  (releaser as any)._cloner = addedFileCloner();
  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0']);

});

test('sub-modules produce tags with prefixes', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/sub-modules`);
  (releaser as any)._cloner = addedFileCloner('module1');
  const release = releaser.release();

  expect(release.tags).toEqual(['module1/v1.1.0', 'module2/v1.1.0']);

});

test('combined procudes tags both with an without a prefix', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/combined`);
  (releaser as any)._cloner = addedFileCloner();
  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0', 'module1/v1.1.0', 'module2/v1.1.0']);

});

test('multi-version produces tags with different versions', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/multi-version`);
  (releaser as any)._cloner = addedFileCloner('module2');
  const release = releaser.release();

  expect(release.tags).toEqual(['module1/v1.1.0', 'module2/v1.2.0']);

});

test('throws when submodules use different repos', () => {});

test('throws when version file doesnt exist and no global version', () => {});

test('uses global version', () => {});

test('throws is domain if module repo domain is not github.com', () => {});

test('considers deleted files', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/top-level`);
  (releaser as any)._cloner = deletedFileCloner();
  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0']);

});

test('considers deleted modules', () => {});

test('considers added files', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/top-level`);
  (releaser as any)._cloner = addedFileCloner();
  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0']);

});

test('considers added modules', () => {});

test('skips when no changes', () => {});