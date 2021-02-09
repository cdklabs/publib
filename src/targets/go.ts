import * as path from 'path';
import * as fs from 'fs-extra';
import * as git from '../help/git';
import * as os from '../help/os';
import * as shell from '../help/shell';

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

    if (!shell.which('git')) {
      throw new Error('git must be available to in order to be able to push Go code to GitHub');
    }

    this.version = props.version;
    this.dir = props.dir ?? path.join(process.cwd(), 'dist', 'go');
    this.gitBranch = props.branch ?? 'main';
    this.dryRun = props.dryRun ?? false;
    this.gitUsername = props.username ?? git.username();
    this.gitUseremail = props.email ?? git.email();

    if (!this.gitUseremail) {
      throw new Error('Unable to detect username. either configure a global git user.name or pass GIT_USER_NAME env variable');
    }

    if (!this.gitUsername) {
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
    const repoDir = path.join(os.mkdtempSync(), 'repo');
    git.clone(repoURL, repoDir);

    const cwd = process.cwd();
    try {
      process.chdir(repoDir);
      return this.doRelease(modules, repoDir);
    } finally {
      process.chdir(cwd);
    }

  }

  private doRelease(modules: GoModule[], repoDir: string): GoRelease {

    git.checkout(this.gitBranch, { create: true });
    this.syncModules(repoDir);

    git.add('.');
    if (!git.diffIndex()) {
      console.log('No changes. Skipping release');
      return {};
    }

    const commitMessage = process.env.GIT_COMMIT_MESSAGE ?? this.createReleaseMessage(modules);
    git.commit(commitMessage, this.gitUseremail, this.gitUseremail);

    const tags = modules.map(m => this.createTag(m));
    const refs = [...tags, this.gitBranch];

    if (this.dryRun) {
      refs.forEach(t => console.log(`Will push: ${t}`));
    } else {
      refs.forEach(t => git.push(t));
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
      // so we just empty it out
      fs.readdirSync(repoDir)
        .filter(f => f !== '.git')
        .forEach(f => fs.removeSync(path.join(repoDir, f)));
    } else {
      // otherwise, we selectively remove the submodules only.
      for (const p of fs.readdirSync(repoDir)) {
        const submodule = path.join(repoDir, p, 'go.mod');
        if (fs.existsSync(submodule)) {
          fs.removeSync(path.join(repoDir, p));
        }
      }
    }
    fs.copySync(this.dir, repoDir, { recursive: true });
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
    git.tag(tagName);
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