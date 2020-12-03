const { NodeProject } = require('projen');

const project = new NodeProject({
  name: "jsii-release",
  description: 'Release jsii modules to multiple package managers',
  releaseToNpm: true,
  keywords: ['jsii'],
  repository: 'https://github.com/aws/jsii-release.git',
  authorName: 'Amazon Web Services',
  authorOrganization: true,
  authorUrl: 'https://aws.amazon.com',
  jest: false,
  homepage: 'https://github.com/aws/jsii-release',
});

// create tarball and move to dist/js so release workflow can pick it up from there.
project.buildTask.exec('yarn pack');
project.buildTask.exec('mkdir -p dist/js');
project.buildTask.exec(`mv ./jsii-release-v*.tgz dist/js`);

project.synth();
