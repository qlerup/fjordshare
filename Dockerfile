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
        libavcodec61 \
        libavutil59 \
        libfontconfig1 \
        libfreetype6 \
        libgbm1 \
        libglib2.0-0 \
        libgstreamer-plugins-base1.0-0 \
        libgstreamer1.0-0 \
        libglu1-mesa \
        libgtk-3-0 \
        libosmesa6 \
        libpangoft2-1.0-0 \
        libgl1 \
        libharfbuzz0b \
        libice6 \
        libnss3 \
        libopengl0 \
        libpulse0 \
        libsm6 \
        libswscale8 \
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
    pick_first_available() { \
        for pkg in "$@"; do \
            if apt-cache show "$pkg" >/dev/null 2>&1; then \
                printf '%s' "$pkg"; \
                return 0; \
            fi; \
        done; \
        return 1; \
    }; \
    has_file_match() { \
        for pattern in "$@"; do \
            for f in $pattern; do \
                if [ -e "$f" ]; then \
                    return 0; \
                fi; \
            done; \
        done; \
        return 1; \
    }; \
    js40_pkg="$(pick_first_available libjavascriptcoregtk-4.0-18t64 libjavascriptcoregtk-4.0-18 || true)"; \
    wk40_pkg="$(pick_first_available libwebkit2gtk-4.0-37t64 libwebkit2gtk-4.0-37 || true)"; \
    js41_pkg="$(pick_first_available libjavascriptcoregtk-4.1-0t64 libjavascriptcoregtk-4.1-0 || true)"; \
    wk41_pkg="$(pick_first_available libwebkit2gtk-4.1-0t64 libwebkit2gtk-4.1-0 || true)"; \
    js60_pkg="$(pick_first_available libjavascriptcoregtk-6.0-1t64 libjavascriptcoregtk-6.0-1 || true)"; \
    wk60_pkg="$(pick_first_available libwebkitgtk-6.0-4t64 libwebkitgtk-6.0-4 || true)"; \
    runtime_wk_major=""; \
    runtime_js_major=""; \
    runtime_js_pkg=""; \
    runtime_wk_pkg=""; \
    if [ -n "$wk40_pkg" ]; then \
        runtime_wk_major="4.0"; \
        runtime_wk_pkg="$wk40_pkg"; \
    elif [ -n "$wk41_pkg" ]; then \
        runtime_wk_major="4.1"; \
        runtime_wk_pkg="$wk41_pkg"; \
    elif [ -n "$wk60_pkg" ]; then \
        runtime_wk_major="6.0"; \
        runtime_wk_pkg="$wk60_pkg"; \
    else \
        echo "Fejl: Ingen kompatibel WebKit runtime fundet i apt repo." >&2; \
        exit 1; \
    fi; \
    if [ -n "$js40_pkg" ]; then \
        runtime_js_major="4.0"; \
        runtime_js_pkg="$js40_pkg"; \
    elif [ "$runtime_wk_major" = "4.1" ] && [ -n "$js41_pkg" ]; then \
        runtime_js_major="4.1"; \
        runtime_js_pkg="$js41_pkg"; \
    elif [ "$runtime_wk_major" = "6.0" ] && [ -n "$js60_pkg" ]; then \
        runtime_js_major="6.0"; \
        runtime_js_pkg="$js60_pkg"; \
    elif [ -n "$js41_pkg" ]; then \
        runtime_js_major="4.1"; \
        runtime_js_pkg="$js41_pkg"; \
    elif [ -n "$js60_pkg" ]; then \
        runtime_js_major="6.0"; \
        runtime_js_pkg="$js60_pkg"; \
    else \
        echo "Fejl: Ingen kompatibel JavaScriptCore runtime fundet i apt repo." >&2; \
        exit 1; \
    fi; \
    if [ "$runtime_wk_major" = "4.0" ]; then \
        runtime_soup_pkg="$(pick_first_available libsoup2.4-1t64 libsoup2.4-1 || true)"; \
    else \
        runtime_soup_pkg="$(pick_first_available libsoup-3.0-0t64 libsoup-3.0-0 || true)"; \
    fi; \
    if [ -z "$runtime_soup_pkg" ]; then \
        echo "Fejl: Kunne ikke finde passende libsoup runtime for WebKit $runtime_wk_major" >&2; \
        exit 1; \
    fi; \
    apt-get install -y --no-install-recommends "$runtime_js_pkg" "$runtime_wk_pkg" "$runtime_soup_pkg"; \
    ldconfig; \
    if [ "$runtime_js_major" = "4.1" ]; then \
        js_src_glob='/usr/lib/*/libjavascriptcoregtk-4.1.so.0'; \
    elif [ "$runtime_js_major" = "6.0" ]; then \
        js_src_glob='/usr/lib/*/libjavascriptcoregtk-6.0.so.1'; \
    else \
        js_src_glob=''; \
    fi; \
    if [ "$runtime_wk_major" = "4.1" ]; then \
        wk_src_glob='/usr/lib/*/libwebkit2gtk-4.1.so.0'; \
    elif [ "$runtime_wk_major" = "6.0" ]; then \
        wk_src_glob='/usr/lib/*/libwebkitgtk-6.0.so.4'; \
    else \
        wk_src_glob=''; \
    fi; \
    if [ "$runtime_js_major" != "4.0" ]; then \
        if ! ldconfig -p | grep -q 'libjavascriptcoregtk-4.0.so.18'; then \
            for src in $js_src_glob; do \
                if [ -f "$src" ]; then \
                    ln -sf "$src" "$(dirname "$src")/libjavascriptcoregtk-4.0.so.18"; \
                    break; \
                fi; \
            done; \
        fi; \
    fi; \
    if [ "$runtime_wk_major" != "4.0" ]; then \
        if ! ldconfig -p | grep -q 'libwebkit2gtk-4.0.so.37'; then \
            for src in $wk_src_glob; do \
                if [ -f "$src" ]; then \
                    ln -sf "$src" "$(dirname "$src")/libwebkit2gtk-4.0.so.37"; \
                    break; \
                fi; \
            done; \
        fi; \
        ldconfig; \
    fi; \
    if ! ldconfig -p | grep -q 'libjavascriptcoregtk-4.0.so.18' && ! has_file_match /usr/lib/*/libjavascriptcoregtk-4.0.so.18 /usr/local/lib/libjavascriptcoregtk-4.0.so.18; then \
        echo "Fejl: Mangler libjavascriptcoregtk-4.0.so.18 efter runtime setup." >&2; \
        exit 1; \
    fi; \
    if ! ldconfig -p | grep -q 'libwebkit2gtk-4.0.so.37' && ! has_file_match /usr/lib/*/libwebkit2gtk-4.0.so.37 /usr/local/lib/libwebkit2gtk-4.0.so.37; then \
        echo "Fejl: Mangler libwebkit2gtk-4.0.so.37 efter runtime setup." >&2; \
        exit 1; \
    fi; \
    ldconfig; \
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
    if [ -f /opt/bambu-studio/appdir/AppRun ]; then \
        check_targets="/opt/bambu-studio/appdir/AppRun"; \
    fi; \
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
    if [ -f /opt/bambu-studio/appdir/bin/bambu-studio-console ]; then \
        ln -sf /opt/bambu-studio/appdir/bin/bambu-studio-console /usr/local/bin/bambu-studio-console; \
        ln -sf /usr/local/bin/bambu-studio-console /usr/local/bin/BambuStudio-console; \
    fi; \
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



