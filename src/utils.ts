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
export function which(program: string): string {
  return shell(`which ${program}`);
}

/**
 * Run a shell command and return the output.
 * Throws if the command fails.
 *
 * @param command command (e.g 'git commit -m')
 */
export function shell(command: string, options?: child.SpawnSyncOptions): string {
  const shsplit = shlex.split(command);
  const result = child.spawnSync(shsplit[0], shsplit.slice(1), {
    stdio: [
      'ignore', // ignore stdio
      'inherit', // inherit stdout
      process.stdout, // redirect stderr to stdout
    ],
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const message = `[stdout: ${result.stdout?.toString()} | stderr: ${result.stderr?.toString()}]`;
    throw new Error(message);
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
