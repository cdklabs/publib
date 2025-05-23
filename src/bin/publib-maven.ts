/**
 * Legacy vs compatibility endpoint
 * ==================================
 *
 * This script talks about legacy vs compatibility endpoint a bunch.
 *
 * Both implement the Nexus 2 protocol, however:
 *
 * - The "legacy" endpoint is the Sonatype OSSRH endpoint that was deprecated June 2025.
 * - The "compatibility" endpoint is a Nexus 2-compatible endpoint stood up for the new
 *   publishing service, Central Publishing.
 *
 * It should be the same protocol but of course there are subtle differences
 * between them (in how they signal error when you try to republish an already
 * published version, and even in the wire protocol accepted) so we have to
 * treat them differently here.
 *
 * There is also an "official new" protocol for the new publishing mechanism,
 * but the Maven plugin they supply for that doesn't support that. In their words:
 *
 * > it appears that you are using the "two stage"[1] deployment process, which is
 * > not yet supported by the new plugin. You are the first publisher to have
 * > requested this, so we were not familiar with this specific usecase when
 * > building the new plugin
 * > [1] <https://github.com/sonatype/nexus-maven-plugins/blob/43a9940b134c3f87ebe4daa82552e844d9c578b8/staging/maven-plugin/WORKFLOWS.md#two-shots>
 */
import { promises as fs } from 'fs';
import { $, cd, echo, glob, os, path, ProcessOutput, quote, tmpdir } from 'zx';

const LEGACY_OSSRH_SERVER_ID = 'ossrh';
const COMPAT_CENTRAL_SERVER_ID = 'central-ossrh';

const NEXUS_MAVEN_STAGING_PLUGIN = 'org.sonatype.plugins:nexus-staging-maven-plugin:1.7.0';

async function main() {
  const args = process.argv.slice(2);
  const javaRoot = args[0] ?? 'dist/java';

  cd(javaRoot);

  const poms = await glob('**/*.pom');
  if (poms.length === 0) {
    throw new SimpleError(`No JARS to publish: no .pom files found under ${process.cwd()}`);
  }

  echo(`POMs found: ${poms}`);

  const sharedOptions: SharedPublishOptions = {
    username: envVar('MAVEN_USERNAME'),
    password: envVar('MAVEN_PASSWORD'),
    dryRun: process.env.MAVEN_DRYRUN === 'true',
    verbose: process.env.MAVEN_VERBOSE === 'true',
    poms,
  };

  let options: MavenPublishOptions;
  const serverId = process.env.MAVEN_SERVER_ID ?? LEGACY_OSSRH_SERVER_ID;

  switch (serverId) {
    case LEGACY_OSSRH_SERVER_ID:
      options = {
        type: 'legacy-ossrh',
        ...sharedOptions,
        stagingProfileId: envVar('MAVEN_STAGING_PROFILE_ID'),
        endpoint: process.env.MAVEN_ENDPOINT,
        privateKey: parsePrivateKeyFromEnv(),
      };
      break;
    case COMPAT_CENTRAL_SERVER_ID:
      options = {
        type: 'compat-ossrh',
        ...sharedOptions,
        stagingProfileId: envVar('MAVEN_STAGING_PROFILE_ID'),
        endpoint: process.env.MAVEN_ENDPOINT,
        privateKey: parsePrivateKeyFromEnv(),
      };
      break;
    default:
      // We haven't implemented signing for this, so fail loudly if people try to use it anyway
      if (process.env.MAVEN_GPG_PRIVATE_KEY || process.env.MAVEN_GPG_PRIVATE_KEY_FILE) {
        throw new SimpleError('MAVEN_GPG_PRIVATE_KEY[_FILE] is only supported for OSSRH publishing');
      }

      options = {
        type: 'custom-nexus',
        ...sharedOptions,
        serverId,
        repositoryUrl: envVar('MAVEN_REPOSITORY_URL'),
      };
      break;
  }

  await mavenPublish(options);

  echo('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  echo('✅ All Done!');
}

function parsePrivateKeyFromEnv(): PrivateKey {
  if (process.env.MAVEN_GPG_PRIVATE_KEY_FILE) {
    return { type: 'file', fileName: process.env.MAVEN_GPG_PRIVATE_KEY_FILE, passPhrase: envVar('MAVEN_GPG_PRIVATE_KEY_PASSPHRASE') };
  }
  if (process.env.MAVEN_GPG_PRIVATE_KEY) {
    return { type: 'material', keyMaterial: process.env.MAVEN_GPG_PRIVATE_KEY, passPhrase: envVar('MAVEN_GPG_PRIVATE_KEY_PASSPHRASE') };
  }
  throw new SimpleError('MAVEN_GPG_PRIVATE_KEY[_FILE] is required');
}

//----------------------------------------------------------------------
//  Modeling all the parameters so that we can pull the environment parsing forward
//

interface SharedPublishOptions {
  readonly username: string;
  readonly password: string;
  readonly dryRun: boolean;
  readonly verbose: boolean;
  readonly poms: string[];
}

interface LegacyOssrhPublishOptions extends SharedPublishOptions {
  type: 'legacy-ossrh';
  readonly privateKey: PrivateKey;
  readonly endpoint?: string;
  readonly stagingProfileId: string;
}

interface CompatOssrhPublishOptions extends SharedPublishOptions {
  type: 'compat-ossrh';
  readonly privateKey: PrivateKey;
  readonly endpoint?: string;
  readonly stagingProfileId: string;
}

interface CustomNexusPublishOptions extends SharedPublishOptions {
  type: 'custom-nexus';
  readonly repositoryUrl: string;
  readonly serverId: string;
}

type PrivateKey =
  | { type: 'file'; fileName: string; passPhrase: string }
  | { type: 'material'; keyMaterial: string; passPhrase: string }
  ;

type MavenPublishOptions = LegacyOssrhPublishOptions | CompatOssrhPublishOptions| CustomNexusPublishOptions;

//----------------------------------------------------------------------
//  Publishing functions
//

async function mavenPublish(options: MavenPublishOptions) {
  await using workDir = autoCleanDir();
  const maven = new Maven(workDir.dir, options.verbose, options.dryRun);

  const x = options.type;
  switch (x) {
    case 'legacy-ossrh':
      await deployLegacyOssrh(maven, options);
      break;
    case 'compat-ossrh':
      await deployCompatOssrh(maven, options);
      break;
    case 'custom-nexus':
      await deployCustomNexus(maven, options);
      break;
    default:
      assertNever(x);
  }
}

/**
 * Deploy to the legacy OSSRH Nexus server
 */
async function deployLegacyOssrh(maven: Maven, options: LegacyOssrhPublishOptions) {
  echo('📦 Publishing to Maven Central');
  const defaultEndpoint = 'https://oss.sonatype.org';

  const staged = await deployStagedRepository(maven, {
    ...options,
    endpoint: options.endpoint ?? defaultEndpoint,
    republishWill400: false,
  });

  if (staged.type !== 'success') {
    return;
  }

  /*
  const released = await releaseRepo({
    serverUrl: options.endpoint ?? defaultEndpoint,
    username: options.username,
    password: options.password,
    repositoryId: staged.repositoryId,
  });

  if (released) {
    return;
  }
  */

  // Send a remote release command to the repository
  const releaseOutput = await maven.exec(`${NEXUS_MAVEN_STAGING_PLUGIN}:rc-release`, {
    properties: {
      nexusUrl: options.endpoint ?? defaultEndpoint,
      serverId: staged.serverId,
      stagingRepositoryId: staged.repositoryId,
    },
    nothrow: true,
  });
  if (!releaseOutput) {
    echo('🏜️ Stopped here because of dry-run');
    return;
  }

  if (releaseOutput.exitCode !== 0) {
    // If release failed, check if this was caused because we are trying to publish
    // the same version again, which is not an error. The magic string "does not
    // allow updating artifact" for a ".pom" file indicates that we are trying to
    // override an existing version. Otherwise, fail!

    const looksLikeDuplicatePublish = releaseOutput.lines()
      .filter(l => l.includes('does not allow updating artifact'))
      .filter(l => l.includes('.pom'))
      .length > 0;

    if (!looksLikeDuplicatePublish) {
      throw new SimpleError('Release failed');
    }

    echo('⚠️ Artifact already published. Skipping');
  }
}

/**
 * Deploy to the compat OSSRH Nexus server
 */
async function deployCompatOssrh(maven: Maven, options: CompatOssrhPublishOptions) {
  echo('📦 Publishing to Maven Central (Compat endpoint)');

  const defaultEndpoint = 'https://ossrh-staging-api.central.sonatype.com/';
  const endpoint = options.endpoint ?? defaultEndpoint;

  const staged = await deployStagedRepository(maven, {
    ...options,
    endpoint,
    republishWill400: true,
  });

  if (staged.type !== 'success') {
    return;
  }

  const released = await releaseRepo({
    serverUrl: endpoint,
    username: options.username,
    password: options.password,
    repositoryId: staged.repositoryId,
  });

  if (released === 'duplicate-version') {
    echo('⚠️ Version(s) already published. Skipping');
  }
}

/**
 * Deploy to a custom Nexus server
 */
async function deployCustomNexus(maven: Maven, options: CustomNexusPublishOptions) {
  echo(`📦 Publishing to ${options.serverId}`);
  await maven.writeSettingsFile(options.serverId, false);

  for (const pom of options.poms) {
    const deployOutput = await maven.exec('deploy:deploy-file', {
      properties: {
        url: options.repositoryUrl,
        repositoryId: options.serverId,
        pomFile: pom,
        ...jarsFromPom(pom),
      },
      nothrow: true,
    });

    if (deployOutput?.exitCode && deployOutput.exitCode > 0) {
      if (deployOutput.stdout.includes('409 Conflict')) {
        echo('⚠️ Artifact already published. Skipping');
      } else {
        throw new SimpleError('Release failed');
      }
    }
  }
}

type DeployStagedRepoResult =
  | { type: 'success'; repositoryId: string; serverId: string }
  | { type: 'already-published' }
  | { type: 'dry-run' };

/**
 * Create the staging repository. This is the same between the legacy and compat endpoints.
 *
 * `republishWill400`: in the compatibility endpoint, staging a version that has already
 * been published will lead to a `400 Bad Request`, with no further info. We needed to have
 * run the Maven command with `--debug` logging to see the actual error message in the output.
 *
 * In the legacy endpoint, staging takes multiple minutes, and Maven will poll
 * every 3s and print the output. We therefore don't use verbose mode to avoid
 * stdout spam. In the legacy endpoint, duplicate version publishing gets
 * reported during the 'release' step anyway, not during staging.
 */
async function deployStagedRepository(maven: Maven, options: Omit<LegacyOssrhPublishOptions | CompatOssrhPublishOptions, 'endpoint'> & { endpoint: string; republishWill400: boolean }): Promise<DeployStagedRepoResult> {
  const serverId = 'ossrh';

  await maven.writeSettingsFile(serverId, true);

  // First -- sign artifacts
  const signedDir = path.join(maven.workDir, 'signed');
  await fs.mkdir(signedDir, { recursive: true });

  await signJars(maven, options.poms, signedDir, serverId, options.privateKey);

  echo('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  echo(' Deploying and closing repository...');
  echo('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');

  const nexusMavenStaging = 'org.sonatype.plugins:nexus-staging-maven-plugin:1.7.0';
  const stageOutput = await maven.exec(`${nexusMavenStaging}:deploy-staged-repository`, {
    properties: {
      repositoryDirectory: signedDir,
      nexusUrl: options.endpoint,
      serverId,
      stagingProgressTimeoutMinutes: '30',
      stagingProfileId: options.stagingProfileId,
    },
    nothrow: true,
    verbose: options.republishWill400,
  });
  // FIXME: New staging API throws an error here on duplicate versions
  if (stageOutput === undefined) {
    echo('🏜️ Stopped here because of dry-run');
    return { type: 'dry-run' };
  }

  if (options.republishWill400 && stageOutput.text().match(/Component with package url.*already exists/)) {
    // We've seen this fail with the above error message on the OSSRH compatibility API when trying to republish
    // an already-published version.
    //
    // This is potentially a problem if there are multiple versions in the source directory at once, because nothing
    // will be published if there's one package in there that has already been published previously. But c'est la vie.
    echo('⚠️ Version(s) already published. Skipping');
    return { type: 'already-published' };
  } else if (stageOutput.exitCode && stageOutput.exitCode > 0) {
    throw stageOutput;
  }

  // Grep the repository ID out of the printed output
  // [INFO]  * Closing staging repository with ID "XXXXXXXXXX".
  const m = stageOutput.stdout.match(/Closing staging repository with ID "([^"]+)"/);
  if (!m) {
    throw new SimpleError('Unable to extract repository ID from deploy-staged-repository output. This means it failed to close or there was an unexpected problem. At any rate, we can\'t release it. Sorry.');
  }
  const repositoryId = m[1];

  return { type: 'success', repositoryId, serverId };
}

/**
 * Send a custom "release" command to the new Sonatype backwards compatibility endpoint
 *
 * When using the `nexus-staging-maven-plugin`'s `release` or `rc-release` commands, we get the following
 * error:
 *
 * Sending:
 *
 * ```
 * <stagingActionRequest><data><stagedRepositoryIds class="java.util.Arrays$ArrayList"><a class="string-array"><string>io.github.rix0rrr--63edbcbe-f058-44eb-85f4-fd9dce1aef40</string></a></stagedRepositoryIds><description>unknown</description><autoDropAfterRelease>true</autoDropAfterRelease></data></stagingActionRequest>
 * ```
 *
 * Error:
 *
 * ```
 * Failed to process request: Got unexpected XML element when reading stagedRepositoryIds: Got unexpected element StartElement(a, {"": "", "xml": "http://www.w3.org/XML/1998/namespace", "xmlns": "http://www.w3.org/2000/xmlns/"}, [class -> string-array]), expected one of: string
 * ```
 *
 * Doing a manual slightly modified version of the above request succeeds, so we'll just proceed with doing
 * that.
 *
 * The endpoint also supports JSON, which we prefer over XML.
 *
 * This endpoint will never return an error, even if the publish didn't happen because
 * of duplicate version publishing (not for the legacy, nor for the compatibility endpoint).
 *
 * @see https://central.sonatype.org/publish/publish-portal-ossrh-staging-api/
 * @see https://support.sonatype.com/hc/en-us/articles/213465448-Automatically-dropping-old-staging-repositories
 */
async function releaseRepo(options: { serverUrl: string; username: string; password: string; repositoryId: string; description?: string }): Promise<'ok' | 'duplicate-version'> {
  echo(`🚀 Releasing repository ${options.repositoryId} at ${options.serverUrl}`);
  const url = new URL('service/local/staging/bulk/promote', options.serverUrl);

  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        stagedRepositoryIds: [options.repositoryId],
        description: options.description ?? 'Deployment',
        autoDropAfterRelease: true,
      },
    }),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Basic ${btoa(`${options.username}:${options.password}`)}`,
    },
  });

  const body = await response.text();

  // It's possible that (due to some replication latency?) the initial "stage" succeeds,
  // but the "release" fails, if we try to publish an already-published version again.
  //
  // Unfortunately there is no great error code to detect this right now, but I've observed
  // this error when it happened.
  // I have a support request out to Sonatype for this, we'll see if this changes over time.
  if (response.status === 400 && body === 'Failed to process request: service error') {
    return 'duplicate-version';
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${body}`);
  }

  console.log(body);

  return 'ok';
}

/**
 * Sign and stage our artifacts into a local directory
 */
async function signJars(maven: Maven, poms: string[], targetDir: string, serverId: string, key: PrivateKey) {
  await using gpg = await importGpgKey(key);

  // on a mac, --pinentry-mode to "loopback" are required and I couldn't find a
  // way to do so via -Dgpg.gpgArguments or the settings file, so here we are.
  let gpgBin = 'gpg';
  if (os.platform() === 'darwin') {
    gpgBin = path.join(maven.workDir, 'publib-gpg.sh');
    await fs.writeFile(gpgBin, [
      '#!/bin/bash',
      'exec gpg --pinentry-mode loopback "\$@"',
    ].join('\n'), 'utf-8');
    await $`chmod +x ${gpgBin}`;
  }

  for (const pom of poms) {
    await maven.exec('gpg:sign-and-deploy-file', {
      properties: {
        'url': `file://${targetDir}`,
        'repositoryId': serverId, // Most likely not necessary
        'gpg.homedir': gpg.home,
        'gpg.keyname': gpg.keyId,
        'gpg.executable': gpgBin,
        'pomFile': pom,
        ...jarsFromPom(pom),
      },
    });
  }
}

/**
 * Based on the path of a .pom file, return the paths of the corresponding jars
 */
function jarsFromPom(pom: string) {
  return {
    file: pom.replace(/\.pom$/, '.jar'),
    sources: pom.replace(/\.pom$/, '-sources.jar'),
    javadoc: pom.replace(/\.pom$/, '-javadoc.jar'),
  };
}

/**
 * Create a temporary directory and import the GPG key material into a new keychain there
 */
async function importGpgKey(key: PrivateKey) {
  // GnuPG will occasionally bail out with "gpg: <whatever> failed: Inappropriate ioctl for device", the following attempts to fix
  const gpgHome = autoCleanDir();
  try {
    const tty = (await $({ stdio: ['inherit', 'pipe', 'pipe'] })`tty`).stdout;

    let privateKeyFile;
    const type = key.type;
    switch (type) {
      case 'file':
        privateKeyFile = key.fileName;
        break;
      case 'material':
        privateKeyFile = path.join(gpgHome.dir, 'private.pem');
        await $`echo -e ${key.keyMaterial} > ${privateKeyFile}`;
        break;
      default:
        assertNever(type);
    }

    const env = {
      GNUPGHOME: gpgHome.dir,
      GPG_TTY: tty,
    };

    const $$ = $({ env: { ...process.env, ...env } });

    await $$`gpg --allow-secret-key-import --batch --yes --no-tty --import ${privateKeyFile}`;
    const gpgKeyId = (await $$`gpg --list-keys --with-colons | grep pub | cut -d: -f5`).stdout.trim();

    echo(`gpg_key_id=${gpgKeyId}`);

    return {
      keyId: gpgKeyId,
      env,
      home: gpgHome.dir,
      [Symbol.asyncDispose]: async () => gpgHome[Symbol.asyncDispose](),
    };
  } catch (e) {
    await gpgHome[Symbol.asyncDispose]();
    throw e;
  }
}

class Maven {
  private readonly settingsFile: string;

  constructor(public readonly workDir: string, private readonly verbose: boolean, public readonly dryRun: boolean) {
    this.settingsFile = path.join(workDir, 'mvn-settings.xml');
  }

  /**
   * Create a settings.xml file with the user+password for maven
   */
  public async writeSettingsFile(serverId: string, signedArtifacts: boolean) {
    const lines = [];

    lines.push(
      '<?xml version="1.0" encoding="UTF-8" ?>',
      '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"',
      '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      '        xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0',
      '                            http://maven.apache.org/xsd/settings-1.0.0.xsd">',
      '  <servers>',
      '    <server>',
      `      <id>${serverId}</id>`,
      // Maven will read these, surrounding code has already made sure they are set
      '      <username>${env.MAVEN_USERNAME}</username>',
      '      <password>${env.MAVEN_PASSWORD}</password>',
      '    </server>',
    );

    if (signedArtifacts) {
      lines.push(
        '    <server>',
        '      <id>gpg.passphrase</id>',
        // Maven will read these, surrounding code has already made sure they are set
        '      <passphrase>${env.MAVEN_GPG_PRIVATE_KEY_PASSPHRASE}</passphrase>',
        '    </server>',
      );
    }

    lines.push(
      '  </servers>',
      '</settings>',
    );

    await fs.writeFile(this.settingsFile, lines.join('\n'), 'utf-8');
  }

  public async exec(mojo: string, options: MavenExecOptions): Promise<ProcessOutput | undefined> {
    const args = [
      `--settings=${this.settingsFile}`,
      ...(options.verbose ?? this.verbose ? ['-X'] : []),
      mojo,
      ...Object.entries(options.properties).map(([k, v]) => `-D${k}=${v}`),
    ];

    if (this.dryRun) {
      echo(`[DRY-RUN] mvn ${args.map(quote).join(' ')}`);
      return undefined;
    }
    const env = {
      ...process.env,
      MAVEN_OPTS: [
        ...process.env.MAVEN_OPTS ? [process.env.MAVEN_OPTS] : [],
        // If we don't add this, we'll get an error like the following during the nexus-staging-maven-plugin:rc-release mojo.
        // Don't know where this is coming from all of a sudden.
        //
        // [ERROR] message             : No converter available
        // [ERROR] type                : java.util.Arrays$ArrayList
        // [ERROR] converter           : com.thoughtworks.xstream.converters.reflection.ReflectionConverter
        // [ERROR] message[1]          : Unable to make field protected transient int java.util.AbstractList.modCount accessible: module java.base does not "opens java.util" to unnamed module @7c8d5312
        '--add-opens=java.base/java.util=ALL-UNNAMED',
        '--add-opens=java.base/java.lang=ALL-UNNAMED',
        '--add-opens=java.base/java.lang.invoke=ALL-UNNAMED',
      ].join(' '),
    };

    return $({ verbose: true, nothrow: options.nothrow, env })`mvn ${args}`;
  }
}

interface MavenExecOptions {
  properties: Record<string, string>;
  nothrow?: boolean;
  verbose?: boolean;
}

/**
 * A expected error that doesn't need a stack trace
 */
class SimpleError extends Error { }

/**
 * Require an environment variable
 */
function envVar(name: string): string {
  const ret = process.env[name];
  if (!ret) {
    throw new SimpleError(`${name} is required`);
  }
  return ret;
}

/**
 * A temporary directory that cleans when it goes out of scope
 *
 * Use with `using`. Could have been async but it's depending
 * on an already-sync API, so why not sync?
 */
export function autoCleanDir() {
  const dir = tmpdir();
  return {
    dir,
    [Symbol.asyncDispose]: async () => {
      await fs.rm(dir, { force: true, recursive: true });
    },
  };
}

function assertNever(value: never) {
  throw new Error('Unexpected value: ' + value);
}

// A 'zx' primer
//
// - By default: stderr is printed to the terminal if it is captured.
// - { verbose: true }: print the command, stdout and stderr to the terminal
// - { quiet: true }: print neither stdout nor stderr
//
// .text(): return everything that's captured (stderr and stdout together if stderr is captured)

main().catch(e => {
  if (e instanceof ProcessOutput) {
    echo(`❌ Subprocess failed with exit code ${e.exitCode}`);
  } else if (e instanceof SimpleError) {
    echo('❌', e.message);
  } else {
    console.error(e);
  }
  process.exitCode = 1;
});
