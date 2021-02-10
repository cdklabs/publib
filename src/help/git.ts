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
 * Pefrom a commit. If `options.user` is specified, author information will be added.
 *
 * @param message the commit message.
 * @param options options.
 */
export function commit(message: string, options: { user?: string; address?: string } ) {
  const author = options.user ? `"${options.user} <${options.address ?? ''}>"` : undefined;

  const flags = ['-m', `"${message}"`];

  if (author) {
    flags.push('--author', author);
  }

  shell.run(`git commit ${flags.join(' ')}`);
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
 */
export function tag(name: string) {
  shell.run(`git tag -a ${name} -m ${name}`);
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
 * Checkout to a new branch. Creates a new one if `options.create` is True.
 *
 * @param branch the branch.
 * @param options options.
 */
export function checkout(branch: string, options: { create?: boolean } ) {
  const flags = [];
  if (options.create) { flags.push('-B'); }
  shell.run(`git checkout ${flags.join(' ')} ${branch}`);
}

/**
 * Fetch the globally configured git user name.
 */
export function username() {
  return shell.run('git config --global user.name', { capture: true });
}

/**
 * Fetch the globally configured git user email.
 */
export function email() {
  return shell.run('git config --global user.email', { capture: true });
}