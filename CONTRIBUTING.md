# How to work on this repository

## Testing Maven publishing

- Create a Sonatype account at <https://central.sonatype.com/account>. You can use GitHub to sign in.
- Generate a user token, note the username and password.
- Generate an empty project and give it a jsii config. Example:

```
{
  "jsii": {
    "versionFormat": "full",
    "targets": {
      "java": {
        "package": "test.test",
        "maven": {
          "groupId": "test.test",
          "artifactId": "test"
        }
      }
    },
    "outdir": "dist"
  },
}
```

Follow the instructions in the README for creating and exporting a GPG key.

Then run the following command:

```
env MAVEN_GPG_PRIVATE_KEY_FILE=$PWD/mykey.priv MAVEN_GPG_PRIVATE_KEY_PASSPHRASE=mypassphrase MAVEN_STAGING_PROFILE_ID=com.sonatype.software MAVEN_SERVER_ID=central-ossrh MAVEN_USERNAME=**** MAVEN_PASSWORD=**** /path/to/publib/bin/publib-maven
```