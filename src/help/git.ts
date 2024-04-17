import * as shell from './shell';

/**
 * Clones a repository from GitHub. Requires a `GITHUB_TOKEN` env variable.
 *
 * @param repositoryUrl the repository to clone.
 * @param targetDir the clone directory.
 */
export function clone(repositoryUrl: string, targetDir: string) {
  const gitHubUseSsh = detectSSH();
  if (gitHubUseSsh) {
    const sshRepositoryUrl = repositoryUrl.replace('/', ':');
    shell.run(`git clone git@${sshRepositoryUrl}.git ${targetDir}`);
  } else {
    const gitHubToken = getToken(detectGHE());
    if (!gitHubToken) {
      throw new Error('GITHUB_TOKEN env variable is required when GITHUB_USE_SSH env variable is not used');
    }
    shell.run(`git clone https://${gitHubToken}@${repositoryUrl}.git ${targetDir}`);

  }
}

/**
 * Checks if the GitHub API URL set in the GitHub Actions workflow is not the public GitHub API URL.
 * https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
 *
 * @return True if GITHUB_API_URL env var is defined and not equal to public github API URL, false,
 */
export function detectGHE(): boolean {
  const githubApiUrl = process.env.GITHUB_API_URL;
  if (!githubApiUrl) {
    return false;
  }
  return githubApiUrl!.trim().toLowerCase()!= 'https://api.github.com';

}

/**
 * Checks for the presence of GITHUB_TOKEN set in the GitHub Actions workflow, as well as if there are GHE related env vars set.
 * https://cli.github.com/manual/gh_help_environment
 *
 * @return either GH_ENTERPRISE_TOKEN or GITHUB_ENTERPRISE_TOKEN if one of the two and the GH_HOST env var is set, otherwise returns GITHUB_TOKEN env var.
 */

export function getToken(isGHE: boolean): (string | undefined) {
  if (isGHE) {
    const githubEnterpiseToken = process.env.GH_ENTERPRISE_TOKEN ?? process.env.GITHUB_ENTERPRISE_TOKEN;
    const githubEnterpriseHost = process.env.GH_HOST;
    if (githubEnterpiseToken && githubEnterpriseHost) {
      return githubEnterpiseToken;
    }
  }
  return process.env.GITHUB_TOKEN;
}

/**
 * Checks for the presence of SSH-related env vars in the GitHub Actions workflow to see if SSH should be used to clone repo.
 * @return GIT_USE_SSH env var if it's defined, otherwise returns GITHUB_USE_SSH env var.
 */

export function detectSSH(): (string | undefined) {
  const gitHubUseSsh = process.env.GIT_USE_SSH ?? process.env.GITHUB_USE_SSH;
  return gitHubUseSsh;
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
      shell.run(`git show-branch origin/${branch}`);
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
