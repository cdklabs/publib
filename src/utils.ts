import * as child from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as shlex from 'shlex';

/**
 * Return the path under which a program is available.
 * Throws if the program is not installed.
 *
 * @param program program to check (e.g 'git')
 */
export function checkProgram(program: string): string {
  return shell(`which ${program}`, { capture: true });
}

/**
 * Options for the `shell` function.
 */
export interface ShellOptions {

  /**
   * Wokring directory.
   *
   * @default process.cwd()
   */
  readonly cwd?: string;

  /**
   * Capture the output of the command and return to caller.
   *
   * @default - no capture, output is printed to stdout.
   */
  readonly capture?: boolean;

  /**
   * Run the command inside a shell.
   *
   * @default false
   */
  readonly shell?: boolean;
}

/**
 * Run a shell command and return the output.
 * Throws if the command fails.
 *
 * @param command command (e.g 'git commit -m')
 */
export function shell(command: string, options: ShellOptions = {}): string {
  const shsplit = shlex.split(command);
  const pipe = options.capture ?? false;
  const result = child.spawnSync(shsplit[0], shsplit.slice(1), {
    stdio: ['ignore', pipe ? 'pipe' : 'inherit', process.stdout],
    cwd: options.cwd,
    shell: options.shell,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    // we always redirect stderr to stdout so its ok to take stdout.
    throw new Error(result.stdout.toString());
  }
  return result.stdout?.toString();
}

/**
 * Options for removing a directory.
 */
export interface RemoveDirectoryOptions {

  /**
   * list of basenames to exclude (e.g .git)
   *
   * @default - no exclude.
   */
  readonly exclude?: string[];

  /**
   * Remove the top level directory in addition to the content.
   *
   * @default true
   */
  readonly includeRoot?: boolean;
}

/**
 * Remove a directory recursively.
 *
 * @param dir directory.
 * @param options options.
 */
export function removeDirectory(dir: string, options: RemoveDirectoryOptions = {}) {
  for (const f of fs.readdirSync(dir)) {
    const curPath = path.join(dir, f);
    const exclude = options.exclude ?? [];
    if (exclude.includes(path.basename(curPath))) {
      continue;
    }
    if (fs.lstatSync(curPath).isDirectory()) {
      removeDirectory(curPath, options);
    } else {
      fs.unlinkSync(curPath);
    }
  }

  if (options.includeRoot ?? true) {
    fs.rmdirSync(dir);
  }
};

export function gitClone(repository: string, targetDir: string) {
  const gitHubToken = process.env.GITHUB_TOKEN;
  if (!gitHubToken) {
    throw new Error('GITHUB_TOKEN env variable is required');
  }
  shell(`git clone https://${gitHubToken}@github.com/${repository}.git ${targetDir}`);
}
