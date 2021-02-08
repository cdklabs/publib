import * as path from 'path';
import { GoReleaser } from '../src';
import * as fs from 'fs';
import * as shell from '../src/shell';

function mockCloner(postClone?: (targetDir: string) => void) {
  return (repository: string, targetDir: string) => {
    const fixture = path.join(__dirname, '__fixtures__', repository.split('/')[1]);
    shell.run('cp', ['-r', fixture, targetDir]);
    if (postClone) {
      postClone(targetDir);
    } else {
      console.log('asdadadsadsads');
      fs.writeFileSync(path.join(targetDir, 'file.txt'), 'just some content so we have changes')
    }
    shell.run('git', ['init'], { cwd: targetDir });
    shell.run('git', ['config', 'user.name', 'jsii-release-tests'], { cwd: targetDir });
    shell.run('git', ['config', 'user.email', '<>'], { cwd: targetDir });
    shell.run('git', ['add', '.'], { cwd: targetDir });
    shell.run('git', ['commit', '-m', 'Initial commit'], { cwd: targetDir });
    console.log(`Repository initialized at: ${targetDir}`);
  }
}

test('top-level', () => {

  process.env.GITHUB_TOKEN = 'token';

  const releaser = new GoReleaser({
    sourceDir: `${__dirname}/__fixtures__/top-level`,
    cloner: { clone: mockCloner() },
  });

  const release = releaser.release();

  expect(release.branch).toEqual('main');
  expect(release.tags).toEqual(['v1.20.1']);

});

// test('sub-modules', () => {

//   const releaser = new GoReleaser(`${__dirname}/__fixtures__/sub-modules`);

//   const release = releaser.release();

//   expect(release.branch).toEqual('main');
//   expect(release.tags).toEqual(['module1/v1.20.1', 'module2/v1.20.1']);

// });

// test('combined', () => {

//   const releaser = new GoReleaser(`${__dirname}/__fixtures__/combined`);

//   const release = releaser.release();

//   expect(release.branch).toEqual('main');
//   expect(release.tags).toEqual(['v1.20.1', 'module1/v1.20.1', 'module2/v1.20.1']);

// });

// test('multi-version', () => {

//   const releaser = new GoReleaser(`${__dirname}/__fixtures__/multi-version`);

//   const release = releaser.release();

//   expect(release.branch).toEqual('main');
//   expect(release.tags).toEqual(['module1/v1.20.1', 'module2/v1.20.2']);

// });