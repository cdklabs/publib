import * as shell from './shell';

/**
 * Clones a repository from GitHub. Requires a `GITHUB_TOKEN` env variable.
 *
 * @param repositoryUrl the repository to clone.
 * @param targetDir the clone directory.
 */
export function clone(repositoryUrl: string, targetDir: string) {
  const gitHubToken = process.env.GITHUB_TOKEN;
  if (!gitHubToken) {
    throw new Error('GITHUB_TOKEN env variable is required');
  }
  shell.run(`git clone https://${gitHubToken}@${repositoryUrl}.git ${targetDir}`);
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
    if (e.message.includes('already exists')) {
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
    console.warn(err.message);
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
    console.warn(err.message);
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