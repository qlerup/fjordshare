#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/volume1/docker/fjordshare}"

echo "==> Gaar til $APP_DIR"
cd "$APP_DIR"

echo "==> Docker Compose filer"
sudo docker compose config >/dev/null

if [ "${1:-}" = "--fresh" ]; then
  echo "==> Frisk rebuild uden cache"
  sudo docker compose build --no-cache
  echo "==> Starter containere"
  sudo docker compose up -d
else
  echo "==> Bygger og starter"
  sudo docker compose up -d --build
fi

echo "==> Status"
sudo docker compose ps

echo "==> Seneste logs"
sudo docker compose logs --tail=50

