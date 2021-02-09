import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as utils from './utils';

/**
 * Encapsulates some information about the release.
 */
export interface GoRelease {

  /**
   * The tags the release created.
   */
  readonly tags?: string[];

  /**
   * The commit message of the release.
   */
  readonly commitMessage?: string;
}

/**
 * Properties for `GoReleaser`.
 */
export interface GoReleaserProps {

  /**
   * The source code directory.
   *
   * @default 'dist/go'
   */
  readonly dir?: string;

  /**
   * Execute a dry run only.
   *
   * @default false
   */
  readonly dryRun?: boolean;

  /**
   * The branch to push to.
   *
   * @default 'main'
   */
  readonly branch?: string;

  /**
   * The username to use for the commit.
   *
   * @default - taken from git config. throws if not configured.
   */
  readonly username?: string;

  /**
   * The email to use for the commit.
   *
   * @default - taken from git config. throws if not configured.
   */
  readonly email?: string;

  /**
   * The version.
   *
   * @default - taken from the 'version'. throws if doesn't exist.
   */
  readonly version?: string;
}

/**
 * Information about a specific module.
 */
export interface GoModule {

  /**
   * Path to the mod file.
   */
  readonly modFile: string;

  /**
   * The version of the module.
   */
  readonly version: string;

  /**
   * The cannonical name of the module. (e.g 'github.com/aws/constructs-go/constructs/v3`)
   */
  readonly cannonicalName: string;

  /**
   * The path inside the repository the module is located in. (e.g 'constructs')
   */
  readonly repoPath: string;

  /**
   * The repository URL. (e.g 'github.com/aws/constructs')
   */
  readonly repoURL: string;

}

/**
 * Release a set of Golang modules.
 */
export class GoReleaser {

  private readonly version?: string;

  private readonly dir: string;
  private readonly dryRun: boolean;
  private readonly gitBranch: string;
  private readonly gitUsername: string;
  private readonly gitUseremail: string;

  constructor(props: GoReleaserProps) {

    try {
      utils.checkProgram('git');
    } catch (err) {
      throw new Error(`git must be available to create this release: ${err.message}`);
    }

    this.version = props.version;
    this.dir = props.dir ?? path.join(process.cwd(), 'dist/go');
    this.gitBranch = props.branch ?? 'main';
    this.dryRun = props.dryRun ?? false;
    this.gitUsername = props.username ?? utils.shell('git config user.name', { capture: true });
    this.gitUseremail = props.email ?? utils.shell('git config user.email', { capture: true });

    if (this.gitUseremail === '') {
      throw new Error('Unable to detect username. either configure a global git user.name or pass GIT_USER_NAME env variable');
    }

    if (this.gitUsername === '') {
      throw new Error('Unable to detect user email. either configure a global git user.email or pass GIT_USER_EMAIL env variable');
    }

  }

  /**
   * Run the release process.
   *
   * @returns metadata about the release.
   */
  public release(): GoRelease {

    const modules = this.collectModules(this.dir);

    if (modules.length === 0) {
      console.log('No modules detected. Skipping');
      return {};
    }

    console.log('Detected modules:');
    modules.forEach(m => console.log(` - ${m.modFile}`));

    const repoURL = this.extractRepoURL(modules);
    const repoDir = path.join(fs.mkdtempSync(os.tmpdir()), 'repo');
    utils.gitHubClone(repoURL, repoDir);

    process.chdir(repoDir);

    try {
      utils.shell(`git checkout ${this.gitBranch}`);
    } catch (err) {
      utils.shell(`git checkout -b ${this.gitBranch}`);
    }

    this.syncModules(repoDir);
    try {
      utils.shell('git add .');
      utils.shell('git diff-index --exit-code HEAD --');
      console.log('No changes. Skipping release');
      return {};
    } catch (err) {
      // changes exist, thats ok.
    }

    const commitMessage = process.env.GIT_COMMIT_MESSAGE ?? this.createReleaseMessage(modules);

    utils.shell(`git config user.name ${this.gitUsername}`);
    utils.shell(`git config user.email ${this.gitUseremail}`);
    utils.shell(`git commit -m "${commitMessage}"`);

    const tags = modules.map(m => this.createTag(m));

    if (this.dryRun) {
      console.log(`Will push to branch: ${this.gitBranch}`);
      tags.forEach(t => console.log(`Will push tag: ${t}`));
    } else {
      utils.shell(`git push origin ${this.gitBranch}`);
      tags.forEach(t => utils.shell(`git push origin ${t}`));
    }
    return { tags, commitMessage };
  }

  private collectModules(dir: string): GoModule[] {
    const modules: GoModule[] = [];

    for (const p of [...fs.readdirSync(dir), '.']) {
      const modFile = path.join(dir, p, 'go.mod');
      if (fs.existsSync(modFile)) {
        modules.push(this.createModule(modFile));
      }
    }
    return modules;
  }

  private createModule(modFile: string): GoModule {

    const version = this.extractVersion(path.dirname(modFile));
    const majorVersion = version.split('.')[0];

    const cannonicalNameParts = [];
    for (const line of fs.readFileSync(modFile).toString().split('\n')) {
      if (line.startsWith('module ')) {
        cannonicalNameParts.push(...line.split(' ')[1].split('/'));
        break;
      }
    }

    if (cannonicalNameParts.length === 0) {
      throw new Error(`Unable to detected module declaration in ${modFile}`);
    }

    const repoURL = cannonicalNameParts.slice(0, 3).join('/');

    if (!repoURL.startsWith('github.com')) {
      throw new Error(`Repository must be hosted on github.com. Found: ${repoURL}`);
    }

    const cannonicalName = cannonicalNameParts.join('/');
    const repoPath = cannonicalNameParts.slice(3).join('/').replace(`/v${majorVersion}`, '');

    return { modFile, version, cannonicalName, repoPath, repoURL };

  }

  private syncModules(repoDir: string) {
    const topLevel = path.join(repoDir, 'go.mod');
    if (fs.existsSync(topLevel)) {
      // with top level modules we sync the entire repository
      utils.removeDirectory(repoDir, { includeRoot: false, exclude: ['.git'] });
    } else {
      // otherwise, we selectively remove the submodules only.
      for (const p of fs.readdirSync(repoDir)) {
        const submodule = path.join(repoDir, p, 'go.mod');
        if (fs.existsSync(submodule)) {
          utils.removeDirectory(path.join(repoDir, p));
        }
      }
    }
    utils.shell(`cp -r ${this.dir}/* ${repoDir}`, { shell: true });
  }

  private extractRepoURL(modules: GoModule[]): string {
    const repos = new Set<string>(modules.map(m => m.repoURL));
    if (repos.size === 0) {
      throw new Error('Unable to detect repository from module files.');
    }
    if (repos.size > 1) {
      throw new Error('Multiple repositories found in module files');
    }
    return repos.values().next().value;
  }

  private createReleaseMessage(modules: GoModule[]) {

    const semantic = 'chore(release)';

    const versions = new Set(modules.map(m => m.version));
    if (versions.size === 1) {
      // single version
      return `${semantic}: v${versions.values().next().value}`;
    } else {
      // multiple versions
      return `${semantic}: ${modules.map(m => `${m.repoPath}@v${m.version}`).join(' ')}`;
    }
  }

  private createTag(module: GoModule): string {
    const tagName = module.repoPath === '' ? `v${module.version}` : `${module.repoPath}/v${module.version}`;
    utils.shell(`git tag -a ${tagName} -m ${tagName}`);
    return tagName;
  }

  private extractVersion(moduleDirectory: string): string {
    let moduleVersion = undefined;
    const versionFile = path.join(moduleDirectory, 'version');
    if (this.version) {
      moduleVersion = this.version;
    } else if (fs.existsSync(versionFile)) {
      moduleVersion = fs.readFileSync(versionFile).toString();
    } else {
      throw new Error(`Unable to determine version of module ${moduleDirectory}. `
        + 'Either include a \'version\' file, or specify a global version using the VERSION environment variable.');
    }
    return moduleVersion;
  }

}