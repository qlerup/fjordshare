#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_DIR="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_DIR}/.env}"
EXAMPLE_ENV="${REPO_DIR}/.env.example"

# Clear terminal at startup for better readability in interactive sessions.
if [ -t 1 ]; then
  if command -v clear >/dev/null 2>&1; then
    clear || printf '\033c'
  else
    printf '\033c'
  fi
fi

ask_input() {
  prompt="$1"
  default="${2:-}"
  example="${3:-}"
  explain="${4:-}"
  printf "\n%s\n" "$prompt" >&2
  if [ -n "$explain" ]; then
    printf "Description: %s\n" "$explain" >&2
  fi
  if [ -n "$example" ]; then
    printf "Example: %s\n" "$example" >&2
  fi
  if [ -n "$default" ]; then
    printf "Default: %s\n" "$default" >&2
  fi
  printf "Answer (press Enter for default): " >&2
  IFS= read -r answer || true
  if [ -z "$answer" ]; then
    printf "%s" "$default"
  else
    printf "%s" "$answer"
  fi
}

ask_yes_no() {
  prompt="$1"
  default="${2:-y}"
  while :; do
    printf "\n%s\n" "$prompt" >&2
    if [ "$default" = "y" ]; then
      printf "Answer [Y/n] (Enter=Y): " >&2
    else
      printf "Answer [y/N] (Enter=N): " >&2
    fi
    IFS= read -r answer || true
    answer="$(printf "%s" "$answer" | tr '[:upper:]' '[:lower:]')"
    if [ -z "$answer" ]; then
      answer="$default"
    fi
    case "$answer" in
      y|yes) return 0 ;;
      n|no) return 1 ;;
      *) echo "Please answer y or n." ;;
    esac
  done
}

print_cmd() {
  printf "  > %s\n" "$*"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: Missing required command: $1"
    exit 1
  }
}

is_truthy() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

csv_has() {
  csv="$1"
  needle="$2"
  old_ifs="$IFS"
  IFS=','
  for item in $csv; do
    clean="$(printf '%s' "$item" | tr -d '[:space:]')"
    if [ "$clean" = "$needle" ]; then
      IFS="$old_ifs"
      return 0
    fi
  done
  IFS="$old_ifs"
  return 1
}

as_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return
  fi
  echo "ERROR: sudo is required for this operation (or run as root)."
  exit 1
}

ensure_fstab_line() {
  mount_point="$1"
  new_line="$2"
  fstab="/etc/fstab"
  ts="$(date +%Y%m%d%H%M%S)"

  as_sudo cp "$fstab" "${fstab}.bak.${ts}"
  if as_sudo grep -Fq "$mount_point" "$fstab"; then
    as_sudo sed -i "\|$mount_point|d" "$fstab"
  fi
  printf '%s\n' "$new_line" | as_sudo tee -a "$fstab" >/dev/null
}

ensure_absolute_dir() {
  path="$1"
  label="$2"
  if [ -z "$path" ]; then
    echo "ERROR: ${label} is empty."
    exit 1
  fi
  case "$path" in
    /*) ;;
    *)
      echo "ERROR: ${label} must be an absolute path, got: ${path}"
      exit 1
      ;;
  esac
  mkdir -p "$path"
  if [ ! -d "$path" ]; then
    echo "ERROR: Could not create/read directory for ${label}: ${path}"
    exit 1
  fi
}

assert_writable() {
  path="$1"
  label="$2"
  probe="${path}/.fjordshare_write_test.$$"
  if ! ( : > "$probe" ) 2>/dev/null; then
    echo "ERROR: ${label} is not writable: ${path}"
    exit 1
  fi
  rm -f "$probe" >/dev/null 2>&1 || true
}

mount_field() {
  path="$1"
  field="$2"
  findmnt -T "$path" -n -o "$field" 2>/dev/null | head -n 1 || true
}

report_mount() {
  path="$1"
  label="$2"
  expected_csv="$3"
  target="$(mount_field "$path" TARGET)"
  source="$(mount_field "$path" SOURCE)"
  fstype="$(mount_field "$path" FSTYPE)"
  if [ -z "$target" ] || [ -z "$fstype" ]; then
    echo "ERROR: Could not resolve mount info for ${label}: ${path}"
    exit 1
  fi
  echo "    ${label}: ${path}"
  echo "      mount: ${source} on ${target} (fstype=${fstype})"
  if [ -n "$expected_csv" ] && ! csv_has "$expected_csv" "$fstype"; then
    echo "ERROR: ${label} fstype '${fstype}' is not in EXPECT list: ${expected_csv}"
    exit 1
  fi
}

detect_host_ip() {
  ip_candidate=""
  if command -v hostname >/dev/null 2>&1; then
    ip_candidate="$(hostname -I 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i !~ /^127\./) {print $i; exit}}')"
  fi
  if [ -z "$ip_candidate" ] && command -v ip >/dev/null 2>&1; then
    ip_candidate="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '/src/ {for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}')"
  fi
  if [ -z "$ip_candidate" ] && command -v hostname >/dev/null 2>&1; then
    ip_candidate="$(hostname 2>/dev/null || true)"
  fi
  if [ -z "$ip_candidate" ]; then
    ip_candidate="localhost"
  fi
  printf "%s" "$ip_candidate"
}

require_runtime_tools() {
  need_cmd docker
  need_cmd findmnt
  docker compose version >/dev/null 2>&1 || {
    echo "ERROR: docker compose plugin not available."
    exit 1
  }
  if is_truthy "${SETUP_NFS_UPLOADS_ENABLED:-0}"; then
    need_cmd grep
    need_cmd sed
    need_cmd tee
    need_cmd mount
  fi
}

load_env_with_defaults() {
  if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
  fi

  : "${APP_PORT:=9090}"
  : "${DATA_DIR:=/opt/fjordshare-data/appdata}"
  : "${UPLOADS_HOST_DIR:=/opt/fjordshare-data/uploads}"
  : "${THUMBS_HOST_DIR:=/opt/fjordshare-data/thumbs}"
  : "${TZ:=Europe/Copenhagen}"
  : "${THUMB_SIZE_PX:=480}"
  : "${BAMBUSTUDIO_APPIMAGE_URL:=}"
  : "${BAMBUSTUDIO_BIN:=bambu-studio}"
  : "${BAMBUSTUDIO_CONFIG_PATH:=}"
  : "${BAMBUSTUDIO_PROFILE_ROOT:=}"
  : "${BAMBUSTUDIO_TIMEOUT_SEC:=1800}"
  : "${BAMBUSTUDIO_PRINTER_PROFILES:=}"
  : "${BAMBUSTUDIO_PRINT_PROFILES:=}"
  : "${BAMBUSTUDIO_FILAMENT_PROFILES:=}"
  : "${BAMBUSTUDIO_LOAD_SETTINGS:=}"
  : "${BAMBUSTUDIO_LOAD_FILAMENTS:=}"
  : "${BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK:=0}"
  : "${BAMBUSTUDIO_SLICE_DEBUG_ALWAYS:=0}"
  : "${UI_VERSION_MARKER:=TMP-2026-04-12-07}"

  : "${EXPECT_DATA_FSTYPES:=}"
  : "${EXPECT_UPLOADS_FSTYPES:=}"
  : "${EXPECT_THUMBS_FSTYPES:=}"
  : "${SETUP_NFS_UPLOADS_ENABLED:=0}"
  : "${SETUP_NFS_EXPORT:=10.10.0.161:/volume1/ProxmoxFjordshare}"
  : "${SETUP_NFS_MOUNT_ROOT:=${HOME:-/root}/synology/fjordshare-data}"
  : "${SETUP_NFS_UPLOADS_SUBDIR:=uploads}"
  : "${SETUP_NFS_FSTAB_OPTIONS:=vers=3,_netdev,nofail}"
}

write_env_file() {
  target="$1"
  cat > "$target" <<EOF
# Generated by scripts/fresh_setup_lxc.sh
APP_PORT=${APP_PORT}
DATA_DIR=${DATA_DIR}
UPLOADS_HOST_DIR=${UPLOADS_HOST_DIR}
THUMBS_HOST_DIR=${THUMBS_HOST_DIR}
TZ=${TZ}
THUMB_SIZE_PX=${THUMB_SIZE_PX}
BAMBUSTUDIO_APPIMAGE_URL=${BAMBUSTUDIO_APPIMAGE_URL}
BAMBUSTUDIO_BIN=${BAMBUSTUDIO_BIN}
BAMBUSTUDIO_CONFIG_PATH=${BAMBUSTUDIO_CONFIG_PATH}
BAMBUSTUDIO_PROFILE_ROOT=${BAMBUSTUDIO_PROFILE_ROOT}
BAMBUSTUDIO_TIMEOUT_SEC=${BAMBUSTUDIO_TIMEOUT_SEC}
BAMBUSTUDIO_PRINTER_PROFILES=${BAMBUSTUDIO_PRINTER_PROFILES}
BAMBUSTUDIO_PRINT_PROFILES=${BAMBUSTUDIO_PRINT_PROFILES}
BAMBUSTUDIO_FILAMENT_PROFILES=${BAMBUSTUDIO_FILAMENT_PROFILES}
BAMBUSTUDIO_LOAD_SETTINGS=${BAMBUSTUDIO_LOAD_SETTINGS}
BAMBUSTUDIO_LOAD_FILAMENTS=${BAMBUSTUDIO_LOAD_FILAMENTS}
BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK=${BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK}
BAMBUSTUDIO_SLICE_DEBUG_ALWAYS=${BAMBUSTUDIO_SLICE_DEBUG_ALWAYS}
UI_VERSION_MARKER=${UI_VERSION_MARKER}
EXPECT_DATA_FSTYPES=${EXPECT_DATA_FSTYPES}
EXPECT_UPLOADS_FSTYPES=${EXPECT_UPLOADS_FSTYPES}
EXPECT_THUMBS_FSTYPES=${EXPECT_THUMBS_FSTYPES}
SETUP_NFS_UPLOADS_ENABLED=${SETUP_NFS_UPLOADS_ENABLED}
SETUP_NFS_EXPORT=${SETUP_NFS_EXPORT}
SETUP_NFS_MOUNT_ROOT=${SETUP_NFS_MOUNT_ROOT}
SETUP_NFS_UPLOADS_SUBDIR=${SETUP_NFS_UPLOADS_SUBDIR}
SETUP_NFS_FSTAB_OPTIONS=${SETUP_NFS_FSTAB_OPTIONS}
EOF
}

configure_nfs_upload_mount_if_enabled() {
  if ! is_truthy "${SETUP_NFS_UPLOADS_ENABLED:-0}"; then
    return 0
  fi
  if [ -z "${SETUP_NFS_EXPORT:-}" ] || [ -z "${SETUP_NFS_MOUNT_ROOT:-}" ]; then
    echo "ERROR: NFS setup is enabled but export/mount root is missing."
    exit 1
  fi
  case "$SETUP_NFS_MOUNT_ROOT" in
    /*) ;;
    *)
      echo "ERROR: SETUP_NFS_MOUNT_ROOT must be absolute: ${SETUP_NFS_MOUNT_ROOT}"
      exit 1
      ;;
  esac

  echo
  echo "==> Configuring NFS mount in /etc/fstab"
  print_cmd "mkdir -p ${SETUP_NFS_MOUNT_ROOT}"
  as_sudo mkdir -p "$SETUP_NFS_MOUNT_ROOT"
  fstab_line="${SETUP_NFS_EXPORT} ${SETUP_NFS_MOUNT_ROOT} nfs ${SETUP_NFS_FSTAB_OPTIONS} 0 0"
  print_cmd "update /etc/fstab entry for ${SETUP_NFS_MOUNT_ROOT}"
  ensure_fstab_line "$SETUP_NFS_MOUNT_ROOT" "$fstab_line"
  print_cmd "mount -a"
  as_sudo mount -a

  if ! findmnt -T "$SETUP_NFS_MOUNT_ROOT" >/dev/null 2>&1; then
    echo "ERROR: NFS mount is not active at ${SETUP_NFS_MOUNT_ROOT}"
    exit 1
  fi
  echo "    NFS mount active: ${SETUP_NFS_MOUNT_ROOT}"
}

run_preflight_and_start() {
  require_runtime_tools
  configure_nfs_upload_mount_if_enabled

  echo
  echo "==> Mount preflight"
  print_cmd "mkdir -p ${DATA_DIR}"
  ensure_absolute_dir "$DATA_DIR" "DATA_DIR"
  print_cmd "mkdir -p ${UPLOADS_HOST_DIR}"
  ensure_absolute_dir "$UPLOADS_HOST_DIR" "UPLOADS_HOST_DIR"
  print_cmd "mkdir -p ${THUMBS_HOST_DIR}"
  ensure_absolute_dir "$THUMBS_HOST_DIR" "THUMBS_HOST_DIR"

  assert_writable "$DATA_DIR" "DATA_DIR"
  assert_writable "$UPLOADS_HOST_DIR" "UPLOADS_HOST_DIR"
  assert_writable "$THUMBS_HOST_DIR" "THUMBS_HOST_DIR"

  report_mount "$DATA_DIR" "DATA_DIR" "$EXPECT_DATA_FSTYPES"
  report_mount "$UPLOADS_HOST_DIR" "UPLOADS_HOST_DIR" "$EXPECT_UPLOADS_FSTYPES"
  report_mount "$THUMBS_HOST_DIR" "THUMBS_HOST_DIR" "$EXPECT_THUMBS_FSTYPES"

  echo
  echo "==> Starting containers"
  cd "$REPO_DIR"
  print_cmd "docker compose up -d --build"
  docker compose up -d --build
  host_ip="$(detect_host_ip)"
  echo "==> Done"
  echo "    Open: http://${host_ip}:${APP_PORT:-9090}"
}

step_1_basic() {
  echo
  echo "Step 1/5: Basic app settings"
  APP_PORT="$(ask_input "Web port (APP_PORT)" "$APP_PORT" "9090 or 9080" "The port you open in your browser.")"
  TZ="$(ask_input "Timezone (TZ)" "$TZ" "Europe/Copenhagen" "Timezone in Region/City format.")"
}

step_2_uploads_target() {
  echo
  echo "Step 2/5: Upload destination (NAS/local)"
  use_nas_default="n"
  if is_truthy "$SETUP_NFS_UPLOADS_ENABLED" || [ -n "${EXPECT_UPLOADS_FSTYPES:-}" ]; then
    use_nas_default="y"
  fi

  if ask_yes_no "Store uploaded files on NAS/NFS?" "$use_nas_default"; then
    if ask_yes_no "Is NAS path already mounted (Proxmox bind mount / existing mount)?" "$(is_truthy "$SETUP_NFS_UPLOADS_ENABLED" && echo n || echo y)"; then
      SETUP_NFS_UPLOADS_ENABLED="0"
      UPLOADS_HOST_DIR="$(ask_input "UPLOADS_HOST_DIR (existing NAS path)" "$UPLOADS_HOST_DIR" "/mnt/fjordshare-nfs/uploads" "Absolute path that already points to your NAS share.")"
      if [ -z "$EXPECT_UPLOADS_FSTYPES" ]; then
        EXPECT_UPLOADS_FSTYPES="nfs,nfs4,cifs,fuseblk"
      fi
    else
      SETUP_NFS_UPLOADS_ENABLED="1"
      SETUP_NFS_EXPORT="$(ask_input "NFS export (server:/path)" "$SETUP_NFS_EXPORT" "10.10.0.161:/volume1/ProxmoxFjordshare" "Synology NFS share in server:/path format.")"
      SETUP_NFS_MOUNT_ROOT="$(ask_input "Local NFS mount root" "$SETUP_NFS_MOUNT_ROOT" "/home/qlerup/synology/fjordshare-data" "Local mount root on host/LXC. Must be absolute.")"
      SETUP_NFS_UPLOADS_SUBDIR="$(ask_input "Uploads subdir inside NFS mount" "$SETUP_NFS_UPLOADS_SUBDIR" "uploads" "Subfolder name only.")"
      SETUP_NFS_FSTAB_OPTIONS="$(ask_input "NFS fstab options" "$SETUP_NFS_FSTAB_OPTIONS" "vers=3,_netdev,nofail" "Mount options written to /etc/fstab.")"
      SETUP_NFS_UPLOADS_SUBDIR="$(printf "%s" "$SETUP_NFS_UPLOADS_SUBDIR" | sed 's#^/*##; s#/*$##')"
      if [ -z "$SETUP_NFS_UPLOADS_SUBDIR" ]; then
        SETUP_NFS_UPLOADS_SUBDIR="uploads"
      fi
      UPLOADS_HOST_DIR="${SETUP_NFS_MOUNT_ROOT}/${SETUP_NFS_UPLOADS_SUBDIR}"
      if [ -z "$EXPECT_UPLOADS_FSTYPES" ]; then
        EXPECT_UPLOADS_FSTYPES="nfs,nfs4"
      fi
    fi
  else
    SETUP_NFS_UPLOADS_ENABLED="0"
    UPLOADS_HOST_DIR="$(ask_input "UPLOADS_HOST_DIR (local path)" "$UPLOADS_HOST_DIR" "/opt/fjordshare-data/uploads" "Absolute local path for uploaded/shared files.")"
    EXPECT_UPLOADS_FSTYPES=""
  fi
}

step_3_storage() {
  echo
  echo "Step 3/5: App data + thumbnails paths"
  DATA_DIR="$(ask_input "DATA_DIR (DB + internal app state)" "$DATA_DIR" "/opt/fjordshare-data/appdata" "Should usually be local disk for SQLite stability.")"
  THUMBS_HOST_DIR="$(ask_input "THUMBS_HOST_DIR (thumbnails)" "$THUMBS_HOST_DIR" "/opt/fjordshare-data/thumbs" "Local or NAS, your choice.")"
}

step_4_slicer() {
  echo
  echo "Step 4/5: Slicer defaults"
  BAMBUSTUDIO_BIN="$(ask_input "Bambu Studio binary path (BAMBUSTUDIO_BIN)" "$BAMBUSTUDIO_BIN" "bambu-studio" "CLI binary used for slicing.")"
  BAMBUSTUDIO_TIMEOUT_SEC="$(ask_input "Slice timeout seconds (BAMBUSTUDIO_TIMEOUT_SEC)" "$BAMBUSTUDIO_TIMEOUT_SEC" "1800" "Timeout for slice jobs in seconds.")"
  BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK="$(ask_input "Allow profile fallback (0/1)" "$BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK" "0 or 1" "1 enables fallback profile selection.")"
}

step_5_fschecks() {
  echo
  echo "Step 5/5: Optional strict fs-type checks"
  if ask_yes_no "Enable strict fs-type checks (NFS/local expectations)?" "$( [ -n "$EXPECT_UPLOADS_FSTYPES$EXPECT_THUMBS_FSTYPES$EXPECT_DATA_FSTYPES" ] && echo y || echo n )"; then
    EXPECT_UPLOADS_FSTYPES="$(ask_input "EXPECT_UPLOADS_FSTYPES" "${EXPECT_UPLOADS_FSTYPES:-nfs,nfs4}" "nfs,nfs4" "Allowed fs types for uploads mount (comma-separated).")"
    EXPECT_THUMBS_FSTYPES="$(ask_input "EXPECT_THUMBS_FSTYPES (blank to skip)" "$EXPECT_THUMBS_FSTYPES" "nfs,nfs4" "Allowed fs types for thumbs mount. Blank = no check.")"
    EXPECT_DATA_FSTYPES="$(ask_input "EXPECT_DATA_FSTYPES (blank to skip)" "$EXPECT_DATA_FSTYPES" "ext4,xfs,btrfs" "Allowed fs types for DATA_DIR. Blank = no check.")"
  else
    EXPECT_UPLOADS_FSTYPES=""
    EXPECT_THUMBS_FSTYPES=""
    EXPECT_DATA_FSTYPES=""
  fi
}

print_summary() {
  echo
  echo "Summary:"
  echo "  APP_PORT=${APP_PORT}"
  echo "  DATA_DIR=${DATA_DIR}"
  echo "  UPLOADS_HOST_DIR=${UPLOADS_HOST_DIR}"
  echo "  THUMBS_HOST_DIR=${THUMBS_HOST_DIR}"
  echo "  BAMBUSTUDIO_BIN=${BAMBUSTUDIO_BIN}"
  echo "  BAMBUSTUDIO_TIMEOUT_SEC=${BAMBUSTUDIO_TIMEOUT_SEC}"
  echo "  BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK=${BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK}"
  echo "  SETUP_NFS_UPLOADS_ENABLED=${SETUP_NFS_UPLOADS_ENABLED}"
  if is_truthy "$SETUP_NFS_UPLOADS_ENABLED"; then
    echo "  SETUP_NFS_EXPORT=${SETUP_NFS_EXPORT}"
    echo "  SETUP_NFS_MOUNT_ROOT=${SETUP_NFS_MOUNT_ROOT}"
    echo "  SETUP_NFS_UPLOADS_SUBDIR=${SETUP_NFS_UPLOADS_SUBDIR}"
  fi
}

backup_env_once() {
  if [ "${ENV_BACKUP_DONE:-0}" = "1" ]; then
    return 0
  fi
  if [ -f "$ENV_FILE" ]; then
    backup_file="${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
    cp "$ENV_FILE" "$backup_file"
    echo
    echo "Backup of existing env saved to:"
    echo "  ${backup_file}"
  fi
  ENV_BACKUP_DONE=1
}

save_env() {
  backup_env_once
  write_env_file "$ENV_FILE"
  echo
  echo "Wrote configuration:"
  echo "  ${ENV_FILE}"
}

edit_menu() {
  while :; do
    echo
    echo "Edit settings menu:"
    echo "  1) Basic app settings"
    echo "  2) Upload destination (NAS/local)"
    echo "  3) App data + thumbnail paths"
    echo "  4) Slicer defaults"
    echo "  5) Strict fs-type checks"
    echo "  6) Done editing (back to summary)"
    choice="$(ask_input "Choose section number" "6" "1-6" "Type the number for what you want to edit.")"
    case "$choice" in
      1) step_1_basic ;;
      2) step_2_uploads_target ;;
      3) step_3_storage ;;
      4) step_4_slicer ;;
      5) step_5_fschecks ;;
      6|"") break ;;
      *) echo "Invalid choice. Please select 1-6." ;;
    esac
  done
}

if [ "${1:-}" = "--start-only" ]; then
  echo "==> FjordShare LXC start-only mode"
  echo "    Repo: ${REPO_DIR}"
  echo "    Env : ${ENV_FILE}"
  if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: Missing env file: ${ENV_FILE}"
    echo "Run full wizard first:"
    echo "  sh scripts/fresh_setup_lxc.sh"
    exit 1
  fi
  load_env_with_defaults
  run_preflight_and_start
  exit 0
fi

if [ "${1:-}" != "" ]; then
  echo "Usage:"
  echo "  sh scripts/fresh_setup_lxc.sh               # guided setup (A-Z)"
  echo "  sh scripts/fresh_setup_lxc.sh --start-only  # preflight + optional NFS/fstab + start"
  exit 1
fi

echo "==> FjordShare guided setup for LXC/NAS"
echo "    Repo: ${REPO_DIR}"
echo "    Env : ${ENV_FILE}"
echo "    Tip : press Enter to use the default at each prompt."
echo "    Step flow:"
echo "      1) Basic app settings"
echo "      2) Upload destination (NAS/local + optional /etc/fstab)"
echo "      3) App data + thumbnails paths"
echo "      4) Slicer defaults"
echo "      5) Optional strict fs-type checks"
echo "    Input examples:"
echo "      - APP_PORT: 9090 or 9080"
echo "      - DATA_DIR: /opt/fjordshare-data/appdata"
echo "      - UPLOADS_HOST_DIR: /mnt/fjordshare-nfs/uploads"
echo "      - NFS export: 10.10.0.161:/volume1/ProxmoxFjordshare"

if [ ! -f "$EXAMPLE_ENV" ]; then
  echo "ERROR: Missing .env.example in repo root."
  exit 1
fi

load_env_with_defaults
step_1_basic
step_2_uploads_target
step_3_storage
step_4_slicer
step_5_fschecks

while :; do
  save_env
  print_summary
  echo
  if ask_yes_no "Run preflight + optional NFS/fstab + docker compose up -d --build now?" "y"; then
    run_preflight_and_start
    break
  fi
  edit_menu
  echo
  if ask_yes_no "Return to summary and start prompt?" "y"; then
    continue
  fi
  echo "Skipped start."
  echo "Run later with:"
  echo "  sh scripts/fresh_setup_lxc.sh --start-only"
  break
done
