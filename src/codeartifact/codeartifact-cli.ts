import * as path from 'path';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import * as glob from 'glob';
import { CodeArtifactRepo, CodeArtifactRepoOptions, LoginInformation } from './codeartifact-repo';
import { shell } from './shell';
import { uploadJavaPackages, mavenLogin } from './staging/maven';
import { uploadNpmPackages, npmLogin } from './staging/npm';
import { uploadDotnetPackages, nugetLogin } from './staging/nuget';
import { uploadPythonPackages, pipLogin } from './staging/pip';
import { UsageDir } from './usage-dir';

export interface CodeArtifactCliOptions {
  readonly assumeRoleArn?: string;
}

export class CodeArtifactCli {
  public readonly usageDir = UsageDir.default();

  constructor(private readonly options: CodeArtifactCliOptions = {}) {
  }

  private get repoOptions(): CodeArtifactRepoOptions {
    return {
      credentials: this.options.assumeRoleArn ? fromTemporaryCredentials({
        params: {
          RoleArn: this.options.assumeRoleArn,
          DurationSeconds: 3600,
          RoleSessionName: 'publib-ca',
        },
      }) : undefined,
    };
  }

  /**
   * Create a random repository, return its name
   */
  public async create() {
    const repo = await CodeArtifactRepo.createRandom(this.repoOptions);
    return repo.repositoryName;
  }

  /**
   * Delete the given repo
   */
  public async delete(repoName?: string) {
    const repo = await this.repoFromName(repoName);
    await repo.delete();

    if (!repoName) {
      await this.usageDir.delete();
    }
  }

  /**
   * Log in to the given repo, write activation instructins to the usage dir
   */
  public async login(repoName: string) {
    const repo = await this.repoFromName(repoName);
    const login = await repo.login();

    await this.usageDir.putJson('login', login);

    await this.usageDir.reset();
    await this.usageDir.addToEnv({
      CODEARTIFACT_REPO: login.repositoryName,
    });

    await npmLogin(login, this.usageDir);
    await pipLogin(login, this.usageDir);
    await mavenLogin(login, this.usageDir);
    await nugetLogin(login, this.usageDir);
  }

  public async publish(directory: string, repoName?: string) {
    const repo = await this.repoFromName(repoName);
    const login = await repo.login();

    header('NPM');
    await uploadNpmPackages(glob.sync(path.join(directory, 'js', '*.tgz')), login, this.usageDir);

    header('Python');
    await uploadPythonPackages(glob.sync(path.join(directory, 'python', '*')), login);

    header('Java');
    await uploadJavaPackages(glob.sync(path.join(directory, 'java', '**', '*.pom')), login, this.usageDir);

    header('.NET');
    await uploadDotnetPackages(glob.sync(path.join(directory, 'dotnet', '**', '*.nupkg')), this.usageDir);

    console.log('🛍 Configuring packages for upstream versions');
    await repo.markAllUpstreamAllow();
  }

  public async gc() {
    await CodeArtifactRepo.gc(this.repoOptions);
  }

  public async runCommand(command: string) {
    await this.usageDir.activateInCurrentProcess();
    await shell(command, {
      shell: true,
      show: 'always',
    });
  }

  /**
   * Return a CodeArtifactRepo object, either from the name argument or the most recently activated repository
   */
  private async repoFromName(repoName?: string) {
    if (repoName) {
      return CodeArtifactRepo.existing(repoName, this.repoOptions);
    }

    const loginInfo = await this.usageDir.isValid() ? await this.usageDir.readJson<LoginInformation>('login') : undefined;

    if (loginInfo && loginInfo.expirationTimeMs > Date.now()) {
      const existing = CodeArtifactRepo.existing(loginInfo.repositoryName, this.repoOptions);
      existing.setLoginInformation(loginInfo);
      return existing;
    }

    throw new Error('No repository name given, and no repository activated recently. Login to a repo or pass a repo name.');
  }
}

function header(caption: string) {
  console.log('');
  console.log('/'.repeat(70));
  console.log(`//  ${caption}`);
  console.log('');
}
