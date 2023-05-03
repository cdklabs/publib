/* eslint-disable import/no-extraneous-dependencies */
import * as path from 'path';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import * as fs from 'fs-extra';
import { inTemporaryDirectory } from './with-temporary-directory';
import { shell } from '../src/codeartifact/shell';

jest.setTimeout(60_0000);

test('this runs with AWS credentials', async () => {
  const sts = new STSClient({});
  const response = await sts.send(new GetCallerIdentityCommand({}));
  expect(response.Arn).toBeTruthy();
});

test('can create an NPM package, publish and consume it from CodeArtifact', async () => {
  await inTemporaryDirectory(async () => {
    await shell('npm init -y', { captureStderr: false });
    await fs.writeFile('index.js', 'console.log("It works!");');
    const packageName = (await fs.readJson('package.json')).name;
    const tarball = await shell('npm pack --loglevel=silent', { captureStderr: false });

    // Tarball needs to be in a 'js/' subdirectory
    await fs.mkdirp('dist/js');
    await fs.rename(tarball, `dist/js/${tarball}`);

    // Now let's run 'publib-ca'
    await publibCa(['create']);
    try {
      // Publish
      await publibCa(['publish', 'dist']);

      // Install
      await fs.mkdir('consumer');
      await fs.writeJson('consumer/package.json', {
        name: 'consumer',
        private: true,
        version: '0.0.1',
        dependencies: {
          [packageName]: '*',
        },
      });

      await publibCa(['login', '--cmd', '"cd consumer && npm install"']);
      const output = await shell(`node -e "require('${packageName}');"`, { cwd: 'consumer', captureStderr: false });
      expect(output).toContain('It works!');
    } finally {
      // Clean up
      await publibCa(['delete']);
    }
  });
});

async function publibCa(args: string[]) {
  const cli = path.resolve(__dirname, '../src/bin/publib-ca.ts');
  return shell(['ts-node', cli, ...args], { captureStderr: false });
}