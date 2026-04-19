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
		APP_DIR="/volume1/docker/fjordshare"
	fi
fi

REPO_URL="${REPO_URL:-https://github.com/qlerup/fjordshare.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
BUILD_ON_DOCKERFILE_CHANGE="${BUILD_ON_DOCKERFILE_CHANGE:-1}"
FORCE_IMAGE_BUILD="${FORCE_IMAGE_BUILD:-0}"
ENV_BACKUP="$(mktemp /tmp/fjordshare.env.backup.XXXXXX)"

if [ ! -d "$APP_DIR" ]; then
	echo "Fejl: APP_DIR findes ikke: $APP_DIR"
	echo "Tip: sat APP_DIR manuelt, fx APP_DIR=/opt/fjordshare $0"
	exit 1
fi

if [ ! -f "$APP_DIR/docker-compose.yml" ]; then
	echo "Fejl: docker-compose.yml blev ikke fundet i APP_DIR: $APP_DIR"
	echo "Tip: kor scriptet fra repo-mappen eller sat APP_DIR manuelt."
	exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
	echo "Fejl: docker kommando blev ikke fundet i PATH."
	exit 1
fi

DOCKER_SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
	DOCKER_SUDO="sudo"
fi

docker_compose() {
	if [ -n "$DOCKER_SUDO" ]; then
		sudo docker compose "$@"
	else
		docker compose "$@"
	fi
}

docker_cmd() {
	if [ -n "$DOCKER_SUDO" ]; then
		sudo docker "$@"
	else
		docker "$@"
	fi
}

cleanup() {
	rm -f "$ENV_BACKUP"
}
trap cleanup EXIT INT TERM

while [ "$#" -gt 0 ]; do
	case "$1" in
		--rebuild-image)
			FORCE_IMAGE_BUILD=1
			;;
		--respect-dockerfile)
			BUILD_ON_DOCKERFILE_CHANGE=1
			;;
		--fast-no-rebuild)
			BUILD_ON_DOCKERFILE_CHANGE=0
			;;
	esac
	shift
done

extract_apt_packages_from_dockerfile() {
	awk '
	BEGIN { in_install=0 }
	{
		line=$0
		if ($0 ~ /apt-get[[:space:]]+install[[:space:]]+-y[[:space:]]+--no-install-recommends/) {
			in_install=1
			sub(/^.*--no-install-recommends[[:space:]]*/, "", line)
		} else if (!in_install) {
			next
		}

		sub(/#.*/, "", line)
		has_end = (line ~ /;/)
		gsub(/[\\;]/, " ", line)

		n=split(line, parts, /[[:space:]]+/)
		for (i=1; i<=n; i++) {
			p=parts[i]
			if (p == "" || p == "apt-get" || p == "install" || p == "-y" || p == "--no-install-recommends") {
				continue
			}
			print p
		}

		if (has_end) {
			in_install=0
		}
	}'
}

install_pkg_list_in_running_container() {
	pkg_file="$1"
	[ -s "$pkg_file" ] || return 0

	docker_compose up -d fjordshare

	tmp_available="$(mktemp /tmp/fjordshare.pkgs.available.XXXXXX)"
	tmp_unavailable="$(mktemp /tmp/fjordshare.pkgs.unavailable.XXXXXX)"

	cat "$pkg_file" | docker_compose exec -T fjordshare sh -lc '
		while IFS= read -r p; do
			[ -n "$p" ] || continue
			if apt-cache show "$p" >/dev/null 2>&1; then
				echo "$p"
			fi
		done
	' | sort -u >"$tmp_available"

	grep -Fxv -f "$tmp_available" "$pkg_file" >"$tmp_unavailable" || true

	if [ -s "$tmp_available" ]; then
		pkgs="$(tr '\n' ' ' <"$tmp_available" | sed 's/[[:space:]]*$//')"
		docker_compose exec -T fjordshare sh -lc "apt-get update && apt-get install -y --no-install-recommends $pkgs && rm -rf /var/lib/apt/lists/*"
	fi

	if [ -s "$tmp_unavailable" ]; then
		echo "==> Kunne ikke finde disse Dockerfile-pakker i containerens apt-repos:"
		cat "$tmp_unavailable"
		echo "==> Sandsynlig distro mismatch i eksisterende container. Kør --rebuild-image for at bygge med Dockerfile base image."
	fi

	rm -f "$tmp_available" "$tmp_unavailable"
}

install_new_dockerfile_packages_fast() {
	old_rev="$1"
	new_rev="$2"

	[ "$DOCKERFILE_CHANGED" -eq 1 ] || return 0
	[ "$BUILD_ON_DOCKERFILE_CHANGE" = "0" ] || return 0
	[ "$FORCE_IMAGE_BUILD" != "1" ] || return 0
	[ -n "$old_rev" ] || return 0

	tmp_old_df="$(mktemp /tmp/fjordshare.df.old.XXXXXX)"
	tmp_new_df="$(mktemp /tmp/fjordshare.df.new.XXXXXX)"
	tmp_old_pkgs="$(mktemp /tmp/fjordshare.pkgs.old.XXXXXX)"
	tmp_new_pkgs="$(mktemp /tmp/fjordshare.pkgs.new.XXXXXX)"
	tmp_added_pkgs="$(mktemp /tmp/fjordshare.pkgs.added.XXXXXX)"

	if ! git show "$new_rev:Dockerfile" >"$tmp_new_df" 2>/dev/null; then
		rm -f "$tmp_old_df" "$tmp_new_df" "$tmp_old_pkgs" "$tmp_new_pkgs" "$tmp_added_pkgs"
		return 0
	fi

	git show "$old_rev:Dockerfile" >"$tmp_old_df" 2>/dev/null || : >"$tmp_old_df"

	extract_apt_packages_from_dockerfile <"$tmp_old_df" | sort -u >"$tmp_old_pkgs"
	extract_apt_packages_from_dockerfile <"$tmp_new_df" | sort -u >"$tmp_new_pkgs"
	grep -Fxv -f "$tmp_old_pkgs" "$tmp_new_pkgs" >"$tmp_added_pkgs" || true

	if [ ! -s "$tmp_added_pkgs" ]; then
		echo "==> Fast mode: Dockerfile ændret, men ingen nye apt-pakker at installere direkte."
		rm -f "$tmp_old_df" "$tmp_new_df" "$tmp_old_pkgs" "$tmp_new_pkgs" "$tmp_added_pkgs"
		return 0
	fi

	echo "==> Fast mode: installerer kun nye Dockerfile-pakker direkte i container"
	install_pkg_list_in_running_container "$tmp_added_pkgs"

	rm -f "$tmp_old_df" "$tmp_new_df" "$tmp_old_pkgs" "$tmp_new_pkgs" "$tmp_added_pkgs"
}

install_missing_dockerfile_packages_fast() {
	[ "$FORCE_IMAGE_BUILD" != "1" ] || return 0
	[ -f Dockerfile ] || return 0

	tmp_pkgs="$(mktemp /tmp/fjordshare.pkgs.current.XXXXXX)"
	tmp_installed="$(mktemp /tmp/fjordshare.pkgs.installed.XXXXXX)"
	tmp_missing="$(mktemp /tmp/fjordshare.pkgs.missing.XXXXXX)"

	extract_apt_packages_from_dockerfile <Dockerfile | sort -u >"$tmp_pkgs"
	if [ ! -s "$tmp_pkgs" ]; then
		rm -f "$tmp_pkgs" "$tmp_installed" "$tmp_missing"
		return 0
	fi

	docker_compose up -d fjordshare
	docker_compose exec -T fjordshare sh -lc "dpkg-query -W -f='\${Package}\n' 2>/dev/null || true" | sort -u >"$tmp_installed"
	grep -Fxv -f "$tmp_installed" "$tmp_pkgs" >"$tmp_missing" || true

	if [ ! -s "$tmp_missing" ]; then
		echo "==> Alle Dockerfile apt-pakker findes allerede i containeren."
		rm -f "$tmp_pkgs" "$tmp_installed" "$tmp_missing"
		return 0
	fi

	echo "==> Installerer manglende Dockerfile apt-pakker i containeren"
	install_pkg_list_in_running_container "$tmp_missing"

	rm -f "$tmp_pkgs" "$tmp_installed" "$tmp_missing"
}

sync_runtime_code_changes() {
	changed_list="$1"
	[ -n "$changed_list" ] || return 0

	echo "==> Synkroniserer kodefiler til kørende container (uden image rebuild)"
	docker_compose up -d fjordshare

	synced_any=0
	synced_static=0
	synced_templates=0

	while IFS= read -r path; do
		[ -n "$path" ] || continue
		case "$path" in
			Dockerfile|docker-compose.yml|requirements.txt|.dockerignore|home/*)
				continue
				;;
			static/*)
				if [ "$synced_static" -eq 0 ] && [ -d static ]; then
					docker_cmd cp static/. fjordshare:/app/static
					synced_static=1
					synced_any=1
				fi
				;;
			templates/*)
				if [ "$synced_templates" -eq 0 ] && [ -d templates ]; then
					docker_cmd cp templates/. fjordshare:/app/templates
					synced_templates=1
					synced_any=1
				fi
				;;
			*)
				if [ -f "$path" ]; then
					dest="/app/$path"
					dest_dir="$(dirname "$dest")"
					docker_compose exec -T fjordshare sh -lc "mkdir -p '$dest_dir'"
					docker_cmd cp "$path" "fjordshare:$dest"
					synced_any=1
				fi
				;;
		esac
	done <<EOF
$changed_list
EOF

	if [ "$synced_any" -eq 1 ]; then
		echo "==> Genstarter fjordshare for at loade ny kode"
		docker_compose restart fjordshare
	fi
}

cd "$APP_DIR" || exit 1
cp .env "$ENV_BACKUP" 2>/dev/null || true

if [ ! -d .git ]; then
	git init
fi

if git remote get-url origin >/dev/null 2>&1; then
	git remote set-url origin "$REPO_URL"
else
	git remote add origin "$REPO_URL"
fi

OLD_REV="$(git rev-parse HEAD 2>/dev/null || echo "")"
git fetch origin "$REPO_BRANCH"
NEW_REV="$(git rev-parse "origin/$REPO_BRANCH")"

if [ -n "$OLD_REV" ] && [ "$OLD_REV" = "$NEW_REV" ] && [ "$FORCE_IMAGE_BUILD" != "1" ]; then
	cp "$ENV_BACKUP" .env 2>/dev/null || true
	docker_compose up -d
	install_missing_dockerfile_packages_fast || true
	docker_compose logs --tail=50
	exit 0
fi

git reset --hard "$NEW_REV"
git clean -fd
cp "$ENV_BACKUP" .env 2>/dev/null || true

CHANGED=""
if [ -n "$OLD_REV" ]; then
	CHANGED="$(git diff --name-only "$OLD_REV" "$NEW_REV")"
fi

NEED_IMAGE_BUILD=0
DOCKERFILE_CHANGED=0

if [ -z "$OLD_REV" ]; then
	NEED_IMAGE_BUILD=1
else
	echo "$CHANGED" | grep -Eq '^Dockerfile$' && DOCKERFILE_CHANGED=1 || true
	echo "$CHANGED" | grep -Eq '^(requirements.txt|docker-compose\.yml|\.dockerignore)$' && NEED_IMAGE_BUILD=1 || true
	if [ "$DOCKERFILE_CHANGED" -eq 1 ] && [ "$BUILD_ON_DOCKERFILE_CHANGE" = "1" ]; then
		NEED_IMAGE_BUILD=1
	fi
fi

if [ "$FORCE_IMAGE_BUILD" = "1" ]; then
	NEED_IMAGE_BUILD=1
fi

if [ "$DOCKERFILE_CHANGED" -eq 1 ] && [ "$BUILD_ON_DOCKERFILE_CHANGE" != "1" ] && [ "$FORCE_IMAGE_BUILD" != "1" ]; then
	echo "==> Dockerfile ændret, men springer image rebuild over (BUILD_ON_DOCKERFILE_CHANGE=0)."
	echo "==> Fast mode installerer i stedet kun nye apt-pakker fundet i Dockerfile-diff direkte i containeren."
	echo "==> Brug --rebuild-image eller sæt BUILD_ON_DOCKERFILE_CHANGE=1 for fuld rebuild."
fi

if [ "$NEED_IMAGE_BUILD" -eq 1 ]; then
	docker_compose up -d --build fjordshare
else
	docker_compose up -d
	install_new_dockerfile_packages_fast "$OLD_REV" "$NEW_REV" || true
	install_missing_dockerfile_packages_fast || true
	sync_runtime_code_changes "$CHANGED" || true
fi

docker_compose logs --tail=50
