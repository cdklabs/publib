import * as child from 'child_process';

/**
 * Return the path under which a program is available.
 * Throws if the program is not installed.
 *
 * @param program program to check (e.g 'git')
 */
export function which(program: string): string {
  return run('which', [program]);
}

/**
 * Run a shell command and return the output.
 * Throws if the command fails.
 *
 * @param program command (e.g 'git commit')
 */
export function run(program: string, args: string[], options?: child.SpawnSyncOptions): string {
  const result = child.spawnSync(program, args, options);
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.stdout.toString();
}
