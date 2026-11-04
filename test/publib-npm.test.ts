import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { withTemporaryDirectory } from './with-temporary-directory';

const PUBLIB_NPM = path.join(__dirname, '..', 'bin', 'publib-npm');

test.each([
  ['registry.npmjs.org', 'registry.npmjs.org/'],
  ['npm.pkg.github.com/', 'npm.pkg.github.com/'],
  ['my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo', 'my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo/'],
  ['my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo/', 'my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo/'],
])('registry %s is configured with a trailing slash', async (registry, expected) => {
  await withTemporaryDirectory(async (dir) => {
    // a fake npm that records the registry it would publish to, and a fake aws for CodeArtifact tokens
    const binDir = path.join(dir, 'bin');
    fs.mkdirSync(binDir);
    fs.writeFileSync(path.join(binDir, 'npm'), '#!/bin/bash\necho -n "${NPM_CONFIG_REGISTRY}" > "${HOME}/registry.txt"\n', { mode: 0o755 });
    fs.writeFileSync(path.join(binDir, 'aws'), '#!/bin/bash\necho my-token\n', { mode: 0o755 });

    const distDir = path.join(dir, 'dist');
    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, 'package.tgz'), '');

    const result = spawnSync('bash', ['-c', 'export PATH="$(cd "$1" && pwd):$PATH"; exec bash "$2" "$3"', 'bash', binDir, PUBLIB_NPM, distDir], {
      env: {
        ...process.env,
        HOME: dir,
        NPM_TOKEN: 'my-token',
        NPM_REGISTRY: registry,
        NPM_TRUSTED_PUBLISHER: '',
        PUBLIB_DRYRUN: '',
        VERIFY_PUBLISHED: '',
      },
      encoding: 'utf-8',
    });

    expect(result.status).toEqual(0);
    expect(fs.readFileSync(path.join(dir, '.npmrc'), 'utf-8')).toEqual(`//${expected}:_authToken=my-token\n`);
    expect(fs.readFileSync(path.join(dir, 'registry.txt'), 'utf-8')).toEqual(`https://${expected}`);
  });
});
