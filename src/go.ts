import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as shell from './shell';

export class GoRelease {

  constructor(public readonly branch: string, public readonly tags: string[], private readonly repoDir: string) {}

  public execute() {
    shell.run('git', ['push', 'origin', this.branch], { cwd: this.repoDir });
    this.tags.forEach(t => shell.run('git', ['push', 'origin', t], { cwd: this.repoDir }));
  }

  public dryRun() {
    console.log(`Will push to branch: ${this.branch}`);
    this.tags.forEach(t => console.log(`Will push tag: ${t}`));
  }
}

export class GoReleaseArtifacts {
  
}

export class GoReleaser {

  private readonly version?: string;

  private readonly dir: string;
  private readonly dryRun: boolean;
  private readonly gitBranch: string;
  private readonly gitUsername: string;
  private readonly gitUseremail: string;
  private readonly gitCommitMessage: string;
  private readonly gitHubToken: string;

  private readonly modules: readonly string[];

  constructor(dir: string) {

    try {
      shell.which('git');
    } catch (err) {
      throw new Error('git must be available to run this releaser');
    }

    this.dir = dir;
    this.modules = this.collectModules(this.dir);

    this.dryRun = (process.env.DRY_RUN ?? 'false').toLowerCase() === 'true';
    this.version = process.env.VERSION;
    this.gitBranch = process.env.GIT_BRANCH ?? 'main';
    this.gitUsername = process.env.GIT_USER_NAME ?? shell.run('git', ['config', 'user.name']);
    this.gitUseremail = process.env.GIT_USER_EMAIL ?? shell.run('git', ['config', 'user.email']);
    this.gitCommitMessage = process.env.GIT_COMMIT_MESSAGE ?? this.createReleaseMessage(this.modules);

    const gitHubToken = process.env.GITHUB_TOKEN;

    if (!gitHubToken) {
      throw new Error('GITHUB_TOKEN env variable is required');
    }

    if (this.gitUseremail === '') {
      throw new Error('Unable to detect username. either configure a global git user.name or pass GIT_USER_NAME env variable');
    }

    if (this.gitUsername === '') {
      throw new Error('Unable to detect user email. either configure a global git user.email or pass GIT_USER_EMAIL env variable');
    }

    this.gitHubToken = gitHubToken;

  }

  public release(): GoRelease {

    const repo = this.extractRepo();

    const repoDir = path.join(fs.mkdtempSync(os.tmpdir()), path.basename(repo));

    shell.gitClone(repo, this.gitHubToken, repoDir);
    shell.run('git', ['config', 'user.name', this.gitUsername], { cwd: repoDir });
    shell.run('git', ['config', 'user.email', this.gitUseremail], { cwd: repoDir });

    try {
      shell.run('git', ['checkout', this.gitBranch]);
    } catch (err) {
      shell.run('git', ['checkout', '-b', this.gitBranch], { shell: true });
    }

    this.syncModules(repoDir);

    try {
      shell.run('git', ['diff-index', '--exit-code', 'HEAD', '--'], { shell: true });
      console.log('No changes. Skipping');
      return new GoRelease(this.gitBranch, [], repoDir);
    } catch (err) {
      // changes exist, thats ok.
    }

    shell.run('git', ['commit', '-m', this.gitCommitMessage]);

    const tags = [];
    for (const module of this.modules) {
      tags.push(this.createTag(module));
    }

    const release = new GoRelease(this.gitBranch, tags, repoDir);

    if (this.dryRun) {
      release.dryRun();
    } else {
      release.execute();
    }

    return release;

  }

  private collectModules(dir: string): string[] {

    const modules = [];

    for (const p of fs.readdirSync(dir)) {
      const topLevel = path.join(dir, p);
      const stats = fs.lstatSync(topLevel);
      if (stats.isFile() && p == 'go.mod') {
        modules.push(topLevel);
      }
      const submodule = path.join(topLevel, 'go.mod');
      if (stats.isDirectory() && fs.existsSync(submodule)) {
        modules.push(submodule);
      }
    }

    if (modules.length === 0) {
      throw new Error(`No go modules detected in ${dir}`);
    }

    return modules;
  }

  private createTag(module: string): string {
    const moduleName = path.basename(module);
    const moduleVersion = this.extractVersion(module);

    let tagName = undefined;

    if (module === this.dir) {
      // root module
      tagName = `v${moduleVersion}`;
    } else {
      // sub module
      tagName = `${moduleName}/v${moduleVersion}`;
    }

    shell.run('git', ['tag', '-a', tagName, '-m', tagName]);
    return tagName;
  }

  private syncModules(repoDir: string) {

    const topLevel = path.join(repoDir, 'go.mod');

    if (fs.existsSync(topLevel)) {
      // with top level modules we sync the entire repository
      fs.rmdirSync(repoDir);
      fs.mkdirSync(repoDir);
    } else {
      // otherwise, we selectively remove the submodules only.
      for (const p of fs.readdirSync(repoDir)) {
        const submodule = path.join(repoDir, p, 'go.mod');
        if (fs.existsSync(submodule)) {
          fs.rmdirSync(submodule);
        }
      }
    }

    shell.run('cp', ['-r', `${this.dir}/*`, repoDir], { shell: true });
  }

  private createReleaseMessage(modules: readonly string[]) {

    let message = 'chore(release):';

    if (this.version) {
      return `${message} ${this.version}`;
    }

    for (const module of modules) {
      const moduleName = path.basename(module);
      const moduleVersion = this.extractVersion(module);
      message = `${message} ${moduleName}@${moduleVersion}`;
    }

    return message;
  }

  private extractVersion(module: string) {
    let moduleVersion = undefined;
    const versionFile = path.join(path.dirname(module), 'version');
    if (this.version) {
      moduleVersion = this.version;
    } else if (fs.existsSync(versionFile)) {
      moduleVersion = fs.readFileSync(versionFile);
    } else {
      throw new Error(`Unable to determine version of module ${module}. `
        + 'Either include a \'version\' file, or specify a global version using the VERSION environment variable.');
    }
    return moduleVersion;
  }

  private extractRepo(): string {
    const repos = new Set<string>();

    function findModuleDeclaration(_modFile: string) {
      for (const line of fs.readFileSync(_modFile).toString().split('\n')) {
        if (line.startsWith('module ')) {
          return line.split(' ')[1];
        }
      }
      throw new Error(`No module declaration in file: ${_modFile}`);
    }

    for (const module of this.modules) {
      const modFile = path.join(path.dirname(module), 'go.mod');
      const fullModuleName = findModuleDeclaration(modFile);
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

}