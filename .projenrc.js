const { readdirSync } = require('fs');
const { typescript } = require('projen');

const project = new typescript.TypeScriptProject({
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
  autoApproveUpgrades: true,
  minNodeVersion: '14.17.0',
  deps: [
    '@aws-sdk/client-codeartifact',
    '@aws-sdk/credential-providers',
    '@aws-sdk/types',
    'glob',
    'yargs',
    'p-queue',
  ],
  devDeps: [
    '@types/node@^14.17.0',
  ],
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
  const shim = ['jsii-release', f.split('-')[1]].filter(x=>x).join('-');
  project.addBins({ [shim]: './bin/jsii-release-shim' });
}

project.synth();
