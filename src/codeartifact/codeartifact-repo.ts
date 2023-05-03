import { AssociateExternalConnectionCommand, CodeartifactClient, CreateDomainCommand, CreateRepositoryCommand, DeleteRepositoryCommand, DescribeDomainCommand, DescribeRepositoryCommand, GetAuthorizationTokenCommand, GetRepositoryEndpointCommand, ListPackagesCommand, ListPackagesCommandInput, ListRepositoriesCommand, ListTagsForResourceCommand, PutPackageOriginConfigurationCommand, ResourceNotFoundException } from '@aws-sdk/client-codeartifact';
import { AwsCredentialIdentityProvider, Command, MetadataBearer } from '@aws-sdk/types';
import { sleep } from '../help/sleep';

const COLLECT_BY_TAG = 'collect-by';
const REPO_LIFETIME_MS = 24 * 3600 * 1000; // One day

export interface CodeArtifactRepoOptions {
  readonly credentials?: AwsCredentialIdentityProvider;
}

/**
 * A CodeArtifact repository
 */
export class CodeArtifactRepo {
  public static readonly DEFAULT_DOMAIN = 'publib-ca';

  /**
   * Create a CodeArtifact repo with a random name
   */
  public static async createRandom(options: CodeArtifactRepoOptions = {}) {
    const qualifier = Math.random().toString(36).replace(/[^a-z0-9]+/g, '');

    const repo = new CodeArtifactRepo(`test-${qualifier}`, options);
    await repo.create();
    return repo;
  }

  /**
   * Create a CodeArtifact repository with a given name
   */
  public static async createWithName(name: string, options: CodeArtifactRepoOptions = {}) {
    const repo = new CodeArtifactRepo(name, options);
    await repo.create();
    return repo;
  }

  /**
   * Reference an existing CodeArtifact repository
   */
  public static existing(repositoryName: string, options: CodeArtifactRepoOptions = {}) {
    return new CodeArtifactRepo(repositoryName, options);
  }

  /**
   * Garbage collect repositories
   */
  public static async gc(options: CodeArtifactRepoOptions = {}) {
    if (!await CodeArtifactRepo.existing('*dummy*').domainExists()) {
      return;
    }

    const codeArtifact = new CodeartifactClient({
      credentials: options.credentials,
    });

    let nextToken: string | undefined;
    do {
      const page = await retryThrottled(() => codeArtifact.send(new ListRepositoriesCommand({ nextToken })));

      for (const repo of page.repositories ?? []) {
        const tags = await retryThrottled(() => codeArtifact.send(new ListTagsForResourceCommand({ resourceArn: repo.arn! })));
        const collectable = tags?.tags?.find(t => t.key === COLLECT_BY_TAG && Number(t.value) < Date.now());
        if (collectable) {
          // eslint-disable-next-line no-console
          console.error('Deleting', repo.name);
          await retryThrottled(() => codeArtifact.send(new DeleteRepositoryCommand({
            domain: repo.domainName!,
            repository: repo.name!,
          })));
        }
      }

      nextToken = page.nextToken;
    } while (nextToken);
  }

  public readonly npmUpstream = 'npm-upstream';
  public readonly pypiUpstream = 'pypi-upstream';
  public readonly nugetUpstream = 'nuget-upstream';
  public readonly mavenUpstream = 'maven-upstream';
  public readonly domain = CodeArtifactRepo.DEFAULT_DOMAIN;

  private readonly codeArtifact;

  private _loginInformation: LoginInformation | undefined;

  private constructor(
    public readonly repositoryName: string,
    options: CodeArtifactRepoOptions = {},
  ) {
    this.codeArtifact = new CodeartifactClient({ credentials: options.credentials });
  }

  /**
   * Create the repository
   */
  public async create() {
    await this.ensureDomain();
    await this.ensureUpstreams();

    await this.ensureRepository(this.repositoryName, {
      description: 'Testing repository',
      upstreams: [
        this.npmUpstream,
        this.pypiUpstream,
        this.nugetUpstream,
        this.mavenUpstream,
      ],
      tags: {
        [COLLECT_BY_TAG]: `${Date.now() + REPO_LIFETIME_MS}`,
      },
    });
  }

  /**
   * Absorb old login information
   */
  public setLoginInformation(loginInfo: LoginInformation) {
    if (loginInfo.repositoryName !== this.repositoryName) {
      throw new Error(`This login info seems to be for a different repo. '${this.repositoryName}' != '${loginInfo.repositoryName}'`);
    }
    this._loginInformation = loginInfo;
  }

  public async login(): Promise<LoginInformation> {
    if (this._loginInformation) {
      return this._loginInformation;
    }

    const durationSeconds = 12 * 3600;
    const authToken = await this.send(new GetAuthorizationTokenCommand({ domain: this.domain, durationSeconds }));

    this._loginInformation = {
      // eslint-disable-next-line max-len
      authToken: authToken.authorizationToken!,
      expirationTimeMs: authToken.expiration?.getTime() ?? (Date.now() + durationSeconds * 1000),
      repositoryName: this.repositoryName,
      npmEndpoint: (await this.send(new GetRepositoryEndpointCommand({ domain: this.domain, repository: this.repositoryName, format: 'npm' }))).repositoryEndpoint!,
      mavenEndpoint: (await this.send(new GetRepositoryEndpointCommand({ domain: this.domain, repository: this.repositoryName, format: 'maven' }))).repositoryEndpoint!,
      nugetEndpoint: (await this.send(new GetRepositoryEndpointCommand({ domain: this.domain, repository: this.repositoryName, format: 'nuget' }))).repositoryEndpoint!,
      pypiEndpoint: (await this.send(new GetRepositoryEndpointCommand({ domain: this.domain, repository: this.repositoryName, format: 'pypi' }))).repositoryEndpoint!,
    };
    return this._loginInformation;
  }

  public async delete() {
    try {
      await this.send(new DeleteRepositoryCommand({
        domain: this.domain,
        repository: this.repositoryName,
      }));

      // eslint-disable-next-line no-console
      console.error('Deleted', this.repositoryName);
    } catch (e: any) {
      if (!isResourceNotFoundException(e)) { throw e; }
      // Okay
    }
  }

  /**
   * List all packages and mark them as "allow upstream versions".
   *
   * If we don't do this and we publish `foo@2.3.4-rc.0`, then we can't
   * download `foo@2.3.0` anymore because by default CodeArtifact will
   * block different versions from the same package.
   */
  public async markAllUpstreamAllow() {
    for await (const pkg of this.listPackages({ upstream: 'BLOCK' })) {
      await this.send(new PutPackageOriginConfigurationCommand({
        domain: this.domain,
        repository: this.repositoryName,

        format: pkg.format!,
        package: pkg.package!,
        namespace: pkg.namespace!,
        restrictions: {
          publish: 'ALLOW',
          upstream: 'ALLOW',
        },
      }));
    }
  }

  private async ensureDomain() {
    if (await this.domainExists()) { return; }
    await this.send(new CreateDomainCommand({
      domain: this.domain,
      tags: [{ key: 'testing', value: 'true' }],
    }));
  }

  private async ensureUpstreams() {
    await this.ensureRepository(this.npmUpstream, {
      description: 'The upstream repository for NPM',
      external: 'public:npmjs',
    });
    await this.ensureRepository(this.mavenUpstream, {
      description: 'The upstream repository for Maven',
      external: 'public:maven-central',
    });
    await this.ensureRepository(this.nugetUpstream, {
      description: 'The upstream repository for NuGet',
      external: 'public:nuget-org',
    });
    await this.ensureRepository(this.pypiUpstream, {
      description: 'The upstream repository for PyPI',
      external: 'public:pypi',
    });
  }

  private async ensureRepository(name: string, options?: {
    readonly description?: string;
    readonly external?: string;
    readonly upstreams?: string[];
    readonly tags?: Record<string, string>;
  }) {
    if (await this.repositoryExists(name)) { return; }

    await this.send(new CreateRepositoryCommand({
      domain: this.domain,
      repository: name,
      description: options?.description,
      upstreams: options?.upstreams?.map(repositoryName => ({ repositoryName })),
      tags: options?.tags ? Object.entries(options.tags).map(([key, value]) => ({ key, value })) : undefined,
    }));

    if (options?.external) {
      const externalConnection = options.external;
      await retry(() => this.send(new AssociateExternalConnectionCommand({
        domain: this.domain,
        repository: name,
        externalConnection,
      })));
    }
  }

  private async domainExists() {
    try {
      await this.send(new DescribeDomainCommand({ domain: this.domain }));
      return true;
    } catch (e: any) {
      if (!isResourceNotFoundException(e)) { throw e; }
      return false;
    }
  }

  private async repositoryExists(name: string) {
    try {
      await this.send(new DescribeRepositoryCommand({ domain: this.domain, repository: name }));
      return true;
    } catch (e: any) {
      if (!isResourceNotFoundException(e)) { throw e; }
      return false;
    }
  }

  private async* listPackages(filter: Pick<ListPackagesCommandInput, 'upstream'|'publish'|'format'> = {}) {
    let response = await this.send(new ListPackagesCommand({
      domain: this.domain,
      repository: this.repositoryName,
      ...filter,
    }));

    while (true) {
      for (const p of response.packages ?? []) {
        yield p;
      }

      if (!response.nextToken) {
        break;
      }

      response = await this.send(new ListPackagesCommand({
        domain: this.domain,
        repository: this.repositoryName,
        ...filter,
        nextToken: response.nextToken,
      }));
    }
  }

  // eslint-disable-next-line max-len
  private send<ClientInput extends object, InputType extends ClientInput, ClientOutput extends MetadataBearer, OutputType extends ClientOutput>(command: Command<ClientInput, InputType, ClientOutput, OutputType, any>): Promise<OutputType> {
    return retryThrottled(() => this.codeArtifact.send(command as any));
  }
}

async function retry<A>(block: () => Promise<A>) {
  let attempts = 3;
  while (true) {
    try {
      return await block();
    } catch (e: any) {
      if (attempts-- === 0) { throw e; }
      // eslint-disable-next-line no-console
      console.debug(e.message);
      await sleep(500);
    }
  }
}

async function retryThrottled<A>(block: () => Promise<A>) {
  let time = 100;
  let attempts = 15;
  while (true) {
    try {
      return await block();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.debug(e.message);
      if (e.code !== 'ThrottlingException') { throw e; }
      if (attempts-- === 0) { throw e; }
      await sleep(Math.floor(Math.random() * time));
      time *= 2;
    }
  }
}

export interface LoginInformation {
  readonly authToken: string;
  readonly expirationTimeMs: number;
  readonly repositoryName: string;
  readonly npmEndpoint: string;
  readonly mavenEndpoint: string;
  readonly nugetEndpoint: string;
  readonly pypiEndpoint: string;
}

function isResourceNotFoundException(x: any): x is ResourceNotFoundException {
  return x instanceof ResourceNotFoundException;
}