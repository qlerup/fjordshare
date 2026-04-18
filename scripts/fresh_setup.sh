#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
TARGET_SCRIPT="${SCRIPT_DIR}/fresh_setup_lxc.sh"

echo "INFO: scripts/fresh_setup.sh is kept as a compatibility alias."
echo "INFO: Preferred entrypoint is scripts/fresh_setup_lxc.sh"
exec sh "$TARGET_SCRIPT" "$@"
