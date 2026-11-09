#!/usr/bin/env sh
set -eu
cd "$APP_DIR"
DEPLOY_ARCHIVE="$APP_DIR/server-deploy.tar.gz"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
tar -xzf "$DEPLOY_ARCHIVE" -C "$stage"
export DEPLOY_ARCHIVE
DEPLOY_SCRIPT_DIR="$stage" sh "$stage/deploy-cloud.sh"
