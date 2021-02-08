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
 * Release a set of Golang modules.
 */
export class GoReleaser {

  private readonly version?: string;

  private readonly dir: string;
  private readonly dryRun: boolean;
  private readonly gitBranch: string;
  private readonly gitUsername: string;
  private readonly gitUseremail: string;

  // hack to allow tests to inject a different clone behavior.
  // tried using a proper mock and lost too much time trying to make it work.
  // eventually we should switch.
  private readonly _cloner: (repository: string, targetDir: string) => void;

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

    this._cloner = this.cloneGitHub;

  }

  /**
   * Run the release process.
   *
   * @returns metadata about the release.
   */
  public release(): GoRelease {

    const modules = this.collectModules(this.dir);
    console.log('Detected modules:');
    modules.forEach(m => console.log(` - ${m}`));

    const repo = this.extractRepo(modules);
    const repoDir = path.join(fs.mkdtempSync(os.tmpdir()), path.basename(repo));
    this._cloner(repo, repoDir);

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

    const tags = modules.map(m => this.createTag(m, repoDir));

    if (this.dryRun) {
      console.log(`Will push to branch: ${this.gitBranch}`);
      tags.forEach(t => console.log(`Will push tag: ${t}`));
    } else {
      utils.shell(`git push origin ${this.gitBranch}`);
      tags.forEach(t => utils.shell(`git push origin ${t}`));
    }
    return { tags, commitMessage };
  }

  private cloneGitHub(repository: string, targetDir: string) {
    const gitHubToken = process.env.GITHUB_TOKEN;
    if (!gitHubToken) {
      throw new Error('GITHUB_TOKEN env variable is required');
    }
    utils.shell(`git clone https://${gitHubToken}@github.com/${repository}.git ${targetDir}`);
  }

  private collectModules(dir: string): string[] {
    const modules = [];

    // top level module
    if (fs.existsSync(path.join(dir, 'go.mod'))) {
      modules.push(dir);
    }

    // submodules
    for (const p of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, p);
      if (fs.existsSync(path.join(fullPath, 'go.mod'))) {
        modules.push(fullPath);
      }
    }
    return modules;
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

  private extractRepo(modules: string[]): string {
    const repos = new Set<string>();

    function findModuleDeclaration(_modFile: string) {
      for (const line of fs.readFileSync(_modFile).toString().split('\n')) {
        if (line.startsWith('module ')) {
          return line.split(' ')[1];
        }
      }
      throw new Error(`No module declaration in file: ${_modFile}`);
    }

    for (const module of modules) {
      const modFile = path.join(module, 'go.mod');
      const fullModuleName = findModuleDeclaration(modFile).split('/');
      const domain = fullModuleName[0];
      if (domain !== 'github.com') {
        throw new Error(`${domain} is not supported`);
      }
      const owner = fullModuleName[1];
      const repo = fullModuleName[2];
      repos.add(`${owner}/${repo}`);
    }

    if (repos.size === 0) {
      throw new Error('Unable to detect repository from module files.');
    }
    if (repos.size > 1) {
      throw new Error('Multiple repositories found in module files');
    }
    return repos.values().next().value;
  }

  private createReleaseMessage(modules: readonly string[]) {

    const moduleVersions: any = {};
    for (const moduleDir of modules) {
      const moduleName = path.basename(moduleDir);
      const moduleVersion = this.extractVersion(moduleDir);
      moduleVersions[moduleName] = moduleVersion;
    }

    const semantic = 'chore(release)';

    const versions = new Set(Object.values(moduleVersions));
    if (versions.size === 1) {
      // single version
      return `${semantic}: v${versions.values().next().value}`;
    } else {
      // multiple versions
      return `${semantic}: ${Object.entries(moduleVersions).map(e => `${e[0]}@v${e[1]}`).join(' ')}`;
    }
  }

  private createTag(moduleDirectory: string, repoDir: string): string {
    const moduleName = path.basename(moduleDirectory);
    const moduleVersion = this.extractVersion(moduleDirectory);
    let tagName = undefined;
    if (moduleName === path.basename(repoDir)) {
      // root module
      tagName = `v${moduleVersion}`;
    } else {
      // sub module
      tagName = `${moduleName}/v${moduleVersion}`;
    }
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