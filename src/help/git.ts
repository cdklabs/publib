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

export function diffIndex(): boolean {
  try {
    shell.run('git diff-index --exit-code HEAD --');
    return false;
  } catch (err) {
    return true;
  }
}

export function add(p: string) {
  shell.run(`git add ${p}`);
}

export function commit(message: string, user: string, address: string) {
  shell.run(`git commit --author "${user} <${address}>" -m "${message}"`);
}

export function init() {
  shell.run('git init');
}

export function tag(name: string) {
  shell.run(`git tag -a ${name} -m ${name}`);
}

export function push(ref: string) {
  shell.run(`git push origin ${ref}`);
}

export function checkout(branch: string, options: { create?: boolean } ) {
  try {
    shell.run(`git checkout ${branch}`);
  } catch (err) {
    if (options.create ?? false) {
      shell.run(`git checkout -b ${branch}`);
    } else {
      throw err;
    }
  }
}

export function username() {
  return shell.run('git config --global user.name', { capture: true });
}

export function email() {
  return shell.run('git config --global user.email', { capture: true });
}