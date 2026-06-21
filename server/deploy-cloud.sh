#!/usr/bin/env sh
set -eu

APP_DIR=${APP_DIR:-/opt/fortune-server}

echo "Deploying to ${APP_DIR}"

mkdir -p "${APP_DIR}"
cd "${APP_DIR}"

mkdir -p logs certs

if [ ! -f .env.production ]; then
  cp .env.production.example .env.production
  echo ".env.production created from template. Update it before real production use."
fi

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
