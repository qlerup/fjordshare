FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONUTF8=1 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

ARG TUS_JS_VERSION=4.2.3
ARG BAMBUSTUDIO_APPIMAGE_URL=
ARG BAMBUSTUDIO_RELEASES_API=https://api.github.com/repos/bambulab/BambuStudio/releases/latest
ARG BAMBUSTUDIO_STRICT_LIB_CHECK=0

WORKDIR /app

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        libasound2 \
        libdbus-1-3 \
        libdrm2 \
        libegl1 \
        libfontconfig1 \
        libfreetype6 \
        libgbm1 \
        libglib2.0-0 \
        libglu1-mesa \
        libgtk-3-0 \
        libpangoft2-1.0-0 \
        libgl1 \
        libharfbuzz0b \
        libice6 \
        libnss3 \
        libopengl0 \
        libpulse0 \
        libsm6 \
        libwayland-client0 \
        libwayland-cursor0 \
        libwayland-egl1 \
        libx11-6 \
        libx11-xcb1 \
        libxcb-cursor0 \
        libxcb-icccm4 \
        libxcb-image0 \
        libxcb-keysyms1 \
        libxcb-randr0 \
        libxcb-render-util0 \
        libxcb-shape0 \
        libxcb-shm0 \
        libxcb-sync1 \
        libxcb-xfixes0 \
        libxcb-xinerama0 \
        libxcb-xkb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxinerama1 \
        libxkbcommon-x11-0 \
        libxkbcommon0 \
        libxrandr2 \
        libxrender1 \
        assimp-utils; \
    mkdir -p /opt/bambu-studio; \
    appimage_url="${BAMBUSTUDIO_APPIMAGE_URL}"; \
    if [ -z "$appimage_url" ]; then \
        arch="$(dpkg --print-architecture)"; \
        release_json="$(curl -fsSL "${BAMBUSTUDIO_RELEASES_API}")"; \
        asset_urls="$(printf '%s' "$release_json" | grep -oE 'https://[^\"]+\.AppImage' | tr -d '\r' || true)"; \
        if [ "$arch" = "amd64" ]; then \
            appimage_url="$(printf '%s\n' "$asset_urls" | grep -Ei '(amd64|x86_64|linux_ubuntu|linux_fedora)' | head -n1 || true)"; \
        elif [ "$arch" = "arm64" ]; then \
            appimage_url="$(printf '%s\n' "$asset_urls" | grep -Ei '(arm64|aarch64)' | head -n1 || true)"; \
        fi; \
        if [ -z "$appimage_url" ]; then \
            appimage_url="$(printf '%s\n' "$asset_urls" | head -n1 || true)"; \
        fi; \
    fi; \
    appimage_url="$(printf '%s' "$appimage_url" | tr -d '\r\n')"; \
    if [ -z "$appimage_url" ]; then \
        echo "Kunne ikke finde BambuStudio AppImage URL. Sæt BAMBUSTUDIO_APPIMAGE_URL som build-arg." >&2; \
        exit 1; \
    fi; \
    curl -fL "$appimage_url" -o /opt/bambu-studio/BambuStudio.AppImage; \
    chmod +x /opt/bambu-studio/BambuStudio.AppImage; \
    cd /opt/bambu-studio; \
    ./BambuStudio.AppImage --appimage-extract >/dev/null; \
    mv squashfs-root appdir; \
    check_targets=""; \
    for target in /opt/bambu-studio/appdir/AppRun /opt/bambu-studio/appdir/bin/bambu-studio; do \
        if [ -f "$target" ]; then \
            check_targets="$check_targets $target"; \
        fi; \
    done; \
    missing_libs=""; \
    if [ -n "$check_targets" ]; then \
        missing_libs="$(for target in $check_targets; do ldd "$target" 2>/dev/null | awk '/not found/{print $1}'; done | sort -u)"; \
    fi; \
    if [ -n "$missing_libs" ]; then \
        echo "BambuStudio core-binary mangler delte biblioteker:" >&2; \
        echo "$missing_libs" >&2; \
        if [ "${BAMBUSTUDIO_STRICT_LIB_CHECK}" = "1" ]; then \
            exit 1; \
        fi; \
    fi; \
    ln -sf /opt/bambu-studio/appdir/AppRun /usr/local/bin/bambu-studio; \
    ln -sf /usr/local/bin/bambu-studio /usr/local/bin/BambuStudio; \
    rm -f /opt/bambu-studio/BambuStudio.AppImage; \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -U pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/static/vendor \
    && curl -fsSL "https://cdn.jsdelivr.net/npm/tus-js-client@${TUS_JS_VERSION}/dist/tus.min.js" \
       -o /app/static/vendor/tus.min.js

EXPOSE 8080

CMD ["gunicorn", "--workers", "1", "--worker-class", "gthread", "--threads", "8", "--timeout", "120", "--bind", "0.0.0.0:8080", "wsgi:application"]



