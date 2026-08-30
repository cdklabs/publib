import * as cdklabs from 'cdklabs-projen-project-types';
import { readdirSync } from 'fs-extra';
import { github, javascript } from 'projen';
import { TypeScriptRunner } from 'projen/lib/typescript';

const project = new cdklabs.CdklabsTypeScriptProject({
  name: 'publib',
  description: 'Release jsii modules to multiple package managers',
  repository: 'https://github.com/cdklabs/publib.git',
  authorUrl: 'https://aws.amazon.com',
  homepage: 'https://github.com/cdklabs/publib',

  private: false,
  releaseToNpm: true,
  setNodeEngineVersion: false,

  projenrcTs: true,
  packageManager: javascript.NodePackageManager.NPM,
  runner: TypeScriptRunner.tsx(),

  devDeps: [
    '@aws-sdk/client-sts',
    '@smithy/types',
    '@types/fs-extra',
    '@types/node@^20',
    '@types/yargs@^17',
    'cdklabs-projen-project-types',
  ],
  deps: [
    '@aws-sdk/client-codeartifact',
    '@aws-sdk/credential-providers',
    'fs-extra',
    'p-queue@6', // Last non-ESM version
    'shlex',
    'yargs@^17',
    'zx',
  ],

  enablePRAutoMerge: true,
  autoApproveUpgrades: true,
  depsUpgradeOptions: {
    workflowOptions: {
      schedule: javascript.UpgradeDependenciesSchedule.WEEKLY,
    },
  },

  tsconfig: {
    compilerOptions: {
      skipLibCheck: true,
    },
  },
});

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

const integ = project.addTask('integ');
// This replaces the 'testMatch' in package.json with a different glob
integ.exec('jest --testMatch "<rootDir>/test/**/*.integ.ts"');

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

// Select `IntegTestCredentials` or `IntegTestCredentialsRequireApproval` depending on whether this is
// a PR from a fork or not (assumption: writers can be trusted, forkers cannot).
//
// Because we have an 'if/else' condition that is quite annoying to encode with outputs, have a mutable variable by
// means of a file on disk, export it as an output afterwards.
test?.addJob('determine_env', {
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
      name: 'Run automatically if in a mergeGroup or PR created from this repo',
      // In a mergeGroup event, or a non-forked request, run without confirmation
      if: "${{ github.event_name == 'merge_group' || github.event.pull_request.head.repo.full_name == github.repository }}",
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

// Job name matches a branch protection rule check configured elsewhere
test?.addJob('integ', {
  permissions: {
    contents: github.workflows.JobPermission.READ,
    idToken: github.workflows.JobPermission.WRITE,
  },
  runsOn: ['ubuntu-latest'],
  needs: ['determine_env'],
  environment: '${{needs.determine_env.outputs.env_name}}',
  steps: [
    {
      name: 'Federate into AWS',
      uses: 'aws-actions/configure-aws-credentials@v6',
      with: {
        'aws-region': 'us-east-1',
        'role-to-assume': '${{ secrets.AWS_ROLE_TO_ASSUME }}',
        'role-session-name': 'publib-integ-test',
      },
    },
    {
      name: 'Checkout',
      uses: 'actions/checkout@v7',
      with: {
        ref: '${{ github.event.pull_request.head.sha }}',
        // Need this because we are running on pull_request_target
        repository: '${{ github.event.pull_request.head.repo.full_name }}',
      },
    },
    {
      name: 'Setup Node.js',
      uses: 'actions/setup-node@v7.0.0',
      with: {
        'node-version': 'lts/-1',
        'package-manager-cache': false,
      },
    },
    {
      name: 'npm install',
      run: 'npm ci',
    },
    {
      name: 'Run integration tests',
      run: 'npm run integ',
    },
  ],
});

project.synth();
