/**
 * Creates GitHub releases via the GitHub REST API, tolerating a release that
 * already exists so that re-running a release is a no-op rather than a
 * failure.
 */

/**
 * Options for creating a GitHub release.
 */
export interface GitHubReleaseOptions {
  /**
   * The tag name of the release (e.g. `v1.2.3`).
   */
  readonly tag: string;

  /**
   * The repository to release to, in `owner/repo` format.
   */
  readonly repository: string;

  /**
   * The token used to authenticate against the GitHub API.
   */
  readonly token: string;

  /**
   * Markdown body of the release (release notes).
   *
   * @default - no release notes
   */
  readonly body?: string;

  /**
   * The commitish the release tag will point to, if the tag does not exist
   * yet. Ignored by GitHub when the tag already exists.
   *
   * @default - the repository's default branch
   */
  readonly target?: string;

  /**
   * Mark the release as a prerelease.
   *
   * @default false
   */
  readonly prerelease?: boolean;

  /**
   * Whether this release should be explicitly marked as the latest release
   * (`true`) or explicitly not marked as the latest release (`false`).
   *
   * Passed to the GitHub API as `make_latest`.
   *
   * @default - not sent; GitHub determines the latest release
   */
  readonly latest?: boolean;

  /**
   * Base URL of the GitHub API.
   *
   * @default 'https://api.github.com'
   */
  readonly apiUrl?: string;
}

/**
 * The outcome of `createGitHubRelease`.
 */
export type GitHubReleaseResult = 'created' | 'already_exists';

/**
 * Creates a GitHub release.
 *
 * Returns `'already_exists'` instead of failing when a release for the tag
 * already exists, so that a re-run of a (partially failed) release workflow is
 * a no-op rather than a failure. The existing release is left untouched. Any
 * other error is thrown.
 */
export async function createGitHubRelease(options: GitHubReleaseOptions): Promise<GitHubReleaseResult> {
  const apiUrl = (options.apiUrl ?? 'https://api.github.com').replace(/\/+$/, '');

  const response = await fetch(`${apiUrl}/repos/${options.repository}/releases`, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${options.token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      tag_name: options.tag,
      name: options.tag,
      body: options.body ?? '',
      prerelease: options.prerelease ?? false,
      ...(options.target ? { target_commitish: options.target } : {}),
      ...(options.latest !== undefined ? { make_latest: String(options.latest) } : {}),
    }),
  });

  if (response.ok) {
    return 'created';
  }

  const body = await response.text();
  if (response.status === 422 && releaseAlreadyExists(body)) {
    return 'already_exists';
  }

  throw new Error(`GitHub release creation failed: HTTP ${response.status} ${response.statusText}: ${body}`);
}

/**
 * Whether a 422 response body indicates that a release for the tag already
 * exists.
 *
 * The API reports this as
 * `{ errors: [{ resource: 'Release', code: 'already_exists', field: 'tag_name' }] }`.
 */
function releaseAlreadyExists(responseBody: string): boolean {
  try {
    const parsed = JSON.parse(responseBody);
    const errors: any[] = Array.isArray(parsed?.errors) ? parsed.errors : [];
    return errors.some((e) => e?.resource === 'Release' && e?.code === 'already_exists');
  } catch {
    return false;
  }
}
