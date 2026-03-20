#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/globalflow}"
REPO_URL="${REPO_URL:-https://github.com/ykidus053-create/globalflo.git}"
BRANCH="${BRANCH:-main}"

if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER:$USER" "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created $APP_DIR/.env from template."
  echo "Set DOMAIN in .env to your real domain, then rerun this script."
  exit 1
fi

DOMAIN_VALUE="$(grep '^DOMAIN=' .env | cut -d'=' -f2- || true)"
if [ -z "$DOMAIN_VALUE" ]; then
  echo "DOMAIN is missing in $APP_DIR/.env"
  exit 1
fi

docker compose up -d --build
docker compose ps
