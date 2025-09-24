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

  /**
   * The directory where the repository was released from.
   */
  readonly repoDir?: string;
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

  /**
   * The message to use for the commit marking the release.
   */
  readonly message?: string;

  /**
   * The git clone depth.
   *
   * Usually only the latest commit is required.
   *
   * @default 1
   */
  readonly cloneDepth?: number;
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
  private readonly gitCommitMessage?: string;

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
    this.gitCommitMessage = props.message;
    this.dir = path.resolve(props.dir ?? path.join(process.cwd(), 'dist', 'go'));
    this.gitBranch = props.branch ?? 'main';
    this.dryRun = props.dryRun ?? false;

    const gitUsername = props.username ?? git.username();
    const gitUseremail = props.email ?? git.email();

    if (!gitUsername) {
      throw new Error('Unable to detect username. either configure a git user.name or pass GIT_USER_NAME env variable');
    }

    if (!gitUseremail) {
      throw new Error('Unable to detect user email. either configure a git user.email or pass GIT_USER_EMAIL env variable');
    }

    this.gitUseremail = gitUseremail;
    this.gitUsername = gitUsername;
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

    const branchExists = git.branchExistsOnRemote(repoURL, this.gitBranch);
    if (!branchExists) {
      console.log(`Remote branch '${this.gitBranch}' not found, continuing with default branch.`);
    }
    const cloneOptions = {
      tags: true, // we need to know about all tags to not re-create an existing one
      branch: branchExists ? this.gitBranch : undefined,
    };

    git.clone(repoURL, repoDir, cloneOptions);

    const cwd = process.cwd();
    try {
      process.chdir(repoDir);
      return this.doRelease(modules, repoDir);
    } finally {
      process.chdir(cwd);
    }

  }

  private doRelease(modules: GoModule[], repoDir: string): GoRelease {

    git.identify(this.gitUsername, this.gitUseremail);
    git.checkout(this.gitBranch, { createIfMissing: true });
    this.syncRepo(repoDir);

    git.add('.');
    if (!git.diffIndex()) {
      console.log('No changes. Skipping release');
      return {};
    }

    const commitMessage = this.gitCommitMessage ?? this.buildReleaseMessage(modules);
    git.commit(commitMessage);

    const tags = [];
    for (const module of modules) {
      const name = this.buildTagName(module);
      const created = git.tag(name);
      if (created) { tags.push(name); }
    }

    if (tags.length === 0) {
      console.log('All tags already exist. Skipping release');
      return {};
    }

    const refs = [...tags, this.gitBranch];

    if (this.dryRun) {
      console.log('===========================================');
      console.log('            🏜️ DRY-RUN MODE 🏜️');
      console.log('===========================================');
      refs.forEach(t => console.log(`Remote ref will be updated: ${t}`));
    } else {
      refs.forEach(t => git.push(t));
    }
    return { tags, commitMessage, repoDir };
  }

  private collectModules(dir: string): GoModule[] {
    const modules: GoModule[] = [];
    for (const p of [...fs.readdirSync(dir), '.']) {
      const modFile = path.join(dir, p, 'go.mod');
      if (fs.existsSync(modFile)) {
        modules.push(this.parseModule(modFile));
      }
    }
    return modules;
  }

  private parseModule(modFile: string): GoModule {

    const version = this.extractVersion(path.dirname(modFile));
    const majorVersion = Number(version.split('.')[0]);

    // extract the module decleration (e.g 'module github.com/aws/constructs-go/constructs/v3')
    const match = fs.readFileSync(modFile).toString().match(/module (.*)/);
    if (!match || !match[1]) {
      throw new Error(`Unable to detected module declaration in ${modFile}`);
    }

    // e.g 'github.com/aws/constructs-go/constructs/v3'
    const cannonicalName = match[1];

    // e.g ['github.com', 'aws', 'constructs-go', 'constructs', 'v3']
    const cannonicalNameParts = cannonicalName.split('/');

    // e.g 'github.com/aws/constructs-go'
    const repoURL = cannonicalNameParts.slice(0, 3).join('/');

    // e.g 'v3'
    const majorVersionSuffix = majorVersion > 1 ? `/v${majorVersion}` : '';

    if (!cannonicalName.endsWith(majorVersionSuffix)) {
      throw new Error(`Module declaration in '${modFile}' expected to end with '${majorVersionSuffix}' since its major version is larger than 1`);
    }

    if (!repoURL.startsWith('github.com')) {
      if (!(git.detectSSH() || git.detectGHE())) {
        throw new Error(`Repository must be hosted on github.com. Found: '${repoURL}' in ${modFile}`);
      }
    }
    let repoPath = cannonicalNameParts
      .slice(3) // e.g ['constructs', 'v3']
      .join('/'); // e.g 'constructs/v3'

    // we could have something like
    // constructs/v3
    // or something like
    // constructsv3/v3
    // we only want to strip the last 'v3'
    const split = repoPath.split('/');
    if (split[split.length - 1] === `v${majorVersion}`) {
      split.pop();
      repoPath = split.join('/');
    }

    // strip '/' if exists (wont exist for top level modules)
    repoPath = repoPath.endsWith('/') ? repoPath.substr(0, repoPath.length - 1) : repoPath;

    return { modFile, version, cannonicalName, repoPath, repoURL };

  }

  private buildTagName(m: GoModule) {
    return m.repoPath === '' ? `v${m.version}` : `${m.repoPath}/v${m.version}`;
  }

  private buildReleaseMessage(modules: GoModule[]) {
    const semantic = 'chore(release)';
    const versions = new Set(modules.map(m => m.version));
    if (versions.size === 1) {
      // single version (e.g chore(release): v1.2.3)
      return `${semantic}: v${versions.values().next().value}`;
    } else {
      // multiple versions (e.g chore(release): chore(release): module1@v1.2.3  module2@v1.2.3)
      return `${semantic}: ${modules.map(m => `${m.repoPath ? `${m.repoPath}@` : ''}v${m.version}`).join(' ')}`;
    }
  }

  private syncRepo(repoDir: string) {
    const topLevel = path.join(repoDir, 'go.mod');
    if (fs.existsSync(topLevel)) {
      // with top level modules we sync the entire repository
      // so we just empty it out
      fs.readdirSync(repoDir)
        .filter(f => f !== '.git')
        .forEach(f => git.rm(path.join(repoDir, f), { recursive: true }));
    } else {
      // otherwise, we selectively remove the submodules only.
      for (const p of fs.readdirSync(repoDir)) {
        const submodule = path.join(repoDir, p, 'go.mod');
        if (fs.existsSync(submodule)) {
          git.rm(path.join(repoDir, p), { recursive: true });
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
    return repos.values().next().value!;
  }

  private extractVersion(moduleDirectory: string): string {

    const versionFile = path.join(moduleDirectory, 'version');

    const repoVersion = this.version;
    const moduleVersion = fs.existsSync(versionFile) ? fs.readFileSync(versionFile).toString() : undefined;

    if (repoVersion && moduleVersion && repoVersion !== moduleVersion) {
      throw new Error(`Repo version (${repoVersion}) conflicts with module version (${moduleVersion}) for module in ${moduleDirectory}`);
    }

    // just take the one thats defined, they have to the same if both are.
    const version = moduleVersion ? moduleVersion : repoVersion;

    if (!version) {
      throw new Error(`Unable to determine version of module ${moduleDirectory}. `
        + "Either include a 'version' file, or specify a global version using the VERSION environment variable.");
    }

    return version;

  }

}
