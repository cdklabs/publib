const { typescript } = require('projen');

const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: 'master',
  name: 'jsii-release',
  description: 'Release jsii modules to multiple package managers',
  releaseToNpm: true,
  keywords: ['jsii'],
  repository: 'https://github.com/aws/jsii-release.git',
  authorName: 'Amazon Web Services',
  authorOrganization: true,
  authorUrl: 'https://aws.amazon.com',
  homepage: 'https://github.com/aws/jsii-release',
  projenUpgradeSecret: 'PROJEN_GITHUB_TOKEN',
  autoApproveOptions: {
    allowedUsernames: ['cdklabs-automation'],
    secret: 'GITHUB_TOKEN',
  },
  autoApproveUpgrades: true,
});

// create tarball and move to dist/js so release workflow can pick it up from there.
project.projectBuild.postCompileTask.exec('yarn pack');
project.projectBuild.postCompileTask.exec('mkdir -p dist/js');
project.projectBuild.postCompileTask.exec('mv ./jsii-release-v*.tgz dist/js');

// we can't use 9.x because it doesn't work with node 10.
const fsExtraVersion = '^8.0.0';

project.addDeps('shlex', `fs-extra@${fsExtraVersion}`, `@types/fs-extra@${fsExtraVersion}`);

const publib = project.addTask('package-as-publib');
publib.exec('cp package.json package.json.bak');
publib.exec('node ./scripts/update-package-name.js publib');
publib.exec('yarn pack');
publib.exec('mv ./publib*.tgz dist/js');
publib.exec('cp package.json.bak package.json');
publib.exec('rm package.json.bak');

project.packageTask.spawn(publib);


project.synth();
