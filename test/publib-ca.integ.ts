/* eslint-disable import/no-extraneous-dependencies */
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import * as fs from 'fs-extra';
import { inTemporaryDirectory } from './with-temporary-directory';
import { main as publibCa } from '../src/bin/publib-ca';
import { shell } from '../src/codeartifact/shell';

test('this runs with AWS credentials', async () => {
  const sts = new STSClient({});
  const response = await sts.send(new GetCallerIdentityCommand({}));
  expect(response.Arn).toBeTruthy();
});

test('can create an NPM package, publish and consume it from CodeArtifact', async () => {
  await inTemporaryDirectory(async () => {
    await shell('npm init -y');
    const packageName = (await fs.readJson('package.json')).name;
    const tarball = await shell('npm pack');

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
      await shell('npm install', {
        cwd: 'consumer',
      });
    } finally {
      // Clean up
      await publibCa(['delete']);
    }
  });
});