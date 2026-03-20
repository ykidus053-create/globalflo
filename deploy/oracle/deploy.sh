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

docker compose up -d --build
docker compose ps
