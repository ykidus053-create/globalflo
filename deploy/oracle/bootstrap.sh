#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-www.globalflow.com}"
APP_DIR="${APP_DIR:-/opt/globalflow}"
REPO_URL="${REPO_URL:-https://github.com/ykidus053-create/globalflo.git}"
BRANCH="${BRANCH:-main}"

sudo apt-get update
sudo apt-get install -y ca-certificates curl git ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi

sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker "$USER"

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER:$USER" "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

cat > .env <<EOF
DOMAIN=$DOMAIN
GLOBALFLOW_AUTOPILOT_ENABLED=1
WEB_CONCURRENCY=2
EOF

docker compose up -d --build
docker compose ps

echo
echo "Bootstrap complete."
echo "Open https://$DOMAIN after DNS points to this server."
echo "If docker permission is denied, sign out and back in once, then rerun:"
echo "cd $APP_DIR && docker compose up -d --build"
