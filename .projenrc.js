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

project.synth();
