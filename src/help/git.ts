import * as shell from './shell';

export interface CloneOptions {
  /**
   * @default 1
   */
  readonly depth?: number;

  /**
   * @default false
   */
  readonly tags?: boolean;

  /**
   * @default - default branch
   */
  readonly branch?: string;
}

/**
 * Clones a repository from GitHub. Requires a `GITHUB_TOKEN` env variable.
 *
 * @param repositoryUrl the repository to clone.
 * @param targetDir the clone directory.
 */
export function clone(repositoryUrl: string, targetDir: string, { depth = 1, tags = false, branch }: CloneOptions = {}) {
  const cmd = ['git', 'clone'];

  if (depth) {
    cmd.push(`--depth ${depth}`);
  }

  if (branch) {
    cmd.push(`--branch ${branch}`);
  }

  if (tags) {
    cmd.push('--tags');
  }

  cmd.push(tryDetectRepositoryUrl(repositoryUrl));
  cmd.push(targetDir);

  shell.run(cmd.join(' '));
}

function tryDetectRepositoryUrl(repositoryUrl: string): string {
  const gitHubUseSsh = detectSSH();
  if (gitHubUseSsh) {
    const sshRepositoryUrl = repositoryUrl.replace('/', ':');
    return `git@${sshRepositoryUrl}.git`;
  }

  const gitHubToken = getToken(detectGHE());
  if (!gitHubToken) {
    throw new Error('GITHUB_TOKEN env variable is required when GITHUB_USE_SSH env variable is not used');
  }
  return `https://${gitHubToken}@${repositoryUrl}.git`;
}

/**
 * Checks if the current environment is an GHE environment.
 *
 * This check is using GITHUB_API_URL set in GitHub Actions workflow, as well as common gh cli env variables.
 * https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
 * https://cli.github.com/manual/gh_help_environment
 *
 * @return - `true` if GH_HOST or GITHUB_API_URL env var are defined and not equal to the public github endpoint, otherwise `false`
 */
export function detectGHE(): boolean {
  const githubApiUrl = process.env.GITHUB_API_URL;
  const ghHost = process.env.GH_HOST;

  return (Boolean(ghHost) && ghHost!.trim().toLowerCase() != 'github.com')
    || (Boolean(githubApiUrl) && githubApiUrl!.trim().toLowerCase() != 'https://api.github.com');
}

/**
 * Returns an appropriate github token from the environment.
 *
 * @return GH_ENTERPRISE_TOKEN or GITHUB_ENTERPRISE_TOKEN or GITHUB_TOKEN if in an GHE environment, otherwise GITHUB_TOKEN
 */

export function getToken(isGHE: boolean): (string | undefined) {
  if (isGHE) {
    const githubEnterpiseToken = process.env.GH_ENTERPRISE_TOKEN ?? process.env.GITHUB_ENTERPRISE_TOKEN ?? process.env.GITHUB_TOKEN;
    return githubEnterpiseToken;
  }
  return process.env.GITHUB_TOKEN;
}

/**
 * Checks if SSH should be used to clone repo.
 * This checks the presence and values of the GIT_USE_SSH env variable and the deprecated GITHUB_USE_SSH for legacy reason. Returns true if either of these env vars are defined and not falsy.
 */

export function detectSSH(): boolean {
  return Boolean(process.env.GIT_USE_SSH ?? process.env.GITHUB_USE_SSH);
}

/**
 * Query the git index for changes.
 *
 * @return True if changes exist, False otherwise.
 */
export function diffIndex(): boolean {
  try {
    shell.run('git diff-index --exit-code HEAD --');
    return false;
  } catch (err) {
    return true;
  }
}

/**
 * Add files to the index.
 *
 * @param p the path.
 */
export function add(p: string) {
  shell.run(`git add ${p}`);
}

/**
 * Remove files from the working tree and from the index
 *
 * @param p the path.
 */
export function rm(p: string, options: { recursive?: boolean } = {}) {
  const cmd = ['git', 'rm'];
  if (options.recursive) {
    cmd.push('-r');
  }

  cmd.push(p);

  shell.run(cmd.join(' '));
}

/**
 * Commit.
 *
 * @param message the commit message.
 */
export function commit(message: string) {
  shell.run(`git commit -m "${message}"`);
}

/**
 * Initialize a repository.
 */
export function init() {
  shell.run('git init');
}

/**
 * Cerate a tag.
 *
 * @param name tag name.
 * @returns true if the tag was created, false if it already exists.
 */
export function tag(name: string): boolean {
  try {
    shell.run(`git tag -a ${name} -m ${name}`, { capture: true });
    return true;
  } catch (e) {
    if (e instanceof Error && e.message.includes('already exists')) {
      return false;
    }
    throw e;
  }
}

/**
 * Push a ref to origin.
 *
 * @param ref the ref
 */
export function push(ref: string) {
  shell.run(`git push origin ${ref}`);
}

/**
 * Checkout to a new branch. Creates a new one if `options.createIfMissing` is True and the branch doesn't exist.
 *
 * @param branch the branch.
 * @param options options.
 */
export function checkout(branch: string, options: { createIfMissing?: boolean } ) {
  if (options.createIfMissing) {
    try {
      shell.run(`git show-branch origin/${branch}`, { capture: true });
    } catch (e) {
      if (e instanceof Error && e.message.includes('fatal: bad sha1 reference')) {
        console.log('Remote branch not found, creating new branch.');
        shell.run(`git checkout -B ${branch}`);
        return;
      }
    }
  }
  shell.run(`git checkout ${branch}`);
}

/**
 * Fetch the configured git user name for the current directory.
 * Returns undefined if not configured.
 */
export function username() {
  try {
    return shell.run('git config user.name', { capture: true });
  } catch (err) {
    if (err instanceof Error) {
      console.warn(err.message);
    }
    return undefined;
  }
}

/**
 * Fetch the configured git user email for the current directory.
 * Returns undefined if not configured.
 */
export function email() {
  try {
    return shell.run('git config user.email', { capture: true });
  } catch (err) {
    if (err instanceof Error) {
      console.warn(err.message);
    }
    return undefined;
  }
}

/**
 * Identify the committer with a username and email.
 *
 * @param user the username.
 * @param email the email address.
 */
export function identify(user: string, address: string) {
  shell.run(`git config user.name "${user}"`);
  shell.run(`git config user.email "${address}"`);
}

/**
 * Does the given branch exists on the remote.
 */
export function branchExistsOnRemote(repositoryUrl: string, branch: string): boolean {
  return shell.check(`git ls-remote --exit-code --heads ${tryDetectRepositoryUrl(repositoryUrl)} ${branch}`, { capture: true });
}
