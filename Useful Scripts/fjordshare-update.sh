#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

if [ -z "${APP_DIR:-}" ]; then
	if [ -f "$REPO_DIR/docker-compose.yml" ]; then
		APP_DIR="$REPO_DIR"
	elif [ -f "./docker-compose.yml" ]; then
		APP_DIR="$(pwd)"
	else
		APP_DIR="/opt/fjordshare"
	fi
fi

SERVICE_NAME="${SERVICE_NAME:-fjordshare}"
REPO_BRANCH="${REPO_BRANCH:-}"
WAIT_TIMEOUT_SEC="${WAIT_TIMEOUT_SEC:-180}"
WAIT_INTERVAL_SEC="${WAIT_INTERVAL_SEC:-2}"
APP_UID="${APP_UID:-1001}"
APP_GID="${APP_GID:-1001}"
DO_BUILD=1
NO_CACHE=0
SKIP_DB_BACKUP=0
SHOW_LOGS=1
CLEANUP_DOCKER="${CLEANUP_DOCKER:-ask}"

usage() {
	cat <<EOF
Usage: $0 [options]

Normal FjordShare update:
  - backs up .env and fjordshare.db when possible
  - pulls the current Git branch with --ff-only
  - asks whether to run optional Docker cleanup
  - runs docker compose up -d --build
  - waits for /api/health

Options:
  --app-dir DIR        FjordShare app directory (default: auto, then /opt/fjordshare)
  --branch BRANCH     Git branch to pull (default: current branch, then main)
  --no-build          Do not build image; only docker compose up -d
  --no-cache          Rebuild image without Docker cache
  --cleanup           Run optional Docker cleanup without asking
  --no-cleanup        Skip optional Docker cleanup without asking
  --skip-db-backup    Skip SQLite backup before updating
  --no-logs           Do not print recent container logs at the end
  -h, --help          Show this help

Environment:
  APP_DIR, REPO_BRANCH, SERVICE_NAME, WAIT_TIMEOUT_SEC, WAIT_INTERVAL_SEC, CLEANUP_DOCKER, APP_UID, APP_GID
EOF
}

while [ "$#" -gt 0 ]; do
	case "$1" in
		--app-dir)
			if [ "$#" -lt 2 ]; then
				echo "Fejl: --app-dir mangler en mappe."
				exit 1
			fi
			shift
			APP_DIR="$1"
			;;
		--branch)
			if [ "$#" -lt 2 ]; then
				echo "Fejl: --branch mangler et branch-navn."
				exit 1
			fi
			shift
			REPO_BRANCH="$1"
			;;
		--no-build)
			DO_BUILD=0
			;;
		--no-cache)
			NO_CACHE=1
			DO_BUILD=1
			;;
		--cleanup)
			CLEANUP_DOCKER="yes"
			;;
		--no-cleanup)
			CLEANUP_DOCKER="no"
			;;
		--skip-db-backup)
			SKIP_DB_BACKUP=1
			;;
		--no-logs)
			SHOW_LOGS=0
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "Fejl: ukendt option: $1"
			usage
			exit 1
			;;
	esac
	shift
done

need_cmd() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Fejl: $1 blev ikke fundet i PATH."
		exit 1
	fi
}

validate_wait_settings() {
	case "$WAIT_TIMEOUT_SEC" in
		*[!0-9]*|"") WAIT_TIMEOUT_SEC=180 ;;
	esac
	case "$WAIT_INTERVAL_SEC" in
		*[!0-9]*|"") WAIT_INTERVAL_SEC=2 ;;
	esac
	if [ "$WAIT_TIMEOUT_SEC" -le 0 ]; then
		WAIT_TIMEOUT_SEC=180
	fi
	if [ "$WAIT_INTERVAL_SEC" -le 0 ]; then
		WAIT_INTERVAL_SEC=2
	fi
}

docker_compose() {
	if [ -n "${DOCKER_SUDO:-}" ]; then
		sudo docker compose "$@"
	else
		docker compose "$@"
	fi
}

docker_cmd() {
	if [ -n "${DOCKER_SUDO:-}" ]; then
		sudo docker "$@"
	else
		docker "$@"
	fi
}

cleanup_docker_space() {
	echo "==> Rydder Docker build-cache og ubrugte objekter (bevarer volumes/data)"
	docker_cmd builder prune -af || true
	docker_cmd image prune -af || true
	docker_cmd container prune -f || true
	docker_cmd network prune -f || true
	docker_cmd system df || true
}

run_optional_cleanup() {
	case "$CLEANUP_DOCKER" in
		yes|YES|true|TRUE|1)
			cleanup_docker_space
			return 0
			;;
		no|NO|false|FALSE|0)
			echo "==> Springer Docker oprydning over"
			return 0
			;;
		ask|"")
			;;
		*)
			echo "Fejl: CLEANUP_DOCKER skal vaere ask, yes eller no."
			exit 1
			;;
	esac

	if [ ! -t 0 ]; then
		echo "==> Springer Docker oprydning over (ingen interaktiv terminal). Brug --cleanup hvis den skal koeres."
		return 0
	fi

	echo "==> Docker oprydning er valgfri."
	printf "Vil du rydde Docker build-cache og ubrugte objekter nu? Svarer du ja, tager updaten lidt laengere tid. [y/N]: "
	answer=""
	read answer || answer=""
	case "$answer" in
		y|Y|yes|YES|j|J|ja|JA)
			cleanup_docker_space
			;;
		*)
			echo "==> Springer Docker oprydning over"
			;;
	esac
}

read_env_value() {
	key="$1"
	file="$APP_DIR/.env"
	[ -f "$file" ] || return 1
	line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" | tail -n 1 || true)"
	[ -n "$line" ] || return 1
	value="${line#*=}"
	printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//'
}

generate_sms_token_encryption_key() {
	if command -v openssl >/dev/null 2>&1; then
		openssl rand -base64 32 | tr '+/' '-_'
		return 0
	fi
	if command -v python3 >/dev/null 2>&1; then
		python3 - <<'PY'
import base64
import os

print(base64.urlsafe_b64encode(os.urandom(32)).decode("ascii"))
PY
		return 0
	fi
	if command -v python >/dev/null 2>&1; then
		python - <<'PY'
import base64
import os

print(base64.urlsafe_b64encode(os.urandom(32)).decode("ascii"))
PY
		return 0
	fi
	return 1
}

generate_makerworld_credentials_encryption_key() {
	generate_sms_token_encryption_key
}

ensure_sms_token_encryption_key() {
	file="$APP_DIR/.env"
	[ -f "$file" ] || return 0
	current="$(read_env_value SMS_TOKEN_ENCRYPTION_KEY || true)"
	if [ -n "$current" ]; then
		return 0
	fi
	key="$(generate_sms_token_encryption_key)" || {
		echo "Advarsel: kunne ikke generere SMS_TOKEN_ENCRYPTION_KEY. Installér openssl eller python3 for krypteret SMS-token."
		return 0
	}
	tmp="${file}.tmp.$$"
	awk -v key="$key" '
		BEGIN { done = 0 }
		/^[[:space:]]*SMS_TOKEN_ENCRYPTION_KEY[[:space:]]*=/ && done == 0 {
			print "SMS_TOKEN_ENCRYPTION_KEY=" key
			done = 1
			next
		}
		{ print }
		END {
			if (done == 0) {
				print "SMS_TOKEN_ENCRYPTION_KEY=" key
			}
		}
	' "$file" > "$tmp"
	mv "$tmp" "$file"
	echo "==> Tilføjede SMS_TOKEN_ENCRYPTION_KEY til .env"
}

ensure_makerworld_credentials_encryption_key() {
	file="$APP_DIR/.env"
	[ -f "$file" ] || return 0
	current="$(read_env_value MAKERWORLD_CREDENTIALS_ENCRYPTION_KEY || true)"
	if [ -n "$current" ]; then
		return 0
	fi
	key="$(generate_makerworld_credentials_encryption_key)" || {
		echo "Advarsel: kunne ikke generere MAKERWORLD_CREDENTIALS_ENCRYPTION_KEY. Installér openssl eller python3 for krypteret MakerWorld-login."
		return 0
	}
	tmp="${file}.tmp.$$"
	awk -v key="$key" '
		BEGIN { done = 0 }
		/^[[:space:]]*MAKERWORLD_CREDENTIALS_ENCRYPTION_KEY[[:space:]]*=/ && done == 0 {
			print "MAKERWORLD_CREDENTIALS_ENCRYPTION_KEY=" key
			done = 1
			next
		}
		{ print }
		END {
			if (done == 0) {
				print "MAKERWORLD_CREDENTIALS_ENCRYPTION_KEY=" key
			}
		}
	' "$file" > "$tmp"
	mv "$tmp" "$file"
	echo "==> Tilføjede MAKERWORLD_CREDENTIALS_ENCRYPTION_KEY til .env"
}

backup_env_file() {
	data_dir="${DATA_DIR:-$(read_env_value DATA_DIR || printf '%s' '/opt/fjordshare-data/appdata')}"
	backup_dir="$data_dir/backups"
	if [ ! -f "$APP_DIR/.env" ]; then
		return 0
	fi
	if mkdir -p "$backup_dir" 2>/dev/null; then
		backup_path="$backup_dir/fjordshare.env.$TS.bak"
		cp -p "$APP_DIR/.env" "$backup_path"
		echo "==> .env backup: $backup_path"
	else
		backup_path="$APP_DIR/.env.bak.$TS"
		cp -p "$APP_DIR/.env" "$backup_path"
		echo "==> .env backup: $backup_path"
	fi
}

backup_database_from_container() {
	container_id="$(docker_compose ps -q "$SERVICE_NAME" 2>/dev/null || true)"
	[ -n "$container_id" ] || return 1
	state="$(docker_cmd inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
	[ "$state" = "running" ] || return 1

	docker_compose exec -T "$SERVICE_NAME" sh -s <<EOF
set -eu
mkdir -p /data/backups
python - <<PY
import os
import sqlite3

src = "/data/fjordshare.db"
dst = "/data/backups/fjordshare.db.$TS.bak"
if not os.path.exists(src):
    print("Ingen database at backupe endnu")
    raise SystemExit(0)

source = sqlite3.connect(src)
target = sqlite3.connect(dst)
try:
    with target:
        source.backup(target)
finally:
    target.close()
    source.close()
print(dst)
PY
EOF
}

backup_database_from_host() {
	data_dir="${DATA_DIR:-$(read_env_value DATA_DIR || printf '%s' '/opt/fjordshare-data/appdata')}"
	db_path="$data_dir/fjordshare.db"
	backup_dir="$data_dir/backups"
	if [ ! -f "$db_path" ]; then
		echo "==> Ingen database fundet til backup endnu: $db_path"
		return 0
	fi
	mkdir -p "$backup_dir"
	backup_path="$backup_dir/fjordshare.db.$TS.bak"
	cp -p "$db_path" "$backup_path"
	echo "==> Database backup: $backup_path"
}

backup_database() {
	if [ "$SKIP_DB_BACKUP" = "1" ]; then
		echo "==> Springer database-backup over"
		return 0
	fi
	echo "==> Tager database-backup"
	if backup_database_from_container; then
		return 0
	fi
	backup_database_from_host
}

read_host_dir() {
	key="$1"
	default_value="$2"
	current_value=""
	case "$key" in
		DATA_DIR) current_value="${DATA_DIR:-}" ;;
		UPLOADS_HOST_DIR) current_value="${UPLOADS_HOST_DIR:-}" ;;
		THUMBS_HOST_DIR) current_value="${THUMBS_HOST_DIR:-}" ;;
	esac
	if [ -n "$current_value" ]; then
		printf '%s' "$current_value"
		return 0
	fi
	read_env_value "$key" || printf '%s' "$default_value"
}

repair_host_dir_permissions() {
	label="$1"
	host_dir="$2"
	case "$host_dir" in
		/*) ;;
		*)
			echo "Fejl: $label skal vaere en absolut sti: $host_dir"
			exit 1
			;;
	esac

	echo "==> Sikrer skriveadgang til $label: $host_dir"
	mkdir -p "$host_dir"

	if [ "$(id -u)" -eq 0 ]; then
		chown -R "${APP_UID}:${APP_GID}" "$host_dir" 2>/dev/null || {
			echo "Advarsel: kunne ikke chown $host_dir til ${APP_UID}:${APP_GID}."
			echo "Advarsel: hvis mappen ligger paa NFS/CIFS, skal sharet tillade UID/GID ${APP_UID}:${APP_GID} at skrive."
		}
		chmod -R u+rwX "$host_dir" 2>/dev/null || true
	else
		if command -v sudo >/dev/null 2>&1; then
			sudo chown -R "${APP_UID}:${APP_GID}" "$host_dir" 2>/dev/null || true
			sudo chmod -R u+rwX "$host_dir" 2>/dev/null || true
		fi
	fi
}

repair_data_permissions() {
	repair_host_dir_permissions "appdata" "$(read_host_dir DATA_DIR '/opt/fjordshare-data/appdata')"
	repair_host_dir_permissions "uploads" "$(read_host_dir UPLOADS_HOST_DIR '/opt/fjordshare-data/uploads')"
	repair_host_dir_permissions "thumbs" "$(read_host_dir THUMBS_HOST_DIR '/opt/fjordshare-data/thumbs')"
}

wait_for_fjordshare() {
	elapsed=0
	echo "==> Venter paa FjordShare health (timeout ${WAIT_TIMEOUT_SEC}s)"
	while [ "$elapsed" -lt "$WAIT_TIMEOUT_SEC" ]; do
		container_id="$(docker_compose ps -q "$SERVICE_NAME" 2>/dev/null || true)"
		if [ -n "$container_id" ]; then
			state="$(docker_cmd inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
			case "$state" in
				healthy|running)
					if docker_compose exec -T "$SERVICE_NAME" python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health')"; then
						echo "==> FjordShare er klar"
						return 0
					fi
					;;
				unhealthy|exited|dead)
					echo "Fejl: FjordShare status er $state under opstart."
					docker_compose logs --tail=120 "$SERVICE_NAME" || true
					return 1
					;;
			esac
		fi
		sleep "$WAIT_INTERVAL_SEC"
		elapsed=$((elapsed + WAIT_INTERVAL_SEC))
	done

	echo "Fejl: timeout mens FjordShare blev klar."
	docker_compose ps || true
	docker_compose logs --tail=120 "$SERVICE_NAME" || true
	return 1
}

need_cmd docker
need_cmd git
validate_wait_settings

DOCKER_SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
	if ! docker info >/dev/null 2>&1; then
		DOCKER_SUDO="sudo"
	fi
fi

if [ ! -d "$APP_DIR" ]; then
	echo "Fejl: APP_DIR findes ikke: $APP_DIR"
	exit 1
fi

if [ ! -f "$APP_DIR/docker-compose.yml" ]; then
	echo "Fejl: docker-compose.yml blev ikke fundet i APP_DIR: $APP_DIR"
	exit 1
fi

cd "$APP_DIR" || exit 1
TS="$(date +%Y%m%d-%H%M%S)"

echo "==> App directory: $APP_DIR"
docker_compose config >/dev/null

if [ ! -d .git ]; then
	echo "Fejl: $APP_DIR er ikke et git repository."
	echo "Tip: kontroller APP_DIR, eller klon FjordShare repoet igen i denne mappe."
	exit 1
fi

dirty="$(git status --porcelain --untracked-files=no)"
if [ -n "$dirty" ]; then
	echo "Fejl: der er lokale tracked aendringer i $APP_DIR."
	echo "Commit/stash dem foerst, eller ret mappen manuelt foer update koeres igen."
	git status --short --untracked-files=no
	exit 1
fi

if [ -z "$REPO_BRANCH" ]; then
	REPO_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
	if [ -z "$REPO_BRANCH" ] || [ "$REPO_BRANCH" = "HEAD" ]; then
		REPO_BRANCH="main"
	fi
fi

OLD_REV="$(git rev-parse HEAD 2>/dev/null || true)"

backup_env_file
ensure_sms_token_encryption_key
ensure_makerworld_credentials_encryption_key
backup_database
repair_data_permissions

echo "==> Henter seneste kode fra origin/$REPO_BRANCH"
git fetch origin "$REPO_BRANCH"
git merge --ff-only "origin/$REPO_BRANCH"

NEW_REV="$(git rev-parse HEAD 2>/dev/null || true)"
if [ -n "$OLD_REV" ] && [ "$OLD_REV" = "$NEW_REV" ]; then
	echo "==> Ingen nye commits. Sikrer at containeren koerer."
else
	echo "==> Opdateret: ${OLD_REV:-unknown} -> $NEW_REV"
fi

run_optional_cleanup

if [ "$NO_CACHE" = "1" ]; then
	echo "==> Bygger uden Docker cache"
	docker_compose build --no-cache "$SERVICE_NAME"
	echo "==> Starter FjordShare"
	docker_compose up -d "$SERVICE_NAME"
elif [ "$DO_BUILD" = "1" ]; then
	echo "==> Bygger og starter FjordShare"
	docker_compose up -d --build "$SERVICE_NAME"
else
	echo "==> Starter FjordShare uden build"
	docker_compose up -d "$SERVICE_NAME"
fi

wait_for_fjordshare

echo "==> Status"
docker_compose ps

if [ "$SHOW_LOGS" = "1" ]; then
	echo "==> Seneste logs"
	docker_compose logs --tail=50 "$SERVICE_NAME"
fi
