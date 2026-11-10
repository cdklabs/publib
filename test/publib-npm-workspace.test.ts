import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { withTemporaryDirectory } from './with-temporary-directory';

const PUBLIB_NPM = path.join(__dirname, '..', 'bin', 'publib-npm');

test('tarballs are published with workspaces disabled', async () => {
  await withTemporaryDirectory(async (dir) => {
    // a fake npm that records the arguments it was called with
    const binDir = path.join(dir, 'bin');
    fs.mkdirSync(binDir);
    fs.writeFileSync(path.join(binDir, 'npm'), '#!/bin/bash\necho "$@" >> "${HOME}/npm-args.txt"\n', { mode: 0o755 });

    const distDir = path.join(dir, 'dist');
    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, 'package.tgz'), '');

    const result = spawnSync('bash', ['-c', 'export PATH="$(cd "$1" && pwd):$PATH"; exec bash "$2" "$3"', 'bash', binDir, PUBLIB_NPM, 'dist'], {
      cwd: dir,
      env: {
        ...process.env,
        HOME: dir,
        NPM_TOKEN: 'my-token',
        NPM_REGISTRY: '',
        NPM_TRUSTED_PUBLISHER: '',
        PUBLIB_DRYRUN: '',
        VERIFY_PUBLISHED: '',
      },
      encoding: 'utf-8',
    });

    expect(result.status).toEqual(0);
    // inside an npm workspace, npm 8 and 9 publish the current workspace instead of the tarball,
    // unless workspaces are disabled
    const args = fs.readFileSync(path.join(dir, 'npm-args.txt'), 'utf-8').trim().split(' ');
    expect(args[0]).toEqual('publish');
    expect(args).toContain('--workspaces=false');
    expect(args[args.length - 1]).toEqual('dist/package.tgz');
  });
});
