import { readdirSync } from 'fs';
import { typescript, github } from 'projen';

const project = new typescript.TypeScriptProject({
  projenrcTs: true,
  defaultReleaseBranch: 'main',
  name: 'publib',
  description: 'Release jsii modules to multiple package managers',
  releaseToNpm: true,
  repository: 'https://github.com/cdklabs/publib.git',
  authorName: 'Amazon Web Services',
  authorOrganization: true,
  authorUrl: 'https://aws.amazon.com',
  homepage: 'https://github.com/cdklabs/publib',
  autoApproveOptions: {
    allowedUsernames: ['cdklabs-automation'],
    secret: 'GITHUB_TOKEN',
  },
  devDeps: [
    'ts-node',
    '@aws-sdk/client-sts',
  ],
  autoApproveUpgrades: true,
});

// we can't use 9.x because it doesn't work with node 10.
const fsExtraVersion = '^8.0.0';

project.addDeps('shlex', `fs-extra@${fsExtraVersion}`, `@types/fs-extra@${fsExtraVersion}`);

const legacy = project.addTask('package-legacy');
legacy.exec('cp package.json package.json.bak');
legacy.exec('node ./scripts/update-package-name.js jsii-release');
legacy.exec('npm pack');
legacy.exec('mv ./jsii-release*.tgz dist/js');
legacy.exec('cp package.json.bak package.json');
legacy.exec('rm package.json.bak');

project.packageTask.spawn(legacy);

// map all "jsii-release-*" to "jsii-release-shim" as executables
for (const f of readdirSync('./bin').filter(file => file.startsWith('publib'))) {
  const shim = ['jsii-release', f.split('-')[1]].filter(x => x).join('-');
  project.addBins({ [shim]: './bin/jsii-release-shim' });
}

//////////////////////////////////////////////////////////////////////

const test = github.GitHub.of(project)?.addWorkflow('integ');
test?.on({
  pullRequestTarget: {
    types: [
      'labeled',
      'opened',
      'synchronize',
      'reopened',
      'ready_for_review',
    ],
  },
  mergeGroup: {},
});

// Select `IntegTestCredentials` or `IntegTestCredentialsRequireApproval` depending on the author of the PR
// github.pull_request.author_association in ['OWNER', 'COLLABORATOR', 'MEMBER', 'NONE']
// github.pull_request.user.login
// Because we have an 'if/else' condition that is quite annoying to encode with outputs, have a mutable variable by
// means of a file on disk, export it as an output afterwards.
test?.addJob('targetenv', {
  permissions: {
    contents: github.workflows.JobPermission.READ,
  },
  runsOn: ['ubuntu-latest'],
  steps: [
    {
      name: 'Print event output for debugging in case the condition is incorrect',
      run: 'cat $GITHUB_EVENT_PATH',
    },
    {
      name: 'Start requiring approval',
      run: 'echo IntegTestCredentialsRequireApproval > .envname',
    },
    {
      name: 'If maintainer, do not need approval',
      if: [
        'github.pull_request.author_association == \'OWNER\'',
        'github.pull_request.author_association == \'MEMBER\'',
        'github.pull_request.user.login == \'cdklabs-automation\'',
      ].join(' || '),
      run: 'echo IntegTestCredentials > .envname',
    },
    {
      id: 'output',
      name: 'Output the value',
      run: 'echo "env_name=$(cat .envname)" >> "$GITHUB_OUTPUT"',
    },
  ],
  outputs: {
    env_name: { stepId: 'output', outputName: 'env_name' },
  },
});
test?.addJob('test', {
  permissions: {
    contents: github.workflows.JobPermission.READ,
    idToken: github.workflows.JobPermission.WRITE,
  },
  runsOn: ['ubuntu-latest'],
  needs: ['targetenv'],
  environment: '${{needs.targetenv.outputs.env_name}}',
  steps: [
    {
      name: 'Federate into AWS',
      uses: 'aws-actions/configure-aws-credentials@v2',
      with: {
        'aws-region': 'us-east-1',
        'role-to-assume': '${{ secrets.AWS_ROLE_TO_ASSUME }}',
        'role-session-name': 'publib-integ-test',
      },
    },
    {
      name: 'Checkout',
      uses: 'actions/checkout@v3',
      with: {
        ref: '${{ github.event.pull_request.head.ref }}',
      },
    },
    {
      name: 'Setup Node.js',
      uses: 'actions/setup-node@v3',
      with: {
        'node-version': '16.16.0',
        'cache': 'yarn',
      },
    },
    {
      name: 'Yarn install',
      run: 'yarn install --frozen-lockfile',
    },
    {
      name: 'Run integration tests',
      // Replace the 'testMatch' in package.json
      run: 'npx jest --testMatch "<rootDir>/test/**/*.integ.ts"',
    },
  ],
});

project.synth();
