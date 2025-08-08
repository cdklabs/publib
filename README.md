# publib

> Previously known as `jsii-release`

A unified toolchain for publishing libraries to popular package managers.

Supports:

* npm
* PyPI
* NuGet
* Maven
* Go (GitHub)

## Usage

This is an npm module. You can install it using `yarn add publib` or
`npm install publib`. In most cases it will be installed as a `devDependency`
in your `package.json`.

This tool expects to find a distribution directory (default name is `dist`)
which contains "ready-to-publish" artifacts for each package manager.

* `dist/js/*.tgz` - npm tarballs
* `dist/python/*.whl` - Python wheels
* `dist/nuget/*.nupkg` - Nuget packages
* `dist/java/**` - Maven artifacts in local repository structure
* `dist/go/**/go.mod` - Go modules. Each subdirectory should have its own go.mod file.

Each publisher needs a set of environment variables with credentials as
described below (`NPM_TOKEN`, `TWINE_PASSWORD` etc).

Then:

```shell
publib
```

You can customize the distribution directory through `publib DIR` (the
default is `dist`)

This command will discover all the artifacts based on the above structure and
will publish them to their respective package manager.

You can also execute individual publishers:

* `publib-maven`
* `publib-nuget`
* `publib-npm`
* `publib-pypi`
* `publib-golang`

## npm

Publishes all `*.tgz` files from `DIR` to [npmjs](npmjs.com), [GitHub Packages](https://github.com/features/packages) or [AWS CodeArtifact](https://aws.amazon.com/codeartifact/).

If AWS CodeArtifact is used as npm registry, a temporary npm authorization token is created using AWS CLI. Therefore, it is necessary to provide the necessary [configuration settings](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html), e.g. by passing access key ID and secret access key to this script.

**Usage:**

```shell
npx publib-npm [DIR]
```

`DIR` is a directory with npm tarballs (*.tgz). Default is `dist/js`.

**Options (environment variables):**

| Option                  | Required | Description                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NPM_TOKEN`             | Optional | Registry authentication token (either [npm.js publishing token](https://docs.npmjs.com/creating-and-viewing-authentication-tokens) or a [GitHub personal access token](https://help.github.com/en/packages/using-github-packages-with-your-projects-ecosystem/configuring-npm-for-use-with-github-packages#authenticating-to-github-packages)), not used for AWS CodeArtifact |
| `NPM_TRUSTED_PUBLISHER` | Optional | Use a [Trusted Publisher](https://docs.npmjs.com/trusted-publishers) configuration to publish packages. Requires npm CLI version 11.5.1 or later. When set, `NPM_TOKEN` will be ignored.                                                                                                                                                                                      |
| `NPM_REGISTRY`          | Optional | The registry URL (defaults to "registry.npmjs.org"). Use "npm.pkg.github.com" to publish to GitHub Packages. Use repository endpoint for AWS CodeAtifact, e.g. "my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo/".                                                                                                                                  |
| `NPM_DIST_TAG`          | Optional | Registers the published package with the given [dist-tag](https://docs.npmjs.com/cli/dist-tag) (e.g. `next`, default is `latest`)                                                                                                                                                                                                                                             |
| `NPM_ACCESS_LEVEL`      | Optional | Publishes the package with the given [access level](https://docs.npmjs.com/cli/v8/commands/npm-publish#access) (e.g. `public`, default is `restricted` for scoped packages and `public` for unscoped packages)                                                                                                                                                                |
| `AWS_ACCESS_KEY_ID`     | Optional | If AWS CodeArtifact is used as registry, an AWS access key can be spedified.                                                                                                                                                                                                                                                                                                  |
| `AWS_SECRET_ACCESS_KEY` | Optional | Secret access key that belongs to the AWS access key.                                                                                                                                                                                                                                                                                                                         |
| `AWS_ROLE_TO_ASSUME`    | Optional | If AWS CodeArtifact is used as registry, an AWS role ARN to assume before authorizing.                                                                                                                                                                                                                                                                                        |
| `DISABLE_HTTPS`         | Optional | Connect to the registry with HTTP instead of HTTPS (defaults to false).                                                                                                                                                                                                                                                                                                       |

## Maven

Publishes all Maven modules in the `DIR` to [Maven Central](https://search.maven.org/).

> [!IMPORTANT]
> Starting July 2025 you must switch over to the new Maven Central Publisher. Follow these steps:
>
> * Log in to <https://central.sonatype.com/> with your existing username and password.
> * Under your account, click **View Namespaces**, then click **Migrate Namespace** for your target namespaces.
> * Generate a new username and password on the new publisher using the **Generate User Token** feature.
> * Configure `MAVEN_SERVER_ID=central-ossrh`.
> * Unset any `MAVEN_ENDPOINT`.
> * Configure the new `MAVEN_USERNAME` and `MAVEN_PASSWORD`.

If you are still on Nexus and you signed up at SonaType after February 2021, you
need to use this URL: `https://s01.oss.sonatype.org`
([announcement](https://central.sonatype.org/news/20210223_new-users-on-s01/)).

**Usage:**

```shell
npx publib-maven [DIR]
```

`DIR` is a directory with a local maven layout. Default is `dist/java`.

**Options (environment variables):**

The server type is selected using the `MAVEN_SERVER_ID` variable.

* `MAVEN_SERVER_ID=ossrh`; this is currently the default but will stop working in July 2025. Publish to the old OSSRH Nexus server.
* `MAVEN_SERVER_ID=central-ossrh`; publish to the new Central Publishing platform using a service endpoint more-or-less compatible with the old OSSRH Nexus server. This is required to publish to Maven Central starting July 2025.
* `MAVEN_SERVER_ID=<anything else>`; publish to a custom Nexus server.

| Server               | Option                                                                | Required          | Description                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (all)                | `MAVEN_SERVER_ID`                                                     | Yes going forward | Either `ossrh` (default but deprecated), `central-ossrh`, or any other string for a custom Nexus server.                                                                                                                                                                                                                                                                  |
| (all)                | `MAVEN_USERNAME` and `MAVEN_PASSWORD`                                 | Yes               | Username and password for maven repository. For Maven Central, you will need to [Create JIRA account](https://issues.sonatype.org/secure/Signup!default.jspa) and then request a [new project](https://issues.sonatype.org/secure/CreateIssue.jspa?issuetype=21&pid=10134). Read the [OSSRH guide](https://central.sonatype.org/pages/ossrh-guide.html) for more details. |
| (all)                | `MAVEN_DRYRUN`                                                        | No                | Set to "true" for a dry run                                                                                                                                                                                                                                                                                                                                               |
| (all)                | `MAVEN_VERBOSE`                                                       | No                | Make Maven print debug output if set to `true`                                                                                                                                                                                                                                                                                                                            |
| `central-ossrh`      | `MAVEN_GPG_PRIVATE_KEY[_FILE]` and `MAVEN_GPG_PRIVATE_KEY_PASSPHRASE` | Yes               | GPG private key or file that includes it. This is used to sign your Maven packages. See instructions below                                                                                                                                                                                                                                                                |
| `central-ossrh`      | `MAVEN_ENDPOINT`                                                      | No                | URL of Nexus repository. Defaults to `https://ossrh-staging-api.central.sonatype.com/`.                                                                                                                                                                                                                                                                                   |
| `<custom>`           | `MAVEN_REPOSITORY_URL`                                                | No                | Deployment repository when not deploying to Maven Central                                                                                                                                                                                                                                                                                                                 |
| `ossrh` (deprecated) | `MAVEN_GPG_PRIVATE_KEY[_FILE]` and `MAVEN_GPG_PRIVATE_KEY_PASSPHRASE` | Yes               | GPG private key or file that includes it. This is used to sign your Maven packages. See instructions below                                                                                                                                                                                                                                                                |
| `ossrh` (deprecated) | `MAVEN_STAGING_PROFILE_ID`                                            | Yes               | Central Publisher (sonatype) staging profile ID, corresponding to namespace (e.g. `com.sonatype.software`).                                                                                                                                                                                                                                                               |
| `ossrh` (deprecated) | `MAVEN_ENDPOINT`                                                      | No                | URL of Nexus repository. Defaults to `https://central.sonatype.com`.                                                                                                                                                                                                                                                                                                      |

### How to create a GPG key

Install [GnuPG](https://gnupg.org/).

Generate your key:

```console
$ gpg --full-generate-key
# select RSA only, 4096, passphrase
```

Your selected passphrase goes to `MAVEN_GPG_PRIVATE_KEY_PASSPHRASE`.

Export and publish the public key:

```console
gpg -a --export > public.pem
```

Go to <https://keyserver.ubuntu.com/> and submit the public key.
You can use `cat public.pem` and copy/paste it into the "Submit Key" dialog.

Export the private key:

```console
gpg -a --export-secret-keys <fingerprint> > private.pem
```

Now, either set `MAVEN_GPG_PRIVATE_KEY_FILE` to point to `private.pem` or
export the private key to a single line where newlines are encoded as `\n`
and then assign it to `MAVEN_GPG_PRIVATE_KEY`:

```console
echo $(cat -e private.pem) | sed 's/\$ /\\n/g' | sed 's/\$$//'
```

**Publish to GitHub Packages**\
An example GitHub Actions publish step:

```yaml
- name: Publish package
  run: npx -p publib publib-maven
  env:
    MAVEN_SERVER_ID: github
    MAVEN_USERNAME: ${{ github.actor }}
    MAVEN_PASSWORD: ${{ secrets.GITHUB_TOKEN }}
    MAVEN_REPOSITORY_URL: "https://maven.pkg.github.com/${{ github.repository }}"
```

## NuGet

Publishes all `*.nupkg` to the [NuGet Gallery](https://www.nuget.org/).

**Usage:**

```shell
npx publib-nuget [DIR]
```

`DIR` is a directory with Nuget packages (*.nupkg). Default is `dist/dotnet`.

**Options (environment variables):**

| Option          | Required | Description                                                                    |
| --------------- | -------- | ------------------------------------------------------------------------------ |
| `NUGET_API_KEY` | Required | [NuGet API Key](https://www.nuget.org/account/apikeys) with "Push" permissions |
| `NUGET_SERVER`  | Optional | NuGet Server URL (defaults to nuget.org)                                       |

**Publish to GitHub Packages**\
You can publish to GitHub Packages instead, with the following options:

* Set `NUGET_SERVER` to `https://nuget.pkg.github.com/[org or user]`.
* Set `NUGET_API_KEY` to a token with write packages permissions.
* Make sure the repository url in the project file matches the org or user used for the server

## PyPI

Publishes all `*.whl` files to [PyPI](https://pypi.org/).

**Usage:**

```shell
npx publib-pypi [DIR]
```

`DIR` is a directory with Python wheels (*.whl). Default is `dist/python`.

**Options (environment variables):**

| Option                      | Required | Description                                                                                                                                                                        |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TWINE_USERNAME`            | Optional | PyPI username ([register](https://pypi.org/account/register/)). Not required when using Trusted Publishers.                                                                        |
| `TWINE_PASSWORD`            | Optional | PyPI password or API token. Not required when using Trusted Publishers.                                                                                                            |
| `TWINE_REPOSITORY`          | Optional | The repository to upload the package to. Defaults to `pypi`, set `testpypi` to publish to the testing index.                                                                       |
| `TWINE_REPOSITORY_URL`      | Optional | A custom repository URL, overrides `TWINE_REPOSITORY`.                                                                                                                             |
| `PYPI_TRUSTED_PUBLISHER`    | Optional | Set to any value to use PyPI [Trusted Publisher](https://docs.pypi.org/trusted-publishers/) authentication (OIDC). Requires a supported ambient identity (i.e. CI/CD environment). |
| `PYPI_DISABLE_ATTESTATIONS` | Optional | Set to any value to disable [PyPI attestations](https://docs.pypi.org/attestations/producing-attestations/) (enabled by default with Trusted Publishers).                          |

### Trusted Publishers and Attestations

PyPI [Trusted Publishers](https://docs.pypi.org/trusted-publishers/) allows publishing without API tokens by using OpenID Connect (OIDC) authentication between a trusted third-party service and PyPI.
Typically these are CI/CD providers like GitHub Actions or Gitlab CI/CD.
PyPI attestations provide cryptographic proof of package provenance and integrity and are **enabled by default when using Trusted Publishers**. Attestations are only available when using Trusted Publisher authentication.

**Trusted Publisher Setup:**

1. Configure your PyPI project to use a [Trusted Publisher](https://docs.pypi.org/trusted-publishers/adding-a-publisher/)
2. Set `PYPI_TRUSTED_PUBLISHER=1` in your workflow environment
3. No `TWINE_USERNAME` or `TWINE_PASSWORD` needed

**Requirements:**

* **GitHub Actions**: Your workflow must have `id-token: write` permission.
* **Gitlab CI/CD**: The keyword `id_tokens` is used to request an OIDC token from GitLab with name `PYPI_ID_TOKEN` and audience `pypi`.

## Golang

Pushes a directory of golang modules to a GitHub repository.

**Usage:**

```shell
npx publib-golang [DIR]
```

`DIR` is a directory where the golang modules are located (default is `dist/go`). Modules can be located either in subdirectories, (e.g 'dist/go/my-module/go.mod')
or in the root (e.g 'dist/go/go.mod').

If you specify the `VERSION` env variable, all modules will recieve that version, otherwise a `version` file is expected to exist in each module directory.
Repository tags will be in the following format:

* For a module located at the root: `v${module_version}` (e.g `v1.20.1`)
* For modules located inside subdirectories: `<subdir-name>/v${module_version}` (e.g `my-module/v3.3.1`)

**Options (environment variables):**

| Option                                                | Required                                         | Description                                                                                                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`                                        | Required when not in SSH mode, see `GIT_USE_SSH` | [GitHub personal access token.](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token)                                                                                                                         |
| `GIT_USE_SSH`                                         | Optional                                         | Set to a non-falsy value to use SSH with [deploy keys](https://docs.github.com/en/developers/overview/managing-deploy-keys#deploy-keys) or your private SSH key. Your system must ready to use the key as publib will not set it up.                 |
| `GITHUB_USE_SSH`                                      | Deprecated                                       | Legacy alias for `GIT_USE_SSH`.                                                                                                                                                                                                                      |
| `GH_ENTERPRISE_TOKEN` or<br>`GITHUB_ENTERPRISE_TOKEN` | Optional                                         | [Custom Authentication token for API requests to GitHub Enterprise](https://cli.github.com/manual/gh_help_environment).                                                                                                                              |
| `GH_HOST`                                             | Optional                                         | Force use of a different [Hostname for GitHub Enterprise](https://cli.github.com/manual/gh_help_environment).                                                                                                                                        |
| `GITHUB_API_URL`                                      | Optional                                         | If present, used to detect the GitHub instance to target. This is specified by default in [GitHub Actions workflow](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables) and should not be set manually. |
| `VERSION`                                             | Optional                                         | Module version. Defaults to the value in the 'version' file of the module directory. Fails if it doesn't exist.                                                                                                                                      |
| `GIT_BRANCH`                                          | Optional                                         | Branch to push to. Defaults to 'main'.                                                                                                                                                                                                               |
| `GIT_USER_NAME`                                       | Optional                                         | Username to perform the commit with. Defaults to the git user.name config in the current directory. Fails if it doesn't exist.                                                                                                                       |
| `GIT_USER_EMAIL`                                      | Optional                                         | Email to perform the commit with. Defaults to the git user.email config in the current directory. Fails if it doesn't exist.                                                                                                                         |
| `GIT_COMMIT_MESSAGE`                                  | Optional                                         | The commit message. Defaults to 'chore(release): $VERSION'.                                                                                                                                                                                          |
| `DRYRUN`                                              | Optional                                         | Set to "true" for a dry run.                                                                                                                                                                                                                         |

## Publish to CodeArtifact for testing

This package contains the `publib-ca` CLI tool which is intended to use to publish
packages to CodeArtifact for testing (in a pipeline, before publishing to the
actual public package managers).

Use the following commands:

`publib-ca create [--no-gc] [--no-login]` creates a new CodeArtifact repository
with a random name, with upstreams configured for all supported public package
managers. By default this command runs the `gc` and `login` subcommands
automatically.

`publib-ca login --repo NAME [--cmd COMMAND]` logs in to a CodeArtifact repository and prepares some files that configure package managers for use with this CodeArtifact repository. If `--cmd` is given, the command is run in an environment
where all supported package managers have been configured for the given repository.
Otherwise, activate these settings in the current bash shell by running
`source ~/.publib-ca/usage/activate.bash`. This will set some
environment variables and copy some files into the current directory. (Note: the
CodeArtifact repository used here does not have to be created using `publib-ca create`. It
is fine if it already existed beforehand).

`publib-ca gc` collects old repositories created using `publib-ca create`.

`publib-ca publish [--repo NAME] DIRECTORY` publishes all packages in the given
directory to the given repository. If `--repo` is not given, the most recently
logged-into repository is used, if the login session is still valid.

## Roadmap

* [X] GitHub Support: Maven
* [X] GitHub Support: NuGet
* [ ] CodeArtifact Support: Maven
* [ ] CodeArtifact Support: NuGet
* [ ] CodeArtifact Support: Python

## License

Released under the [Apache 2.0](./LICENSE) license.
