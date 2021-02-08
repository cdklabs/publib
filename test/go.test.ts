import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GoReleaser } from '../src';
import * as utils from '../src/utils';

interface ClonerOptions {
  preClone?: (sourceDir: string) => void;
  postClone?: (targetDir: string) => void;
}

function mockCloner(options: ClonerOptions = {}) {
  return (repository: string, targetDir: string) => {
    const fixture = path.join(__dirname, '__fixtures__', repository.split('/')[1]);
    const sourceDir = path.join(fs.mkdtempSync(os.tmpdir()), path.basename(fixture));
    utils.shell(`cp -r ${fixture} ${sourceDir}`, { shell: true });
    if (options.preClone) {
      options.preClone(sourceDir);
    }
    utils.shell(`cp -r ${sourceDir} ${targetDir}`);
    if (options.postClone) {
      options.postClone(targetDir);
    }
    process.chdir(targetDir);
    utils.shell('git init');
    utils.shell('git config user.name jsii-release-tests');
    utils.shell('git config user.email <>');
    utils.shell('git add .');
    utils.shell('git commit -m "Initial commit"');
  };
}

beforeEach(() => {
  process.env.DRY_RUN = 'True';
});

test('top-level produces a tag without prefix', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/top-level`);

  (releaser as any)._cloner = mockCloner({
    postClone: (targetDir: string) => {
    // add a file so we have changes
      fs.writeFileSync(path.join(targetDir, 'file'), 'test');
    },
  });

  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0']);

});

test('sub-modules produce tags with prefixes', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/sub-modules`);

  (releaser as any)._cloner = mockCloner({
    postClone: (targetDir: string) => {
      // add a file so we have changes
      fs.writeFileSync(path.join(targetDir, 'module1', 'file'), 'test');
      fs.writeFileSync(path.join(targetDir, 'module2', 'file'), 'test');
    },
  });
  const release = releaser.release();

  expect(release.tags).toEqual(['module1/v1.1.0', 'module2/v1.1.0']);

});

test('combined procudes tags both with an without a prefix', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/combined`);

  (releaser as any)._cloner = mockCloner({
    postClone: (targetDir: string) => {
      // add a file so we have changes
      fs.writeFileSync(path.join(targetDir, 'file'), 'test');
      fs.writeFileSync(path.join(targetDir, 'module1', 'file'), 'test');
      fs.writeFileSync(path.join(targetDir, 'module2', 'file'), 'test');
    },
  });
  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0', 'module1/v1.1.0', 'module2/v1.1.0']);

});

test('multi-version produces tags with different versions', () => {

  const releaser = new GoReleaser(`${__dirname}/__fixtures__/multi-version`);

  (releaser as any)._cloner = mockCloner({
    postClone: (targetDir: string) => {
      // add a file so we have changes
      fs.writeFileSync(path.join(targetDir, 'module1', 'file'), 'test');
      fs.writeFileSync(path.join(targetDir, 'module2', 'file'), 'test');
    },
  });
  const release = releaser.release();

  expect(release.tags).toEqual(['module1/v1.1.0', 'module2/v1.2.0']);

});

test('throws when submodules use different repos', () => {});

test('throws when version file doesnt exist and no global version', () => {});

test('uses global version', () => {});

test('throws is domain if module repo domain is not github.com', () => {});

test('considers deleted files', () => {});

test('considers deleted modules', () => {});

test('considers added files', () => {});

test('considers added modules', () => {});

test('skips when no changes', () => {});