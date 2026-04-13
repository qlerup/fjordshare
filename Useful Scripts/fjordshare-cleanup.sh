#!/bin/bash
set -euo pipefail

containers=("fjordshare")
repos=("fjordshare-fjordshare")

echo "=== Eksisterende mounts paa containere ==="
for c in "${containers[@]}"; do
  if docker inspect "$c" >/dev/null 2>&1; then
    echo
    echo "Container: $c"
    docker inspect "$c" --format '{{range .Mounts}}{{println .Type "->" .Source "=>" .Destination}}{{end}}'
  fi
done

echo
echo "=== Matchende containere ==="
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E '^fjordshare$' || true

echo
echo "=== Matchende images ==="
for repo in "${repos[@]}"; do
  docker image ls "$repo" --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}' || true
done

echo
echo "=== Matchende volumes ==="
docker volume ls --format '{{.Name}}' | grep '^fjordshare' || true

echo
echo "=== Matchende netvaerk ==="
docker network ls --format '{{.Name}}' | grep '^fjordshare' || true

echo
read -r -p "Slet ALT ovenstaaende og ryd ogsaa unused images/cache? [y/N] " reply
[[ "$reply" =~ ^[Yy]$ ]] || exit 0

echo
echo "=== Stopper og sletter containere ==="
for c in "${containers[@]}"; do
  if docker inspect "$c" >/dev/null 2>&1; then
    docker rm -f "$c" || true
  fi
done

echo
echo "=== Sletter fjordshare-images ==="
for repo in "${repos[@]}"; do
  ids="$(docker image ls "$repo" -q | sort -u || true)"
  if [ -n "$ids" ]; then
    docker rmi -f $ids || true
  fi
done

echo
echo "=== Sletter fjordshare-volumes ==="
vols="$(docker volume ls --format '{{.Name}}' | grep '^fjordshare' || true)"
if [ -n "$vols" ]; then
  echo "$vols" | xargs -r docker volume rm || true
fi

echo
echo "=== Sletter fjordshare-netvaerk ==="
nets="$(docker network ls --format '{{.Name}}' | grep '^fjordshare' || true)"
if [ -n "$nets" ]; then
  echo "$nets" | xargs -r docker network rm || true
fi

echo
echo "=== Rydder build cache ==="
docker builder prune -af || true

echo
echo "=== Rydder alle unused images ==="
docker image prune -af || true

echo
echo "=== Rydder stoppede containere ==="
docker container prune -f || true

echo
echo "=== Rydder unused netvaerk ==="
docker network prune -f || true

echo
echo "=== Oprydning faerdig ==="
