import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GoReleaser } from '../src';
import * as shell from '../src/shell';

interface ClonerOptions {
  preClone?: (sourceDir: string) => void;
  postClone?: (targetDir: string) => void;
}

function mockCloner(options: ClonerOptions = {}) {
  return (repository: string, targetDir: string) => {
    const fixture = path.join(__dirname, '__fixtures__', repository.split('/')[1]);
    const sourceDir = path.join(fs.mkdtempSync(os.tmpdir()), path.basename(fixture));
    shell.run(`cp -r ${fixture} ${sourceDir}`, { shell: true });
    if (options.preClone) {
      options.preClone(sourceDir);
    }
    shell.run(`cp -r ${sourceDir} ${targetDir}`);
    if (options.postClone) {
      options.postClone(targetDir);
    }
    process.chdir(targetDir);
    shell.run('git init');
    shell.run('git config user.name jsii-release-tests');
    shell.run('git config user.email <>');
    shell.run('git add .');
    shell.run('git commit -m "Initial commit"');
  };
}

beforeEach(() => {
  process.env.DRY_RUN = 'True';
});

test('top-level produces a tag without prefix', () => {

  const releaser = new GoReleaser({
    sourceDir: `${__dirname}/__fixtures__/top-level`,
    cloner: {
      clone: mockCloner({
        postClone: (targetDir: string) => {
          // add a file so we have changes
          fs.writeFileSync(path.join(targetDir, 'file'), 'test');
        },
      }),
    },
  });

  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0']);

});

test('sub-modules produce tags with prefixes', () => {

  const releaser = new GoReleaser({
    sourceDir: `${__dirname}/__fixtures__/sub-modules`,
    cloner: {
      clone: mockCloner({
        postClone: (targetDir: string) => {
          // add a file so we have changes
          fs.writeFileSync(path.join(targetDir, 'module1', 'file'), 'test');
          fs.writeFileSync(path.join(targetDir, 'module2', 'file'), 'test');
        },
      }),
    },
  });

  const release = releaser.release();

  expect(release.tags).toEqual(['module1/v1.1.0', 'module2/v1.1.0']);

});

test('combined procudes tags both with an without a prefix', () => {

  const releaser = new GoReleaser({
    sourceDir: `${__dirname}/__fixtures__/combined`,
    cloner: {
      clone: mockCloner({
        postClone: (targetDir: string) => {
          // add a file so we have changes
          fs.writeFileSync(path.join(targetDir, 'file'), 'test');
          fs.writeFileSync(path.join(targetDir, 'module1', 'file'), 'test');
          fs.writeFileSync(path.join(targetDir, 'module2', 'file'), 'test');
        },
      }),
    },
  });

  const release = releaser.release();

  expect(release.tags).toEqual(['v1.1.0', 'module1/v1.1.0', 'module2/v1.1.0']);

});

test('multi-version produces tags with different versions', () => {

  const releaser = new GoReleaser({
    sourceDir: `${__dirname}/__fixtures__/multi-version`,
    cloner: {
      clone: mockCloner({
        postClone: (targetDir: string) => {
          // add a file so we have changes
          fs.writeFileSync(path.join(targetDir, 'module1', 'file'), 'test');
          fs.writeFileSync(path.join(targetDir, 'module2', 'file'), 'test');
        },
      }),
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