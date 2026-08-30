/* eslint-disable import/no-extraneous-dependencies */
import * as path from 'path';
import * as fs from 'fs-extra';
import { inTemporaryDirectory } from './with-temporary-directory';
import { shell } from '../src/codeartifact/shell';

jest.setTimeout(60_000);

/**
 * Runs `publib-github` in dry-run mode. Clears the GitHub Actions default
 * environment variables (unless overridden via `env`), so that value
 * inference from the local git repository can be tested.
 */
async function publibGithubDryRun(env: Record<string, string> = {}) {
  const cli = path.resolve(__dirname, '../src/bin/publib-github.ts');
  return shell(['tsx', cli], {
    captureStderr: true,
    allowErrExit: true,
    env: {
      ...process.env,
      PUBLIB_DRYRUN: 'true',
      GITHUB_REPOSITORY: '',
      GITHUB_SHA: '',
      GITHUB_RELEASE_TAG: '',
      GITHUB_RELEASE_TAG_FILE: '',
      ...env,
    },
  });
}

test('dry run infers repository and commit from the local git repository', async () => {
  await inTemporaryDirectory(async () => {
    await shell('git init --initial-branch=main .');
    await shell('git config user.name "publib integ test" && git config user.email "test@example.com"');
    await fs.writeFile('some-file.txt', 'hello');
    await shell('git add . && git commit -m "initial commit"');
    await shell('git remote add origin git@github.com:cdklabs/publib-integ-test.git');
    const head = await shell('git rev-parse HEAD');
    await fs.writeFile('releasetag.txt', 'v0.1.1\n');

    const output = await publibGithubDryRun({
      GITHUB_RELEASE_TAG_FILE: 'releasetag.txt',
    });

    expect(output).toContain(
      `would create GitHub release v0.1.1 in cdklabs/publib-integ-test at ${head}`,
    );
    expect(output).toContain('SUCCESS (dry run)');
  });
});

test('dry run prefers explicit environment variables over inferred values', async () => {
  await inTemporaryDirectory(async () => {
    const output = await publibGithubDryRun({
      GITHUB_REPOSITORY: 'explicit/repository',
      GITHUB_SHA: 'explicit-sha',
      GITHUB_RELEASE_TAG: 'v9.9.9',
      GITHUB_PRERELEASE: 'true',
    });

    expect(output).toContain(
      'would create GitHub release v9.9.9 (prerelease) in explicit/repository at explicit-sha',
    );
    expect(output).toContain('SUCCESS (dry run)');
  });
});

test('dry run fails with actionable error when the repository cannot be determined', async () => {
  await inTemporaryDirectory(async () => {
    const output = await publibGithubDryRun({
      GITHUB_RELEASE_TAG: 'v9.9.9',
    });

    expect(output).toContain('GITHUB_REPOSITORY is required');
  });
});
