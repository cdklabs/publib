#!/bin/bash

###
#
# This script provides a wrapper around gpg used by maven gpg:sign-and-deploy-file.
# Many versions of gpg require setting pinentry-mode to loopback to prevent prompting.
# Generally this can be done in a POM file, but jsii-release-maven tries to keep
# release details self contained. gpgArguments is also not available as a user property.
# This script follows:
# https://stackoverflow.com/questions/60417391/pass-in-list-parameter-to-maven-using-the-cli-gpgsign-and-deploy-file 
#
###

gpg --pinentry-mode loopback "$@"