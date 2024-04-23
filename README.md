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
| `NPM_REGISTRY`          | Optional | The registry URL (defaults to "registry.npmjs.org"). Use "npm.pkg.github.com" to publish to GitHub Packages. Use repository endpoint for AWS CodeAtifact, e.g. "my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo/".                                                                                                                                  |
| `NPM_DIST_TAG`          | Optional | Registers the published package with the given [dist-tag](https://docs.npmjs.com/cli/dist-tag) (e.g. `next`, default is `latest`)                                                                                                                                                                                                                                             |
| `NPM_ACCESS_LEVEL`      | Optional | Publishes the package with the given [access level](https://docs.npmjs.com/cli/v8/commands/npm-publish#access) (e.g. `public`, default is `restricted` for scoped packages and `public` for unscoped packages)                                                                                                                                                                |
| `AWS_ACCESS_KEY_ID`     | Optional | If AWS CodeArtifact is used as registry, an AWS access key can be spedified.                                                                                                                                                                                                                                                                                                  |
| `AWS_SECRET_ACCESS_KEY` | Optional | Secret access key that belongs to the AWS access key.                                                                                                                                                                                                                                                                                                                         |
| `AWS_ROLE_TO_ASSUME`    | Optional | If AWS CodeArtifact is used as registry, an AWS role ARN to assume before authorizing.                                                                                                                                                                                                                                                                                        |
| `DISABLE_HTTPS`         | Optional | Connect to the registry with HTTP instead of HTTPS (defaults to false).                                                                                                                                                                                                                                                                                                       |

## Maven

Publishes all Maven modules in the `DIR` to [Maven Central](https://search.maven.org/).

Note that if you signed up at SonaType after February 2021, you need to use this URL: `https://s01.oss.sonatype.org` ([announcement](https://central.sonatype.org/news/20210223_new-users-on-s01/)).

**Usage:**

```shell
npx publib-maven [DIR]
```

`DIR` is a directory with a local maven layout. Default is `dist/java`.

**Options (environment variables):**

| Option                                                                                         | Required                        | Description                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MAVEN_USERNAME` and `MAVEN_PASSWORD`                                                          | Yes                             | Username and password for maven repository. For Maven Central, you will need to [Create JIRA account](https://issues.sonatype.org/secure/Signup!default.jspa) and then request a [new project](https://issues.sonatype.org/secure/CreateIssue.jspa?issuetype=21&pid=10134). Read the [OSSRH guide](https://central.sonatype.org/pages/ossrh-guide.html) for more details. |
| `MAVEN_GPG_PRIVATE_KEY` or `MAVEN_GPG_PRIVATE_KEY_FILE` and `MAVEN_GPG_PRIVATE_KEY_PASSPHRASE` | Yes for Maven Central           | GPG private key or file that includes it. This is used to sign your Maven packages. See instructions below                                                                                                                                                                                                                                                                |
| `MAVEN_STAGING_PROFILE_ID`                                                                     | Yes for Maven Central           | Maven Central (sonatype) staging profile ID (e.g. 68a05363083174). Staging profile ID can be found **in the URL** of the "Releases" staging profile under "Staging Profiles" in <https://oss.sonatype.org> or <https://s01.oss.sonatype.org> if you are logged in (e.g. `https://oss.sonatype.org/#stagingProfiles;68a05363083174`).                                      |
| `MAVEN_ENDPOINT`                                                                               | Yes for new Maven Central users | URL of Nexus repository. Defaults to `https://oss.sonatype.org`. Use `https://s01.oss.sonatype.org` if you are a new user.                                                                                                                                                                                                                                                |
| `MAVEN_SERVER_ID`                                                                              | No                              | Used in maven settings for credential lookup (e.g. use `github` when publishing to GitHub). Defaults to `ossrh` for Maven Central.                                                                                                                                                                                                                                        |
| `MAVEN_REPOSITORY_URL`                                                                         | No                              | Deployment repository when not deploying to Maven Central                                                                                                                                                                                                                                                                                                                 |
| `MAVEN_DRYRUN`                                                                                 | No                              | Set to "true" for a dry run                                                                                                                                                                                                                                                                                                                                               |

**How to create a GPG key?**

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

| Option                 | Required | Description                                                    |
| ---------------------- | -------- | -------------------------------------------------------------- |
| `TWINE_USERNAME`       | Required | PyPI username ([register](https://pypi.org/account/register/)) |
| `TWINE_PASSWORD`       | Required | PyPI password                                                  |
| `TWINE_REPOSITORY_URL` | Optional | The registry URL (defaults to Twine default)                   |

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
