# jsii-release

This library includes a set of programs that can be used to release multiple modules into various package managers.

These scripts where extracted from
[aws-delivlib](https://github.com/awslabs/aws-delivlib), which is used to
release [jsii](https://github.com/aws/jsii) and the [AWS
CDK](https://github.com/aws/aws-cdk).

## Usage

Install as an npm module:

```shell
$ npm install jsii-release
```

Now, you can use `jsii-release-xxx DIR` to publish all the modules in `DIR` to their respective package manager.

## npm

Publishes all `*.tgz` files from `DIR` to [npmjs](npmjs.com) or [GitHub Packages](https://github.com/features/packages).

**Usage:**

```shell
npx jsii-release-npm DIR
```

**Options (environment variables):**

|Option|Required|Description|
|------|--------|-----------|
|`NPM_TOKEN`|Required|Registry authentication token (either [npm.js publishing token](https://docs.npmjs.com/creating-and-viewing-authentication-tokens) or a [GitHub personal access token](https://help.github.com/en/packages/using-github-packages-with-your-projects-ecosystem/configuring-npm-for-use-with-github-packages#authenticating-to-github-packages))|
|`NPM_REGISTRY`|Optional|The registry URL (defaults to "registry.npmjs.org"). Use "npm.pkg.github.com" to publish to GitHub Packages|

## Maven

Publishes all Maven modules in the `DIR` to [Maven Central](https://search.maven.org/).

**Usage:**

```shell
npx jsii-release-maven DIR
```

**Options (environment variables):**

|Option|Required|Description|
|------|--------|-----------|
|`MAVEN_STAGING_PROFILE_ID`|Yes|Maven Central (sonatype) staging profile ID (e.g. 68a05363083174)|
|`MAVEN_USERNAME`|Yes|User name for Sonatype|
|`MAVEN_PASSWORD`|Yes|Password for Sonatype|
|`MAVEN_GPG_PRIVATE_KEY` or `MAVEN_GPG_PRIVATE_KEY_FILE`|Yes|GPG private key (or file that includes it) where newlines are encoded as "\n"|
|`MAVEN_GPG_PRIVATE_KEY_PASSPHRASE`|Yes|The passphrase of the provided key|
|`MAVEN_DRYRUN`|No|Set to "true" for a dry run|

### Maven Configuration

In order to configure the Maven publisher, you will need at least three pieces
of information:

1. __Maven Central credentials__ (`mavenLoginSecret`) stored in AWS Secrets Manager
2. __GPG signing key__ (`signingKey`) to sign your Maven packages
3. __Staging profile ID__ (`stagingProfileId`) assigned to your account in Maven Central.

The following sections will describe how to obtain this information.

#### GPG Signing Key

Since Maven Central requires that you sign your packages you will need to
create a GPG key pair and publish it's public key to a well-known server such as https://keyserver.ubuntu.com.

#### Sonatype Credentials

In order to publish to Maven Central, you'll need to follow the instructions in
Maven Central's [OSSRH Guide](http://central.sonatype.org/pages/ossrh-guide.html)
and create a Sonatype account and project via JIRA:

1. [Create JIRA
   account](https://issues.sonatype.org/secure/Signup!default.jspa)
2. [Create new project
   ticket](https://issues.sonatype.org/secure/CreateIssue.jspa?issuetype=21&pid=10134)
3. Configure `MAVEN_USERNAME` and `MAVEN_PASSWORD` with the account and password you created.

#### Staging Profile ID

After you've obtained a Sonatype account and Maven Central project:

1. Log into https://oss.sonatype.org
2. Select "Staging Profiles" from the side bar (under "Build Promotion")
3. Click on the "Releases" staging profile that you registered
4. The URL of the page should change and include your profile ID. For example: `https://oss.sonatype.org/#stagingProfiles;11a33451234521`

This is the value you should assign to the `MAVEN_STAGING_PROFILE_ID` option.


## NuGet

Publishes all `*.nupkg` to the [NuGet Gallery](https://www.nuget.org/).

**Usage:**

```shell
npx jsii-release-nuget DIR
```

**Options (environment variables):**

|Option|Required|Description|
|------|--------|-----------|
|`NUGET_API_KEY`|Required|[NuGet API Key](https://www.nuget.org/account/apikeys) with "Push" permissions|

## PyPI

Publishes all `*.whl` files to [PyPI](https://pypi.org/).

**Usage:**

```shell
npx jsii-release-pypi DIR
```

**Options (environment variables):**

|Option|Required|Description|
|------|--------|-----------|
|`TWINE_USERNAME`|Required|PyPI username ([register](https://pypi.org/account/register/))|
|`TWINE_PASSWORD`|Required|PyPI password|


## Roadmap

- [ ] Allow using GitHub Packages Maven & NuGet

## License

Released under the [Apache 2.0](./LICENSE) license.