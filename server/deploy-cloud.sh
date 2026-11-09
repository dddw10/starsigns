#!/usr/bin/env sh
set -eu

APP_DIR=${APP_DIR:-/opt/fortune-server}
DEPLOY_ENV_FILE=${DEPLOY_ENV_FILE:-.env.production}
DEPLOY_COMPOSE_FILE=${DEPLOY_COMPOSE_FILE:-docker-compose.prod.yml}
SCRIPT_DIR=${DEPLOY_SCRIPT_DIR:-$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)}
NODE_BINARY=${NODE_BINARY:-node}
DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then DRY_RUN=true; shift; fi
if [ "$#" -ne 0 ]; then echo "Usage: deploy-cloud.sh [--dry-run]" >&2; exit 1; fi

# 预检没有副作用，远端基础设施由维护者独立管理，应用包不得覆盖。
cd "$APP_DIR"
APP_DIR=$(pwd)
case "$DEPLOY_ENV_FILE" in /*) ;; *) DEPLOY_ENV_FILE="$APP_DIR/$DEPLOY_ENV_FILE" ;; esac
export APP_DIR DEPLOY_ENV_FILE
"$NODE_BINARY" "$SCRIPT_DIR/scripts/deploy-preflight.js" --env-file "$DEPLOY_ENV_FILE" -f "$DEPLOY_COMPOSE_FILE"
if [ "$DRY_RUN" = true ]; then exit 0; fi

if [ -n "${DEPLOY_ARCHIVE:-}" ]; then
  tar -tzf "$DEPLOY_ARCHIVE" >/dev/null
  # 保留每次备份，不删除上一次回滚点。
  backup_dir=$(mktemp -d "$APP_DIR/backup.XXXXXXXX")
  for item in src public; do
    if [ -d "$item" ]; then mv "$item" "$backup_dir/"; fi
  done
  tar -xzf "$DEPLOY_ARCHIVE"
  echo "Application backup saved: $backup_dir"
fi
mkdir -p logs certs
docker compose --env-file "$DEPLOY_ENV_FILE" -f "$DEPLOY_COMPOSE_FILE" up -d --build
docker compose --env-file "$DEPLOY_ENV_FILE" -f "$DEPLOY_COMPOSE_FILE" ps
