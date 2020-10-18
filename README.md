# jsii-release

This library includes a set of programs that can be used to release multiple modules into various package managers.

These scripts where extracted from
[aws-delivlib](https://github.com/awslabs/aws-delivlib), which is used to
release [jsii](https://github.com/aws/jsii) and the [AWS
CDK](https://github.com/aws/aws-cdk).

## Usage

This is an npm module. You can install it using `yarn add jsii-release` or `npm
install jsii-release`. In most cases it will be installed as a `devDependency`
in your `package.json`.

This tool expects to find a distribution directory (default name is `dist`)
which contains "ready-to-publish" artifacts for each package manager. This
structure is compatible with `jsii-pacmak`:

- `dist/js/*.tgz` - npm tarballs
- `dist/python/*.whl` - Python wheels
- `dist/nuget/*.nupkg` - Nuget packages
- `dist/java/**` - Maven artifacts in local repository structure

Each publisher needs a set of environment variables with credentials as
described below (`NPM_TOKEN`, `TWINE_PASSWORD` etc).

Then:

```shell
$ jsii-release
```

You can customize the distribution directory through `jsii-release DIR` (the
default is `dist`)

This command will discover all the artifacts based on the above structure and
will publish them to their respective package manager.

You can also execute individual publishers:

* `jsii-release-maven`
* `jsii-release-nuget`
* `jsii-release-npm`
* `jsii-release-pypi`

## npm

Publishes all `*.tgz` files from `DIR` to [npmjs](npmjs.com) or [GitHub Packages](https://github.com/features/packages).

**Usage:**

```shell
npx jsii-release-npm [DIR]
```

`DIR` is a directory with npm tarballs (*.tgz). Default is `dist/js`.

**Options (environment variables):**

|Option|Required|Description|
|------|--------|-----------|
|`NPM_TOKEN`|Required|Registry authentication token (either [npm.js publishing token](https://docs.npmjs.com/creating-and-viewing-authentication-tokens) or a [GitHub personal access token](https://help.github.com/en/packages/using-github-packages-with-your-projects-ecosystem/configuring-npm-for-use-with-github-packages#authenticating-to-github-packages))|
|`NPM_REGISTRY`|Optional|The registry URL (defaults to "registry.npmjs.org"). Use "npm.pkg.github.com" to publish to GitHub Packages|
|`NPM_DIST_TAG`|Optional|Registers the published package with the given [dist-tag](https://docs.npmjs.com/cli/dist-tag) (e.g. `next`, default is `latest`)|

## Maven

Publishes all Maven modules in the `DIR` to [Maven Central](https://search.maven.org/).

**Usage:**

```shell
npx jsii-release-maven [DIR]
```

`DIR` is a directory with a local maven layout. Default is `dist/java`.

**Options (environment variables):**

|Option|Required|Description|
|------|--------|-----------|
|`MAVEN_USERNAME` and `MAVEN_PASSWORD`|Yes|Username and password for maven repository. For Maven Central, you will need to [Create JIRA account](https://issues.sonatype.org/secure/Signup!default.jspa) and then request a [new project](https://issues.sonatype.org/secure/CreateIssue.jspa?issuetype=21&pid=10134)|
|`MAVEN_GPG_PRIVATE_KEY` or `MAVEN_GPG_PRIVATE_KEY_FILE` and `MAVEN_GPG_PRIVATE_KEY_PASSPHRASE`|Yes for Maven Central|GPG private key or file that includes it. This is used to sign your Maven packages. See instructions below|
|`MAVEN_STAGING_PROFILE_ID`|Yes for Maven Central|Maven Central (sonatype) staging profile ID (e.g. 68a05363083174). Staging profile ID can be found **in the URL** of the "Releases" staging profile under "Staging Profiles" in https://oss.sonatype.org (e.g. `https://oss.sonatype.org/#stagingProfiles;11a33451234521`|
|`MAVEN_ENDPOINT`|No|URL of Nexus repository. Defaults to `https://oss.sonatype.org`|
|`MAVEN_SERVER_ID`|No|Used in maven settings for credential lookup (e.g. use `github` when publishing to GitHub). Defaults to `ossrh` for Maven Central.|
|`MAVEN_REPOSITORY_URL`|No|Deployment repository when not deploying to Maven Central|
|`MAVEN_DRYRUN`|No|Set to "true" for a dry run|

**How to create a GPG key?**

Install [GnuPG](https://gnupg.org/).

Generate your key (use RSA, 4096, passphrase):

```console
$ gpg --gen-key
```

Your selected passphrase goes to `MAVEN_GPG_PRIVATE_KEY_PASSPHRASE`.

Export and publish the public key:

```console
$ gpg -a --export > public.pem
```

Go to https://keyserver.ubuntu.com/ and submit the public key

Export and the private key:

```console
$ gpg -a --export-secret-keys <fingerprint> > private.pem
```

Now, either set `MAVEN_GPG_PRIVATE_KEY_FILE` to point to `private.pem` or
export the private key to a single line where newlines are encoded as `\n` 
and then assign it to `MAVEN_GPG_PRIVATE_KEY`:

```console
$ echo $(cat -e private.pem) | sed 's/\$ /\\n/g' | sed 's/\$$//'
```

**Publish to GitHub Packages**

An example GitHub Actions publish step:
```yaml
- name: Publish package
  run: npx -p jsii-release jsii-release-maven
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
npx jsii-release-nuget [DIR]
```

`DIR` is a directory with Nuget packages (*.nupkg). Default is `dist/dotnet`.

**Options (environment variables):**

|Option|Required|Description|
|------|--------|-----------|
|`NUGET_API_KEY`|Required|[NuGet API Key](https://www.nuget.org/account/apikeys) with "Push" permissions|

## PyPI

Publishes all `*.whl` files to [PyPI](https://pypi.org/).

**Usage:**

```shell
npx jsii-release-pypi [DIR]
```

`DIR` is a directory with Python wheels (*.whl). Default is `dist/python`.

**Options (environment variables):**

|Option|Required|Description|
|------|--------|-----------|
|`TWINE_USERNAME`|Required|PyPI username ([register](https://pypi.org/account/register/))|
|`TWINE_PASSWORD`|Required|PyPI password|
|`TWINE_REPOSITORY_URL`|Optional|The registry URL (defaults to Twine default)|


## Roadmap

- [X] GitHub Support: Maven
- [ ] GitHub Support: NuGet
- [ ] CodeArtifact Support: Maven
- [ ] CodeArtifact Support: NuGet
- [ ] CodeArtifact Support: Python

## License

Released under the [Apache 2.0](./LICENSE) license.
