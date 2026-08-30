#!/usr/bin/env node
/**
 * Creates a GitHub release, tolerating a release that already exists so that
 * re-running a release is a no-op rather than a failure.
 *
 * Usage: publib-github
 *
 * GITHUB_TOKEN (required): token used to authenticate against the GitHub API
 * GITHUB_RELEASE_TAG (optional): the tag to release; either this or GITHUB_RELEASE_TAG_FILE is required
 * GITHUB_RELEASE_TAG_FILE (optional): a file containing the tag to release
 * GITHUB_CHANGELOG_FILE (optional): a markdown file used as the release notes
 * GITHUB_REPOSITORY (optional): the repository to release to, in `owner/repo` format (defaults to the repository of the "origin" remote in the current directory)
 * GITHUB_SHA (optional): the commit to tag if the tag doesn't exist yet (defaults to the current git HEAD, or the repository's default branch when not in a git repository)
 * GITHUB_PRERELEASE (optional): set to "true" to mark the release as a prerelease
 * GITHUB_MARK_LATEST (optional): "true" to explicitly mark the release as the latest release, "false" to explicitly not mark it as latest (defaults to GitHub determining the latest release)
 * GITHUB_API_URL (optional): base URL of the GitHub API (defaults to "https://api.github.com"; set automatically in GitHub Actions)
 * PUBLIB_DRYRUN (optional): set to "true" to print what would be done without creating a release
 */
import { readFileSync } from 'fs';
import * as git from '../help/git';
import { createGitHubRelease } from '../targets/github';

async function main() {
  const repository = optionalEnv('GITHUB_REPOSITORY') ?? git.repositorySlug();
  if (!repository) {
    throw new Error('GITHUB_REPOSITORY is required, could not infer the repository from the "origin" remote');
  }
  const tag = releaseTag();
  const changelogFile = optionalEnv('GITHUB_CHANGELOG_FILE');
  const body = changelogFile ? readFileSync(changelogFile, 'utf-8') : undefined;
  const target = optionalEnv('GITHUB_SHA') ?? git.head();
  const prerelease = (optionalEnv('GITHUB_PRERELEASE') ?? 'false').toLowerCase() === 'true';
  const latest = parseMarkLatest(optionalEnv('GITHUB_MARK_LATEST'));
  const dryRun = (process.env.PUBLIB_DRYRUN ?? process.env.DRYRUN ?? 'false').toLowerCase() === 'true';

  if (dryRun) {
    console.log(
      `🏜️ Dry run: would create GitHub release ${tag}${prerelease ? ' (prerelease)' : ''} in ${repository}${target ? ` at ${target}` : ''}`,
    );
    console.log('SUCCESS (dry run)');
    return;
  }

  const result = await createGitHubRelease({
    tag,
    repository,
    body,
    target,
    prerelease,
    latest,
    token: requireEnv('GITHUB_TOKEN'),
    apiUrl: optionalEnv('GITHUB_API_URL'),
  });

  if (result === 'already_exists') {
    console.log(`SKIPPING: release ${tag} already exists`);
  } else {
    console.log(`SUCCESS: created release ${tag}`);
  }
}

function releaseTag(): string {
  const explicitTag = optionalEnv('GITHUB_RELEASE_TAG');
  if (explicitTag) {
    return explicitTag;
  }
  const tagFile = optionalEnv('GITHUB_RELEASE_TAG_FILE');
  if (!tagFile) {
    throw new Error('GITHUB_RELEASE_TAG or GITHUB_RELEASE_TAG_FILE is required');
  }
  const tag = readFileSync(tagFile, 'utf-8').trim();
  if (!tag) {
    throw new Error(`release tag file ${tagFile} is empty`);
  }
  return tag;
}

function parseMarkLatest(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  throw new Error(`GITHUB_MARK_LATEST must be "true" or "false", got: "${value}"`);
}

/**
 * Returns the value of the environment variable, treating an empty string as
 * not set.
 */
function optionalEnv(name: string): string | undefined {
  return process.env[name] ? process.env[name] : undefined;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

main().catch((error: Error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
