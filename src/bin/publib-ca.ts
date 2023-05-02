/**
 * Publib CodeArtifact CLI
 */
/* eslint-disable no-console */
import * as yargs from 'yargs';
import { CodeArtifactCli } from '../codeartifact/codeartifact-cli';
import { header } from '../codeartifact/display';

async function main() {
  await yargs
    .usage('$0 <command>')
    .option('assume-role-arn', {
      description: 'Role to assume before doing CodeArtifact calls',
      alias: 'a',
      requiresArg: true,
      type: 'string',
    })
    .command('create', 'Create a temporary CodeArtifact repository with upstreams', cmd => cmd
      .option('gc', {
        description: 'Garbage collect old repositories',
        type: 'boolean',
        default: true,
      })
      .option('login', {
        description: 'Automatically log in to the newly created repository',
        type: 'boolean',
        default: true,
      }), async (args) => {

      const cli = new CodeArtifactCli({
        assumeRoleArn: args['assume-role-arn'],
      });

      if (args.gc) {
        await cli.gc();
      }

      const repoName = await cli.create();
      console.log(repoName);

      if (args.login) {
        await cli.login(repoName);
        cli.usageDir.advertise();
      }
    })
    .command('gc', 'Clean up day-old testing repositories', cmd => cmd, async (args) => {
      const cli = new CodeArtifactCli({
        assumeRoleArn: args['assume-role-arn'],
      });
      await cli.gc();
    })
    .command('login', 'Login to a given repository', cmd => cmd
      .option('repo', {
        alias: 'r',
        description: 'Name of the repository to log in to',
        type: 'string',
        requiresArg: true,
        demandOption: true,
      })
      .option('cmd', {
        alias: 'c',
        description: 'Run a command in a shell set up for the target repository',
        type: 'string',
        requiresArg: true,
      }), async (args) => {

      const cli = new CodeArtifactCli({
        assumeRoleArn: args['assume-role-arn'],
      });
      await cli.login(args.repo);

      if (args.cmd) {
        await cli.runCommand(args.cmd);
      } else {
        cli.usageDir.advertise();
      }
    })
    .command('shell', 'Start a subshell with the repository activated', cmd => cmd
      .option('repo', {
        alias: 'r',
        description: 'Name of the repository to log in to',
        type: 'string',
        requiresArg: true,
        demandOption: false,
      }), async (args) => {
      const cli = new CodeArtifactCli({
        assumeRoleArn: args['assume-role-arn'],
      });
      const repo = await cli.login(args.repo);

      const defaultShell = process.platform === 'win32' ? 'cmd' : 'bash';

      header(`Shell activated for ${repo.repositoryName}`);
      await cli.runInteractively(process.env.SHELL ?? defaultShell);
    })
    .command('publish <DIRECTORY>', 'Publish a given directory', cmd => cmd
      .positional('DIRECTORY', {
        descripton: 'Directory distribution',
        type: 'string',
        demandOption: true,
      })
      .option('repo', {
        alias: 'r',
        description: 'Name of the repository to create (default: generate unique name)',
        type: 'string',
        requiresArg: true,
      }), async (args) => {

      const cli = new CodeArtifactCli({
        assumeRoleArn: args['assume-role-arn'],
      });
      await cli.publish(args.DIRECTORY, args.repo);
    })
    .command('delete', 'Delete testing repository', cmd => cmd
      .option('repo', {
        alias: 'r',
        description: 'Name of the repository to cleanup (default: most recently logged in to)',
        type: 'string',
        requiresArg: true,
      }), async (args) => {

      const cli = new CodeArtifactCli({
        assumeRoleArn: args['assume-role-arn'],
      });
      await cli.delete(args.repo);
    })
    .demandCommand(1, 'You must supply a command')
    .help()
    .showHelpOnFail(false)
    .parse();
}

main().catch(e => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});
