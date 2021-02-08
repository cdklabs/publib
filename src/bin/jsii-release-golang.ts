import * as go from '../go';

const releaser = new go.GoReleaser({
  dir: process.argv[2],
  branch: process.env.GIT_BRANCH,
  dryRun: (process.env.DRYRUN ?? 'false').toLowerCase() === 'true',
  email: process.env.GIT_USER_EMAIL,
  username: process.env.GIT_USER_NAME,
  version: process.env.VERSION,
});

releaser.release();