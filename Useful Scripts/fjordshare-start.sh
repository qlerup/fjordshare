#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/fjordshare}"
WAIT_TIMEOUT_SEC="${WAIT_TIMEOUT_SEC:-180}"
WAIT_INTERVAL_SEC="${WAIT_INTERVAL_SEC:-2}"

validate_wait_settings() {
  case "$WAIT_TIMEOUT_SEC" in
    *[!0-9]*|"")
      WAIT_TIMEOUT_SEC=180
      ;;
  esac
  case "$WAIT_INTERVAL_SEC" in
    *[!0-9]*|"")
      WAIT_INTERVAL_SEC=2
      ;;
  esac
  if [ "$WAIT_TIMEOUT_SEC" -le 0 ]; then
    WAIT_TIMEOUT_SEC=180
  fi
  if [ "$WAIT_INTERVAL_SEC" -le 0 ]; then
    WAIT_INTERVAL_SEC=2
  fi
}

wait_for_fjordshare() {
  elapsed=0
  echo "==> Venter pÃ¥ fjordshare health (timeout ${WAIT_TIMEOUT_SEC}s)"
  while [ "$elapsed" -lt "$WAIT_TIMEOUT_SEC" ]; do
    container_id="$(sudo docker compose ps -q fjordshare 2>/dev/null || true)"
    if [ -n "$container_id" ]; then
      state="$(sudo docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
      case "$state" in
        healthy|running)
          if sudo docker compose exec -T fjordshare sh -lc "curl -fsS http://127.0.0.1:8080/api/health >/dev/null"; then
            echo "==> fjordshare er klar"
            return 0
          fi
          ;;
        unhealthy|exited|dead)
          echo "Fejl: fjordshare status er $state under opstart."
          sudo docker compose logs --tail=120 fjordshare || true
          return 1
          ;;
      esac
    fi
    sleep "$WAIT_INTERVAL_SEC"
    elapsed=$((elapsed + WAIT_INTERVAL_SEC))
  done

  echo "Fejl: timeout mens fjordshare blev klar."
  sudo docker compose ps || true
  sudo docker compose logs --tail=120 fjordshare || true
  return 1
}

validate_wait_settings

echo "==> Gaar til $APP_DIR"
cd "$APP_DIR"

echo "==> Docker Compose filer"
sudo docker compose config >/dev/null

if [ "${1:-}" = "--fresh" ]; then
  echo "==> Frisk rebuild uden cache"
  sudo docker compose build --no-cache
  echo "==> Starter containere"
  sudo docker compose up -d
  wait_for_fjordshare
else
  echo "==> Bygger og starter"
  sudo docker compose up -d --build
  wait_for_fjordshare
fi

echo "==> Status"
sudo docker compose ps

echo "==> Seneste logs"
sudo docker compose logs --tail=50
