import * as child from 'child_process';
import * as shlex from 'shlex';

/**
 * Options for the `run` function.
 */
export interface RunOptions {

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
export function run(command: string, options: RunOptions = {}): string {
  const shsplit = shlex.split(command);
  const pipeOrInherit = (options.capture ?? false) ? 'pipe': 'inherit';
  const result = child.spawnSync(shsplit[0], shsplit.slice(1), {
    stdio: ['ignore', pipeOrInherit, pipeOrInherit],
    cwd: options.cwd,
    shell: options.shell,
  });
  if (result.error) {
    throw result.error;
  }

  const stdout = result.stdout?.toString();
  const stderr = result.stderr?.toString();

  if (result.status !== 0) {
    const message = `
    Command failed: ${command}.
      Output: ${stdout}
      Error:${stderr}`;
    throw new Error(message);
  }
  return stdout;
}

/**
 * Return the path under which a program is available.
 * Empty string if the program is not installed.
 *
 * @param program program to check (e.g 'git')
 */
export function which(program: string): string {
  try {
    return run(`which ${program}`, { capture: true });
  } catch (err) {
    return '';
  }
}

