from __future__ import annotations

import base64
import configparser
import hashlib
import json
import math
import mimetypes
import os
import queue as queue_mod
import re
import secrets
import shutil
import sqlite3
import subprocess
import tempfile
import threading
import zipfile
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Optional, Tuple

from flask import (
    Flask,
    jsonify,
    make_response,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)
from flask_login import (
    LoginManager,
    UserMixin,
    current_user,
    login_required,
    login_user,
    logout_user,
)
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from PIL import Image, ImageOps
except Exception:
    Image = None
    ImageOps = None

try:
    from pillow_heif import register_heif_opener
except Exception:
    register_heif_opener = None

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", ROOT_DIR / "data")).resolve()
_UPLOAD_ROOT_ENV = str(os.getenv("UPLOAD_ROOT", os.getenv("UPLOAD_DIR", "")) or "").strip()
_THUMBS_DIR_ENV = str(os.getenv("THUMBS_DIR", os.getenv("THUMB_DIR", "")) or "").strip()
BAMBU_DIR = DATA_DIR / "bambu"
BAMBU_SLICE_DEBUG_DIR = BAMBU_DIR / "slice-debug"
UPLOAD_ROOT = Path(_UPLOAD_ROOT_ENV or str(DATA_DIR / "uploads")).resolve()
TUS_TMP_DIR = DATA_DIR / "tus_uploads"
THUMBS_DIR = Path(_THUMBS_DIR_ENV or str(DATA_DIR / "thumbs")).resolve()
FILE_ATTACHMENTS_DIR = DATA_DIR / "file_attachments"
DB_PATH = DATA_DIR / "fjordshare.db"
SLICER_PROFILE_DIR = BAMBU_DIR / "profiles"
BAMBU_SLICED_DIR = BAMBU_DIR / "sliced"
SLICER_PROFILE_PRINTER_DIR = SLICER_PROFILE_DIR / "printer_profiles"
SLICER_PROFILE_PRINT_SETTINGS_DIR = SLICER_PROFILE_DIR / "printer_print_settings"
SLICER_PROFILE_FILAMENT_DIR = SLICER_PROFILE_DIR / "filament_profiles"
SLICER_PROFILE_CONFIG_DIR = SLICER_PROFILE_DIR / "config_bundle"
SLICER_PROFILE_MACHINE_PATH = SLICER_PROFILE_PRINTER_DIR / "machine.json"
SLICER_PROFILE_PROCESS_PATH = SLICER_PROFILE_PRINT_SETTINGS_DIR / "process.json"
SLICER_PROFILE_FILAMENT_PATH = SLICER_PROFILE_FILAMENT_DIR / "filament.json"
SLICER_PROFILE_CONFIG_PATH = SLICER_PROFILE_CONFIG_DIR / "config.ini"
SLICER_PROFILE_LEGACY_MACHINE_PATH = SLICER_PROFILE_DIR / "machine.json"
SLICER_PROFILE_LEGACY_PROCESS_PATH = SLICER_PROFILE_DIR / "process.json"
SLICER_PROFILE_LEGACY_FILAMENT_PATH = SLICER_PROFILE_DIR / "filament.json"
SLICER_PROFILE_LEGACY_CONFIG_PATH = SLICER_PROFILE_DIR / "config.ini"
SLICER_PROFILE_ALLOWED_CONFIG_EXTS = {".ini", ".cfg", ".conf", ".txt"}
SLICER_PROFILE_MAX_BYTES = int(str(os.getenv("SLICER_PROFILE_MAX_BYTES", str(5 * 1024 * 1024))) or str(5 * 1024 * 1024))
SLICER_PLATE_ASSET_DIR = ROOT_DIR / "static" / "slicer-plates"
SLICER_PLATE_ASSET_ALLOWED_EXTS = {".stl", ".obj", ".glb", ".gltf", ".3mf"}

PERMISSION_RANK = {"view": 1, "upload": 2, "manage": 3}
RANK_PERMISSION = {v: k for (k, v) in PERMISSION_RANK.items()}

THREE_D_EXTENSIONS = {".glb", ".gltf", ".stl", ".obj", ".ply", ".3mf", ".fbx", ".step", ".stp"}
THREE_D_VIEWER_EXTENSIONS = {".glb", ".gltf", ".stl", ".obj"}
THREE_D_THUMBNAIL_EXTENSIONS = {".glb", ".gltf"}
THUMBABLE_3D_EXTENSIONS = {".glb", ".gltf", ".stl", ".obj", ".step", ".stp"}
THUMB_RENDER_FACE_LIMIT = 200_000
THUMB_SIZE_PX = int(str(os.getenv("THUMB_SIZE_PX", "480")) or "480")
THUMB_RENDER_STYLE_VERSION = "7"
SLICABLE_3D_EXTENSIONS = {".stl"}
BAMBUSTUDIO_BIN = str(os.getenv("BAMBUSTUDIO_BIN", "bambu-studio")).strip() or "bambu-studio"
BAMBUSTUDIO_CONFIG_PATH = str(os.getenv("BAMBUSTUDIO_CONFIG_PATH", "")).strip()
BAMBUSTUDIO_PROFILE_ROOT = str(os.getenv("BAMBUSTUDIO_PROFILE_ROOT", "")).strip()
BAMBUSTUDIO_PRINTER_PROFILES = str(os.getenv("BAMBUSTUDIO_PRINTER_PROFILES", "")).strip()
BAMBUSTUDIO_PRINT_PROFILES = str(os.getenv("BAMBUSTUDIO_PRINT_PROFILES", "")).strip()
BAMBUSTUDIO_FILAMENT_PROFILES = str(os.getenv("BAMBUSTUDIO_FILAMENT_PROFILES", "")).strip()
BAMBUSTUDIO_LOAD_SETTINGS = str(os.getenv("BAMBUSTUDIO_LOAD_SETTINGS", "")).strip()
BAMBUSTUDIO_LOAD_FILAMENTS = str(os.getenv("BAMBUSTUDIO_LOAD_FILAMENTS", "")).strip()
BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK = str(os.getenv("BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK", "0")).strip().lower() in {"1", "true", "yes", "on"}
BAMBUSTUDIO_SLICE_DEBUG_ALWAYS = str(os.getenv("BAMBUSTUDIO_SLICE_DEBUG_ALWAYS", "0")).strip().lower() in {"1", "true", "yes", "on"}
BAMBUSTUDIO_SLICE_DEBUG_MAX_EVENTS = 400
SLICER_PRINTER_BED_MAP_SETTING_KEY = "slicer_printer_bed_map_v1"
SLICER_PRINTER_BED_HIDDEN_SETTING_KEY = "slicer_printer_bed_hidden_v1"
try:
    BAMBUSTUDIO_TIMEOUT_SEC = max(60, int(str(os.getenv("BAMBUSTUDIO_TIMEOUT_SEC", "1800")) or "1800"))
except Exception:
    BAMBUSTUDIO_TIMEOUT_SEC = 1800
try:
    _attempt_timeout_default = min(BAMBUSTUDIO_TIMEOUT_SEC, 420)
    BAMBUSTUDIO_ATTEMPT_TIMEOUT_SEC = max(
        30,
        int(str(os.getenv("BAMBUSTUDIO_ATTEMPT_TIMEOUT_SEC", str(_attempt_timeout_default))) or str(_attempt_timeout_default)),
    )
except Exception:
    BAMBUSTUDIO_ATTEMPT_TIMEOUT_SEC = min(BAMBUSTUDIO_TIMEOUT_SEC, 420)
try:
    BAMBUSTUDIO_MAX_RETRY_EVENTS = max(1, int(str(os.getenv("BAMBUSTUDIO_MAX_RETRY_EVENTS", "12")) or "12"))
except Exception:
    BAMBUSTUDIO_MAX_RETRY_EVENTS = 12
FILE_ATTACHMENT_MAX_BYTES = int(str(os.getenv("FILE_ATTACHMENT_MAX_BYTES", str(20 * 1024 * 1024))) or str(20 * 1024 * 1024))
FILE_ATTACHMENT_ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"}
FILE_ATTACHMENT_MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/avif": ".avif",
}
FILE_ATTACHMENT_HEIC_EXTS = {".heic", ".heif"}
FILE_ATTACHMENT_HEIC_MIME_TYPES = {
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
    "application/heic",
    "application/heif",
}
ZIP_UPLOAD_MAX_FILES = int(str(os.getenv("ZIP_UPLOAD_MAX_FILES", "10000")) or "10000")
ZIP_UPLOAD_MAX_UNCOMPRESSED_BYTES = int(str(os.getenv("ZIP_UPLOAD_MAX_UNCOMPRESSED_BYTES", str(2 * 1024 * 1024 * 1024))) or str(2 * 1024 * 1024 * 1024))
_startup_build = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
APP_BUILD = str(os.getenv("APP_BUILD", _startup_build)).strip() or _startup_build
UI_VERSION_MARKER = str(os.getenv("UI_VERSION_MARKER", "TMP-2026-04-12-07")).strip() or "TMP-2026-04-12-07"
ACTIVITY_LOG_LIMIT_DEFAULT = 200
ACTIVITY_LOG_LIMIT_MAX = 1000
ACTIVITY_KIND_LABELS = {
    "upload": "Upload",
    "thumbnail": "Thumbnail",
    "slice": "Slice",
    "zip": "ZIP",
    "delete": "Slet",
    "folder": "Mappe",
    "system": "System",
}

HEIC_CONVERSION_AVAILABLE = bool(Image and ImageOps and register_heif_opener)
if HEIC_CONVERSION_AVAILABLE:
    try:
        register_heif_opener()
    except Exception:
        HEIC_CONVERSION_AVAILABLE = False

THUMB_QUEUE: "queue_mod.Queue[int]" = queue_mod.Queue()
THUMB_QUEUE_LOCK = threading.Lock()
THUMB_QUEUED_IDS: set[int] = set()
THUMB_WORKER_LOCK = threading.Lock()
THUMB_WORKER_STARTED = False
SLICE_QUEUE: "queue_mod.Queue[Dict[str, Any]]" = queue_mod.Queue()
SLICE_QUEUE_LOCK = threading.Lock()
SLICE_QUEUED_IDS: set[int] = set()
SLICE_WORKER_LOCK = threading.Lock()
SLICE_WORKER_STARTED = False
ZIP_EXTRACT_QUEUE: "queue_mod.Queue[Dict[str, Any]]" = queue_mod.Queue()
ZIP_EXTRACT_WORKER_LOCK = threading.Lock()
ZIP_EXTRACT_WORKER_STARTED = False


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _slicer_profile_dirs() -> dict[str, Path]:
    return {
        "machine": SLICER_PROFILE_PRINTER_DIR,
        "process": SLICER_PROFILE_PRINT_SETTINGS_DIR,
        "filament": SLICER_PROFILE_FILAMENT_DIR,
        "config": SLICER_PROFILE_CONFIG_DIR,
    }


def _slicer_profile_allowed_exts(kind: str) -> set[str]:
    key = str(kind or "").strip().lower()
    if key in {"machine", "process", "filament"}:
        return {".json"}
    if key == "config":
        return set(SLICER_PROFILE_ALLOWED_CONFIG_EXTS)
    return set()


def _slicer_profile_name_keys(kind: str) -> tuple[str, ...]:
    key = str(kind or "").strip().lower()
    if key == "machine":
        return ("printer_settings_id", "name", "inherits", "setting_id")
    if key == "process":
        return ("inherits", "print_settings_id", "process_settings_id", "setting_id", "name")
    if key == "filament":
        return ("filament_settings_id", "setting_id", "name", "inherits", "filament_id")
    return ("name", "inherits", "setting_id")


def _slicer_profile_name_from_value(value: Any) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()

    if isinstance(value, (list, tuple)):
        for item in value:
            parsed = _slicer_profile_name_from_value(item)
            if parsed:
                return parsed
        return ""

    if isinstance(value, dict):
        for key in (
            "name",
            "id",
            "value",
            "setting_id",
            "printer_settings_id",
            "print_settings_id",
            "filament_settings_id",
            "inherits",
        ):
            parsed = _slicer_profile_name_from_value(value.get(key))
            if parsed:
                return parsed

    return ""


def _slicer_profile_names_from_value(value: Any) -> list[str]:
    names: list[str] = []

    def _walk(node: Any) -> None:
        if isinstance(node, str):
            text = node.strip()
            if text:
                names.append(text)
            return

        if isinstance(node, (list, tuple, set)):
            for item in node:
                _walk(item)
            return

        if isinstance(node, dict):
            # Prefer explicit inheritance/value keys when payload uses structured entries.
            for key in (
                "inherits",
                "from",
                "name",
                "id",
                "value",
                "setting_id",
                "printer_settings_id",
                "print_settings_id",
                "filament_settings_id",
            ):
                if key in node:
                    _walk(node.get(key))

    _walk(value)
    return _dedupe_preserve_order(name for name in names if str(name or "").strip())


def _slicer_profile_json_type(kind: str) -> str:
    key = str(kind or "").strip().lower()
    if key in {"machine", "process", "filament"}:
        return key
    return ""


def _read_upload_json_payload(upload: Any) -> Optional[dict[str, Any]]:
    stream = getattr(upload, "stream", None)
    if stream is None:
        return None

    pos = 0
    text = ""
    try:
        pos = int(stream.tell())
    except Exception:
        pos = 0

    try:
        stream.seek(0)
        raw = stream.read()
        if isinstance(raw, bytes):
            text = raw.decode("utf-8-sig", errors="ignore")
        else:
            text = str(raw)
    except Exception:
        text = ""
    finally:
        try:
            stream.seek(pos)
        except Exception:
            pass

    if not text:
        return None

    try:
        payload = json.loads(text)
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None

    return payload


def _extract_slicer_profile_name_from_payload(payload: dict[str, Any], kind: str) -> str:
    for field in _slicer_profile_name_keys(kind):
        value = payload.get(field)
        parsed = _slicer_profile_name_from_value(value)
        if parsed:
            return parsed
    return ""


def _extract_slicer_profile_name_from_upload_json(upload: Any, kind: str) -> str:
    payload = _read_upload_json_payload(upload)
    if payload is None:
        return ""
    return _extract_slicer_profile_name_from_payload(payload, kind)


def _normalize_uploaded_profile_json_bytes(payload: dict[str, Any], kind: str) -> bytes:
    normalized = dict(payload)

    expected_type = _slicer_profile_json_type(kind)
    if expected_type:
        normalized["type"] = expected_type

    from_value = normalized.get("from")
    if isinstance(from_value, str) and from_value.strip():
        normalized["from"] = from_value.strip().lower()
    elif expected_type:
        normalized["from"] = "user"

    if expected_type == "process":
        process_compatible = _string_values_from_any(normalized.get("compatible_printers"))
        uploaded_machine_names = _uploaded_machine_profile_names()
        if uploaded_machine_names:
            merged = _dedupe_preserve_order([*process_compatible, *uploaded_machine_names])
            if merged:
                normalized["compatible_printers"] = merged

    return (json.dumps(normalized, ensure_ascii=False, indent=4) + "\n").encode("utf-8")


def _normalize_existing_uploaded_profile_json_files() -> None:
    for kind, profile_dir in (
        ("machine", SLICER_PROFILE_PRINTER_DIR),
        ("process", SLICER_PROFILE_PRINT_SETTINGS_DIR),
        ("filament", SLICER_PROFILE_FILAMENT_DIR),
    ):
        for profile_path in _list_slicer_profile_files(profile_dir, {".json"}):
            temp_path = profile_path.with_suffix(f"{profile_path.suffix}.tmp")
            try:
                text = profile_path.read_text(encoding="utf-8-sig", errors="ignore")
                payload = json.loads(text)
                if not isinstance(payload, dict):
                    continue

                normalized_bytes = _normalize_uploaded_profile_json_bytes(payload, kind)
                try:
                    current_bytes = profile_path.read_bytes()
                    if current_bytes == normalized_bytes:
                        continue
                except Exception:
                    pass

                with temp_path.open("wb") as fh:
                    fh.write(normalized_bytes)
                temp_path.replace(profile_path)
            except Exception:
                try:
                    temp_path.unlink(missing_ok=True)
                except Exception:
                    pass


def _json_profile_filename_from_payload_name(payload_name: str) -> str:
    raw = str(payload_name or "").strip()
    if not raw:
        return ""
    parsed = Path(raw)
    base = str(parsed.stem or raw).strip() if parsed.suffix.lower() == ".json" else raw
    if not base:
        return ""
    name = sanitize_filename(f"{base}.json")
    if str(Path(name).suffix or "").lower() != ".json":
        name = sanitize_filename(f"{Path(name).stem}.json")
    return name


def _dedupe_filename_for_request(filename: str, used_names: set[str]) -> str:
    ext = str(Path(filename).suffix or "")
    if not ext:
        ext = ".json"
    base = str(Path(filename).stem or f"profil-{secrets.token_hex(3)}").strip() or f"profil-{secrets.token_hex(3)}"
    candidate = sanitize_filename(f"{base}{ext}")
    idx = 2
    while candidate.lower() in used_names:
        candidate = sanitize_filename(f"{base}-{idx}{ext}")
        idx += 1
    used_names.add(candidate.lower())
    return candidate


def _list_slicer_profile_files(profile_dir: Path, allowed_exts: Optional[set[str]] = None) -> list[Path]:
    try:
        files = [p for p in profile_dir.iterdir() if p.is_file()]
    except Exception:
        return []

    out: list[Path] = []
    for path in files:
        ext = str(path.suffix or "").lower()
        if allowed_exts and ext not in allowed_exts:
            continue
        out.append(path)

    out.sort(key=lambda p: p.name.lower())
    return out


def _latest_slicer_profile_file(paths: Iterable[Path]) -> Optional[Path]:
    latest_path: Optional[Path] = None
    latest_mtime = float("-inf")
    for path in paths:
        try:
            mtime = float(path.stat().st_mtime)
        except Exception:
            continue
        if mtime > latest_mtime:
            latest_mtime = mtime
            latest_path = path
    return latest_path


def _effective_bambustudio_config_path() -> str:
    configured = str(BAMBUSTUDIO_CONFIG_PATH or "").strip()
    return configured if configured else ""


def _effective_bambustudio_load_settings() -> str:
    configured = str(BAMBUSTUDIO_LOAD_SETTINGS or "").strip()
    if configured:
        return configured
    return ""


def _effective_bambustudio_load_filaments() -> str:
    configured = str(BAMBUSTUDIO_LOAD_FILAMENTS or "").strip()
    if configured:
        return configured
    return ""


def _slicer_profile_meta(profile_dir: Path, allowed_exts: Optional[set[str]] = None) -> dict[str, Any]:
    files = _list_slicer_profile_files(profile_dir, allowed_exts)
    total_size = 0
    updated_at = ""
    latest_file = _latest_slicer_profile_file(files)
    if latest_file is not None:
        try:
            stat = latest_file.stat()
            updated_at = datetime.fromtimestamp(stat.st_mtime, timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        except Exception:
            updated_at = ""

    file_items: list[dict[str, Any]] = []
    for file_path in files:
        file_size = 0
        file_updated = ""
        try:
            stat = file_path.stat()
            file_size = max(0, int(stat.st_size))
            file_updated = datetime.fromtimestamp(stat.st_mtime, timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        except Exception:
            file_size = 0
            file_updated = ""

        total_size += file_size
        if len(file_items) < 25:
            file_items.append(
                {
                    "name": file_path.name,
                    "path": str(file_path),
                    "size": file_size,
                    "updated_at": file_updated,
                }
            )

    return {
        "path": str(profile_dir),
        "exists": bool(files),
        "size": total_size,
        "updated_at": updated_at,
        "count": len(files),
        "omitted": max(0, len(files) - len(file_items)),
        "files": file_items,
    }


def _migrate_legacy_slicer_profile_files() -> None:
    legacy_mappings = (
        (SLICER_PROFILE_LEGACY_MACHINE_PATH, SLICER_PROFILE_MACHINE_PATH),
        (SLICER_PROFILE_LEGACY_PROCESS_PATH, SLICER_PROFILE_PROCESS_PATH),
        (SLICER_PROFILE_LEGACY_FILAMENT_PATH, SLICER_PROFILE_FILAMENT_PATH),
        (SLICER_PROFILE_LEGACY_CONFIG_PATH, SLICER_PROFILE_CONFIG_PATH),
    )
    for legacy_path, target_path in legacy_mappings:
        if not legacy_path.exists() or not legacy_path.is_file():
            continue
        if target_path.exists() and target_path.is_file():
            continue
        try:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            legacy_path.replace(target_path)
        except Exception:
            continue


def _ensure_storage_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    BAMBU_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    TUS_TMP_DIR.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    FILE_ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)
    SLICER_PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    BAMBU_SLICED_DIR.mkdir(parents=True, exist_ok=True)
    SLICER_PROFILE_PRINTER_DIR.mkdir(parents=True, exist_ok=True)
    SLICER_PROFILE_PRINT_SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    SLICER_PROFILE_FILAMENT_DIR.mkdir(parents=True, exist_ok=True)
    SLICER_PROFILE_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    _migrate_legacy_slicer_profile_files()
    _normalize_existing_uploaded_profile_json_files()


def _load_or_create_secret() -> str:
    env_secret = os.getenv("APP_SECRET", "").strip()
    if env_secret:
        return env_secret

    secret_path = DATA_DIR / "secret_key.txt"
    if secret_path.exists():
        try:
            value = secret_path.read_text(encoding="utf-8").strip()
            if value:
                return value
        except Exception:
            pass

    value = secrets.token_urlsafe(48)
    secret_path.write_text(value, encoding="utf-8")
    return value


def _is_relative_to(base: Path, candidate: Path) -> bool:
    base_r = base.resolve()
    cand_r = candidate.resolve()
    try:
        return cand_r.is_relative_to(base_r)
    except AttributeError:
        return str(cand_r).lower().startswith(str(base_r).lower())


def normalize_username(raw: str) -> str:
    value = str(raw or "").strip()
    if len(value) < 2 or len(value) > 40:
        raise ValueError("Brugernavn skal være mellem 2 og 40 tegn.")
    if re.search(r"[\\/:*?\"<>|\s]", value):
        raise ValueError("Brugernavn må ikke indeholde mellemrum eller specialtegn som / \\ : * ?")
    return value


def normalize_folder_path(raw: str) -> str:
    text = str(raw or "").replace("\\", "/").strip()
    while "//" in text:
        text = text.replace("//", "/")
    text = text.strip("/")
    if not text:
        return ""
    segments: list[str] = []
    for segment in text.split("/"):
        seg = segment.strip()
        if not seg:
            continue
        if seg in {".", ".."}:
            raise ValueError("Ugyldig mappe")
        if len(seg) > 120:
            raise ValueError("Mappenavn er for langt")
        if "\x00" in seg:
            raise ValueError("Ugyldig mappe")
        segments.append(seg)
    return "/".join(segments)


def folder_abs_path(folder_path: str) -> Tuple[str, Path]:
    normalized = normalize_folder_path(folder_path)
    absolute = (UPLOAD_ROOT / normalized).resolve() if normalized else UPLOAD_ROOT.resolve()
    if not _is_relative_to(UPLOAD_ROOT, absolute):
        raise ValueError("Ugyldig mappe")
    return normalized, absolute


def sanitize_filename(raw_name: str) -> str:
    source = Path(str(raw_name or "")).name
    # Keep Unicode letters (including æøå) while removing unsafe/control chars.
    cleaned_chars: list[str] = []
    for ch in source:
        if ch in {"/", "\\", "\x00"}:
            continue
        if ord(ch) < 32:
            continue
        cleaned_chars.append(ch)

    clean = "".join(cleaned_chars).strip()
    clean = re.sub(r"\s+", " ", clean)
    clean = clean.strip(". ")
    if not clean:
        clean = f"upload-{secrets.token_hex(4)}"
    if len(clean) > 240:
        stem = Path(clean).stem[:200]
        ext = Path(clean).suffix[:20]
        clean = f"{stem}{ext}"
    return clean


def token_digest(token: str) -> str:
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()


def permission_allows(actual: str, needed: str) -> bool:
    return PERMISSION_RANK.get(str(actual or ""), 0) >= PERMISSION_RANK.get(str(needed or ""), 0)


def guess_mime(filename: str, ext: str) -> str:
    ext_l = str(ext or "").lower()
    if ext_l == ".glb":
        return "model/gltf-binary"
    if ext_l == ".gltf":
        return "model/gltf+json"
    if ext_l == ".stl":
        return "model/stl"
    if ext_l == ".obj":
        return "model/obj"
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def parse_iso_or_none(raw: Any) -> Optional[datetime]:
    value = str(raw or "").strip()
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def expiry_from_payload(payload: dict) -> Optional[str]:
    try:
        value = int(str(payload.get("expires_value", "7") or "7").strip())
    except Exception:
        value = 7
    unit = str(payload.get("expires_unit") or "days").strip().lower()
    if value <= 0:
        return None
    if unit == "hours":
        dt = datetime.now(timezone.utc) + timedelta(hours=value)
    else:
        dt = datetime.now(timezone.utc) + timedelta(days=value)
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def share_is_expired(expires_at: Any) -> bool:
    dt = parse_iso_or_none(expires_at)
    if dt is None:
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt < datetime.now(timezone.utc)


def upload_relative_path(folder_path: str, filename: str) -> str:
    folder = normalize_folder_path(folder_path)
    return f"{folder}/{filename}" if folder else filename


def username_to_folder_slug(username: str, user_id: Optional[int] = None) -> str:
    normalized = str(username or "").strip().lower()
    chars: list[str] = []
    for ch in normalized:
        if ch in {"/", "\\", ":", "*", "?", "\"", "<", ">", "|", "\x00"}:
            continue
        if ch.isspace():
            chars.append("-")
            continue
        if ord(ch) < 32:
            continue
        chars.append(ch)
    slug = "".join(chars)
    slug = re.sub(r"-{2,}", "-", slug).strip("-._ ")
    if not slug:
        slug = f"user-{int(user_id or 0)}" if user_id else "user"
    return slug


def _ancestor_paths(path: str) -> list[str]:
    folder = normalize_folder_path(path)
    if not folder:
        return []
    parts = folder.split("/")
    out: list[str] = []
    for i in range(1, len(parts)):
        out.append("/".join(parts[:i]))
    return out


def _folder_clauses(prefixes: Iterable[str]) -> Tuple[str, list[str]]:
    parts: list[str] = []
    params: list[str] = []
    for prefix in prefixes:
        p = normalize_folder_path(prefix)
        if not p:
            continue
        parts.append("(folder_path = ? OR folder_path LIKE ?)")
        params.append(p)
        params.append(f"{p}/%")
    if not parts:
        return "1=0", []
    return " OR ".join(parts), params


def _collapse_folder_prefixes(paths: Iterable[str]) -> list[str]:
    normalized: list[str] = []
    for raw in paths:
        try:
            p = normalize_folder_path(str(raw or ""))
        except Exception:
            continue
        if p:
            normalized.append(p)
    unique_sorted = sorted(set(normalized), key=lambda x: (len(x), x.lower()))
    out: list[str] = []
    for p in unique_sorted:
        if any(p == kept or p.startswith(kept + "/") for kept in out):
            continue
        out.append(p)
    return out


def _thumbnail_rel_name(file_id: int) -> str:
    return f"{int(file_id)}.png"


def _thumbnail_abs_path_from_rel(rel_name: str) -> Path:
    rel = str(rel_name or "").strip()
    if not rel:
        raise ValueError("Missing thumbnail path")
    safe = Path(rel).name
    out = (THUMBS_DIR / safe).resolve()
    if not _is_relative_to(THUMBS_DIR, out):
        raise ValueError("Invalid thumbnail path")
    return out


def _safe_remove_thumbnail(rel_name: str) -> None:
    rel = str(rel_name or "").strip()
    if not rel:
        return
    try:
        thumb_path = _thumbnail_abs_path_from_rel(rel)
        if thumb_path.exists() and thumb_path.is_file():
            thumb_path.unlink(missing_ok=True)
    except Exception:
        pass


def _attachment_abs_path_from_rel(rel_name: str) -> Path:
    rel = str(rel_name or "").replace("\\", "/").strip().strip("/")
    if not rel:
        raise ValueError("Missing attachment path")
    out = (FILE_ATTACHMENTS_DIR / rel).resolve()
    if not _is_relative_to(FILE_ATTACHMENTS_DIR, out):
        raise ValueError("Invalid attachment path")
    return out


def _safe_remove_attachment(rel_name: str) -> None:
    rel = str(rel_name or "").strip()
    if not rel:
        return
    try:
        path = _attachment_abs_path_from_rel(rel)
        if path.exists() and path.is_file():
            path.unlink(missing_ok=True)
    except Exception:
        pass


def _attachment_ext_from_upload(filename: str, mime_type: str) -> str:
    ext = str(Path(filename or "").suffix or "").lower()
    if ext in FILE_ATTACHMENT_ALLOWED_EXTS:
        return ext
    mapped = FILE_ATTACHMENT_MIME_TO_EXT.get(str(mime_type or "").strip().lower(), "")
    return mapped if mapped in FILE_ATTACHMENT_ALLOWED_EXTS else ""


def _attachment_is_heic_upload(filename: str, mime_type: str) -> bool:
    ext = str(Path(filename or "").suffix or "").lower()
    if ext in FILE_ATTACHMENT_HEIC_EXTS:
        return True
    return str(mime_type or "").strip().lower() in FILE_ATTACHMENT_HEIC_MIME_TYPES


def _attachment_save_heic_as_jpg(upload: Any, abs_path: Path) -> bool:
    if not HEIC_CONVERSION_AVAILABLE:
        return False
    try:
        stream = getattr(upload, "stream", None)
        if stream is None:
            return False
        stream.seek(0)
        with Image.open(stream) as src_img:
            img = ImageOps.exif_transpose(src_img)
            if img.mode not in {"RGB", "L"}:
                img = img.convert("RGB")
            elif img.mode == "L":
                img = img.convert("RGB")
            img.save(abs_path, format="JPEG", quality=92, optimize=True)
        return True
    except Exception:
        return False


def _attachment_size_from_filestorage(file_storage: Any) -> int:
    stream = getattr(file_storage, "stream", None)
    if stream is None:
        return -1
    try:
        pos = stream.tell()
        stream.seek(0, os.SEEK_END)
        size = int(stream.tell())
        stream.seek(pos, os.SEEK_SET)
        return max(0, size)
    except Exception:
        return -1


def _cleanup_file_attachments_for_file(file_id: int) -> None:
    file_id_i = int(file_id)
    rels: list[str] = []
    with closing(get_conn()) as conn:
        rows = conn.execute(
            "SELECT rel_name FROM file_attachments WHERE file_id=?",
            (file_id_i,),
        ).fetchall()
    for row in rows:
        rel = str(row["rel_name"] or "").strip()
        if rel:
            rels.append(rel)
    for rel in rels:
        _safe_remove_attachment(rel)


def _zip_member_parts(member_name: str) -> list[str]:
    raw = str(member_name or "").replace("\\", "/").strip()
    raw = raw.lstrip("/")
    if not raw:
        return []
    parts = [p for p in raw.split("/") if p not in {"", "."}]
    if any(p == ".." for p in parts):
        return []
    return parts


def _zip_info_is_symlink(info: zipfile.ZipInfo) -> bool:
    try:
        mode = (int(info.external_attr) >> 16) & 0o170000
        return mode == 0o120000
    except Exception:
        return False


def _extract_zip_upload(
    zip_path: Path,
    base_folder: str,
    uploaded_by: str,
    upload_client_id: Optional[str],
    last_modified_ms: int = 0,
    original_zip_name: str = "",
) -> Tuple[int, Optional[sqlite3.Row], list[str]]:
    _ = upload_client_id
    base = normalize_folder_path(base_folder)
    if not base:
        raise ValueError("ZIP kræver en målmappe")

    _, base_abs = folder_abs_path(base)
    base_abs.mkdir(parents=True, exist_ok=True)
    ensure_folder_record(base)

    extracted = 0
    first_row: Optional[sqlite3.Row] = None
    created_folders: set[str] = set()

    def _zip_name_key(raw: str) -> str:
        value = str(raw or "").strip().lower().replace("\\", "/")
        if "/" in value:
            value = value.split("/")[-1]
        if value.endswith(".zip"):
            value = value[:-4]
        value = value.replace("_", "-").replace(" ", "-")
        value = re.sub(r"-+", "-", value)
        return value.strip("-._ ")

    with zipfile.ZipFile(zip_path, "r") as archive:
        infos = archive.infolist()
        if len(infos) > ZIP_UPLOAD_MAX_FILES:
            raise ValueError(f"ZIP indeholder for mange elementer (maks {ZIP_UPLOAD_MAX_FILES})")

        wrapper_prefix = ""
        zip_key = _zip_name_key(original_zip_name)
        if zip_key:
            first_parts: set[str] = set()
            has_root_files = False
            for info in infos:
                if info.is_dir() or _zip_info_is_symlink(info):
                    continue
                parts = _zip_member_parts(info.filename)
                if not parts:
                    continue
                joined = "/".join(parts)
                if joined.startswith("__MACOSX/"):
                    continue
                if parts[-1] in {".DS_Store", "Thumbs.db"}:
                    continue
                if len(parts) <= 1:
                    has_root_files = True
                    break
                first_parts.add(parts[0])
                if len(first_parts) > 1:
                    break

            if not has_root_files and len(first_parts) == 1:
                candidate = next(iter(first_parts))
                if _zip_name_key(candidate) == zip_key:
                    wrapper_prefix = candidate

        total_uncompressed = 0
        for info in infos:
            if _zip_info_is_symlink(info):
                continue
            try:
                total_uncompressed += int(info.file_size or 0)
            except Exception:
                pass
            if total_uncompressed > ZIP_UPLOAD_MAX_UNCOMPRESSED_BYTES:
                raise ValueError("ZIP er for stor efter udpakning")

            parts = _zip_member_parts(info.filename)
            if not parts:
                continue

            # Ignore common OS metadata folders/files in ZIP archives.
            joined = "/".join(parts)
            if joined.startswith("__MACOSX/"):
                continue
            if parts[-1] in {".DS_Store", "Thumbs.db"}:
                continue

            if wrapper_prefix and parts[0] == wrapper_prefix:
                parts = parts[1:]
                if not parts:
                    continue

            if info.is_dir():
                try:
                    inner_dir = normalize_folder_path("/".join(parts))
                    target_folder = normalize_folder_path(f"{base}/{inner_dir}") if inner_dir else base
                except ValueError:
                    continue
                if target_folder and target_folder not in created_folders:
                    _, target_abs = folder_abs_path(target_folder)
                    target_abs.mkdir(parents=True, exist_ok=True)
                    ensure_folder_record(target_folder)
                    created_folders.add(target_folder)
                continue

            file_name = sanitize_filename(parts[-1])
            if not file_name:
                continue

            try:
                inner_dir = normalize_folder_path("/".join(parts[:-1])) if len(parts) > 1 else ""
                target_folder = normalize_folder_path(f"{base}/{inner_dir}") if inner_dir else base
            except ValueError:
                continue
            _, target_abs = folder_abs_path(target_folder)
            target_abs.mkdir(parents=True, exist_ok=True)
            if target_folder and target_folder not in created_folders:
                ensure_folder_record(target_folder)
                created_folders.add(target_folder)

            target_path = allocate_unique_target(target_abs, file_name)
            with archive.open(info, "r") as src, target_path.open("wb") as dst:
                shutil.copyfileobj(src, dst)

            if last_modified_ms > 0:
                try:
                    ts = float(last_modified_ms) / 1000.0
                    os.utime(target_path, (ts, ts))
                except Exception:
                    pass

            row = upsert_file_record(
                folder_path=target_folder,
                filename=target_path.name,
                disk_path=target_path,
                uploaded_by=uploaded_by,
                upload_client_id=None,
            )
            try:
                ext = str(row["ext"] or "").lower()
                if _supports_thumbnail_for_ext(ext):
                    enqueue_thumbnail(int(row["id"]))
            except Exception:
                pass

            if first_row is None:
                first_row = row
            extracted += 1

    return extracted, first_row, sorted(created_folders)


def _set_file_thumbnail_state(
    file_id: int,
    status: str,
    thumb_rel: Optional[str] = None,
    error: Optional[str] = None,
    actor: str = "system",
) -> None:
    safe_status = str(status or "").strip().lower() or "none"
    safe_rel = str(thumb_rel or "").strip()
    safe_error = str(error or "").strip()
    with closing(get_conn()) as conn:
        row = conn.execute(
            "SELECT folder_path, filename, thumb_status, thumb_error FROM files WHERE id=?",
            (int(file_id),),
        ).fetchone()
        prev_status = str(row["thumb_status"] or "").strip().lower() if row else ""
        prev_error = str(row["thumb_error"] or "").strip() if row else ""

        conn.execute(
            """
            UPDATE files
            SET thumb_status=?,
                thumb_rel=?,
                thumb_error=?,
                thumb_updated_at=?
            WHERE id=?
            """,
            (
                safe_status,
                safe_rel or None,
                safe_error[:1000] or None,
                now_iso(),
                int(file_id),
            ),
        )

        status_changed = prev_status != safe_status
        error_changed = bool(safe_error) and safe_error != prev_error
        if row is not None and (status_changed or error_changed):
            message = {
                "queued": "Thumbnail sat i kø",
                "processing": "Thumbnail generering startet",
                "ready": "Thumbnail klar",
                "none": "Thumbnail ikke relevant for filtypen",
                "error": safe_error or "Thumbnail fejl",
            }.get(safe_status, f"Thumbnail status: {safe_status}")
            _insert_activity_log_conn(
                conn,
                kind="thumbnail",
                action=safe_status,
                message=message,
                level="error" if safe_status == "error" else "info",
                folder_path=str(row["folder_path"] or ""),
                target=str(row["filename"] or ""),
                actor=actor,
                file_id=int(file_id),
            )

        conn.commit()


def _supports_thumbnail_for_ext(ext: str) -> bool:
    return str(ext or "").lower() in THUMBABLE_3D_EXTENSIONS


def _supports_slicing_for_ext(ext: str) -> bool:
    return str(ext or "").lower() in SLICABLE_3D_EXTENSIONS


def _set_file_slice_state(
    file_id: int,
    status: str,
    error: str = "",
    actor: str = "system",
) -> None:
    safe_status = str(status or "").strip().lower() or "none"
    safe_error = str(error or "").strip()
    with closing(get_conn()) as conn:
        row = conn.execute(
            "SELECT folder_path, filename, slice_status, slice_error FROM files WHERE id=?",
            (int(file_id),),
        ).fetchone()
        prev_status = str(row["slice_status"] or "").strip().lower() if row else ""
        prev_error = str(row["slice_error"] or "").strip() if row else ""

        conn.execute(
            """
            UPDATE files
            SET slice_status=?,
                slice_error=?,
                slice_updated_at=?
            WHERE id=?
            """,
            (
                safe_status,
                safe_error[:1000] or None,
                now_iso(),
                int(file_id),
            ),
        )

        status_changed = prev_status != safe_status
        error_changed = bool(safe_error) and safe_error != prev_error
        if row is not None and (status_changed or error_changed):
            message = {
                "queued": "Slice sat i kø",
                "processing": "Slicing startet",
                "ready": "Slicing færdig",
                "none": "Slice nulstillet",
                "error": safe_error or "Slicing fejl",
            }.get(safe_status, f"Slice status: {safe_status}")
            _insert_activity_log_conn(
                conn,
                kind="slice",
                action=safe_status,
                message=message,
                level="error" if safe_status == "error" else "info",
                folder_path=str(row["folder_path"] or ""),
                target=str(row["filename"] or ""),
                actor=actor,
                file_id=int(file_id),
            )

        conn.commit()


def _split_profile_env_list(raw_value: str) -> list[str]:
    out: list[str] = []
    for token in str(raw_value or "").split(","):
        value = str(token or "").strip()
        if value:
            out.append(value)
    return out


def _dedupe_preserve_order(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in values:
        value = str(raw or "").strip()
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(value)
    return out


def _extract_profile_name_from_section(section_name: str, prefixes: tuple[str, ...]) -> str:
    original = str(section_name or "").strip()
    lowered = original.lower()
    if not original:
        return ""
    for prefix in prefixes:
        if lowered.startswith(prefix):
            name = original[len(prefix):].strip()
            if name.startswith(":"):
                name = name[1:].strip()
            return name
    return ""


def _expected_profile_type_for_dir(profile_dir: Path) -> str:
    name = str(profile_dir.name or "").strip().lower()
    if name in {"machine", "process", "filament"}:
        return name
    return ""


def _read_profile_json_payload(profile_file: Path) -> Optional[dict[str, Any]]:
    try:
        text = profile_file.read_text(encoding="utf-8-sig", errors="ignore")
    except Exception:
        return None

    if not text:
        return None

    try:
        payload = json.loads(text)
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None
    return payload


def _profile_json_name_candidates(payload: dict[str, Any]) -> list[str]:
    names: list[str] = []
    for key in (
        "name",
        "printer_settings_id",
        "print_settings_id",
        "filament_settings_id",
        "setting_id",
    ):
        value = _slicer_profile_name_from_value(payload.get(key))
        if value:
            names.append(value)
    return _dedupe_preserve_order(names)


def _string_values_from_any(value: Any) -> list[str]:
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []

    if isinstance(value, (list, tuple)):
        out: list[str] = []
        for item in value:
            out.extend(_string_values_from_any(item))
        return out

    if isinstance(value, dict):
        out: list[str] = []
        for key in ("name", "id", "value", "setting_id", "printer_settings_id"):
            out.extend(_string_values_from_any(value.get(key)))
        return out

    return []


def _profile_tokens_overlap(tokens_a: Iterable[str], tokens_b: Iterable[str]) -> bool:
    aa = [str(t or "").strip() for t in tokens_a if str(t or "").strip()]
    bb = [str(t or "").strip() for t in tokens_b if str(t or "").strip()]
    if not aa or not bb:
        return False

    for a in aa:
        for b in bb:
            if a == b or (a in b) or (b in a):
                return True
    return False


def _uploaded_machine_profile_names() -> list[str]:
    names: list[str] = []
    for profile_path in _list_slicer_profile_files(SLICER_PROFILE_PRINTER_DIR, {".json"}):
        payload = _read_profile_json_payload(profile_path)
        if not _profile_payload_is_usable(payload, "machine"):
            continue

        if payload is not None:
            names.extend(_profile_json_name_candidates(payload))

        stem_name = str(profile_path.stem or "").strip()
        if stem_name:
            names.append(stem_name)

    return _dedupe_preserve_order(names)


def _profile_payload_is_usable(payload: Optional[dict[str, Any]], expected_type: str) -> bool:
    if payload is None:
        return not bool(expected_type)

    payload_type = str(payload.get("type") or "").strip().lower()
    if expected_type and payload_type != expected_type:
        return False

    from_value = str(payload.get("from") or "").strip().lower()
    if from_value == "unsupported":
        return False

    instantiation = str(payload.get("instantiation") or "").strip().lower()
    if expected_type and instantiation in {"false", "0", "no"}:
        return False

    return True


def _list_profile_names_from_dir(profile_dir: Path) -> list[str]:
    names: list[str] = []
    try:
        files = sorted((p for p in profile_dir.glob("*.json") if p.is_file()), key=lambda p: p.name.lower())
    except Exception:
        return names

    expected_type = _expected_profile_type_for_dir(profile_dir)

    for profile_file in files:
        payload = _read_profile_json_payload(profile_file)
        if not _profile_payload_is_usable(payload, expected_type):
            continue

        name = ""
        if payload is not None:
            candidates = _profile_json_name_candidates(payload)
            if candidates:
                name = str(candidates[0] or "").strip()

        if not name:
            name = str(profile_file.stem or "").strip()

        if name:
            names.append(name)
    return names


def _extract_float_numbers(value: Any, max_items: int = 64) -> list[float]:
    if max_items <= 0:
        return []

    out: list[float] = []

    def _append_number(num: Any) -> None:
        try:
            parsed = float(num)
        except Exception:
            return
        if not math.isfinite(parsed):
            return
        out.append(parsed)

    if isinstance(value, bool):
        return out

    if isinstance(value, (int, float)):
        _append_number(value)
        return out[:max_items]

    if isinstance(value, str):
        for match in re.finditer(r"[-+]?\d+(?:\.\d+)?", value):
            _append_number(match.group(0))
            if len(out) >= max_items:
                break
        return out[:max_items]

    if isinstance(value, (list, tuple)):
        for item in value:
            if len(out) >= max_items:
                break
            out.extend(_extract_float_numbers(item, max_items=max_items - len(out)))
        return out[:max_items]

    return out


def _normalize_bed_size_pair(width_mm: Any, depth_mm: Any) -> Optional[tuple[float, float]]:
    numbers_w = _extract_float_numbers(width_mm, max_items=1)
    numbers_d = _extract_float_numbers(depth_mm, max_items=1)
    if not numbers_w or not numbers_d:
        return None

    width = abs(float(numbers_w[0]))
    depth = abs(float(numbers_d[0]))
    if not math.isfinite(width) or not math.isfinite(depth):
        return None

    if width < 40 or depth < 40:
        return None
    if width > 2000 or depth > 2000:
        return None

    return (round(width, 3), round(depth, 3))


def _extract_planar_size_mm(value: Any) -> Optional[tuple[float, float]]:
    if value is None:
        return None

    if isinstance(value, dict):
        pair_keys = (
            ("width", "depth"),
            ("bed_width", "bed_depth"),
            ("x", "y"),
            ("size_x", "size_y"),
            ("max_x", "max_y"),
            ("machine_width", "machine_depth"),
            ("machine_max_x", "machine_max_y"),
        )
        for key_w, key_d in pair_keys:
            if key_w not in value and key_d not in value:
                continue
            result = _normalize_bed_size_pair(value.get(key_w), value.get(key_d))
            if result:
                return result
        return None

    numbers = _extract_float_numbers(value, max_items=200)
    if len(numbers) < 2:
        return None

    if len(numbers) >= 4 and len(numbers) % 2 == 0:
        xs = numbers[0::2]
        ys = numbers[1::2]
        width = max(xs) - min(xs)
        depth = max(ys) - min(ys)
        result = _normalize_bed_size_pair(width, depth)
        if result:
            return result

    return _normalize_bed_size_pair(numbers[0], numbers[1])


def _extract_printer_bed_size_mm(payload: Optional[dict[str, Any]]) -> Optional[tuple[float, float]]:
    if payload is None:
        return None

    direct_pairs = (
        ("bed_width", "bed_depth"),
        ("machine_width", "machine_depth"),
        ("machine_max_x", "machine_max_y"),
        ("max_print_x", "max_print_y"),
        ("printable_width", "printable_depth"),
        ("build_volume_x", "build_volume_y"),
    )
    for key_w, key_d in direct_pairs:
        if key_w not in payload and key_d not in payload:
            continue
        result = _normalize_bed_size_pair(payload.get(key_w), payload.get(key_d))
        if result:
            return result

    composite_fields = (
        "bed_shape",
        "printable_area",
        "printable_shape",
        "machine_size",
        "machine_size_mm",
        "build_volume",
        "plate_size",
        "max_print_size",
        "work_area",
    )
    for key in composite_fields:
        if key not in payload:
            continue
        result = _extract_planar_size_mm(payload.get(key))
        if result:
            return result

    for container_key in ("bed", "plate", "machine", "volume", "printable"):
        container = payload.get(container_key)
        if not isinstance(container, dict):
            continue
        result = _extract_planar_size_mm(container)
        if result:
            return result

    return None


def _collect_printer_profile_bed_sizes(profile_root: str = "") -> dict[str, dict[str, float]]:
    profile_dirs: list[tuple[str, Path]] = []

    env_profile_root = str(BAMBUSTUDIO_PROFILE_ROOT or "").strip()
    if env_profile_root:
        env_machine_dir = Path(env_profile_root) / "machine"
        if env_machine_dir.exists() and env_machine_dir.is_dir():
            profile_dirs.append(("profile_root", env_machine_dir))

    root_value = str(profile_root or "").strip()
    if root_value:
        discovered_machine_dir = Path(root_value) / "machine"
        if discovered_machine_dir.exists() and discovered_machine_dir.is_dir():
            profile_dirs.append(("discovered", discovered_machine_dir))

    beds: dict[str, dict[str, float]] = {}
    for _source, machine_dir in profile_dirs:
        files = _list_slicer_profile_files(machine_dir, {".json"})
        for profile_path in files:
            payload = _read_profile_json_payload(profile_path)
            if not _profile_payload_is_usable(payload, "machine"):
                continue

            bed_size = _extract_printer_bed_size_mm(payload)
            if not bed_size:
                continue

            names: list[str] = []
            if payload is not None:
                names.extend(_profile_json_name_candidates(payload))
            stem_name = str(profile_path.stem or "").strip()
            if stem_name:
                names.append(stem_name)

            unique_names = _dedupe_preserve_order(names)
            if not unique_names:
                continue

            for name in unique_names:
                if not _normalize_profile_token(name):
                    continue

                beds[name] = {
                    "width_mm": float(bed_size[0]),
                    "depth_mm": float(bed_size[1]),
                }

    return beds


def _read_bambustudio_profiles() -> dict:
    printers: list[str] = []
    print_profiles: list[str] = []
    filament_profiles: list[str] = []

    parse_error = ""
    source = "appimage"
    config_path_raw = ""
    profile_root = ""

    try:
        executable = _resolve_bambustudio_executable()
        discovered_root = _find_bambu_profile_root(executable)
        if discovered_root:
            profile_root = str(discovered_root)
            printers.extend(_list_profile_names_from_dir(discovered_root / "machine"))
            print_profiles.extend(_list_profile_names_from_dir(discovered_root / "process"))
            filament_profiles.extend(_list_profile_names_from_dir(discovered_root / "filament"))
    except Exception as exc:
        parse_error = str(exc)
    if not profile_root and not parse_error:
        parse_error = "Kunne ikke finde Bambu Studio profilmappe."

    printer_beds = _collect_printer_profile_bed_sizes(profile_root=profile_root)

    return {
        "source": source,
        "config_path": config_path_raw,
        "profile_root": profile_root,
        "parse_error": parse_error,
        "printers": _dedupe_preserve_order(printers),
        "print_profiles": _dedupe_preserve_order(print_profiles),
        "filament_profiles": _dedupe_preserve_order(filament_profiles),
        "printer_beds": printer_beds,
    }


def _resolve_bambustudio_executable() -> str:
    def _prefer_apprun(path_str: str) -> str:
        p = Path(path_str)
        candidates: list[Path] = [p]
        try:
            resolved = p.resolve(strict=True)
            if resolved not in candidates:
                candidates.insert(0, resolved)
        except Exception:
            pass

        for cand in candidates:
            try:
                parts_lower = [part.lower() for part in cand.parts]
            except Exception:
                continue
            if (
                len(parts_lower) >= 3
                and parts_lower[-3] == "appdir"
                and parts_lower[-2] == "bin"
                and parts_lower[-1] in {"bambu-studio", "bambustudio"}
            ):
                app_run = cand.parent.parent / "AppRun"
                if app_run.is_file():
                    return str(app_run)

        return str(candidates[0]) if candidates else path_str

    configured = str(BAMBUSTUDIO_BIN or "").strip()
    if not configured:
        raise RuntimeError("BAMBUSTUDIO_BIN er ikke konfigureret")

    candidate_path = Path(configured)
    if candidate_path.is_file():
        return _prefer_apprun(str(candidate_path))

    if configured.lower() in {"bambu-studio", "bambustudio"}:
        for alt in ("bambu-studio-console", "BambuStudio-console", "bambu-studio", "BambuStudio"):
            resolved_alt = shutil.which(alt)
            if resolved_alt:
                return _prefer_apprun(resolved_alt)

    resolved = shutil.which(configured)
    if resolved:
        return _prefer_apprun(resolved)

    raise RuntimeError(f"BambuStudio blev ikke fundet: {configured}")


def _extract_gcode_from_3mf_archive(archive_path: Path, output_gcode: Path) -> bool:
    if not archive_path.exists() or not archive_path.is_file():
        return False

    try:
        with zipfile.ZipFile(archive_path, "r") as zf:
            infos = [info for info in zf.infolist() if not info.is_dir()]
            if not infos:
                return False

            gcode_candidates = [
                info
                for info in infos
                if ".gcode" in Path(info.filename.lower()).name or info.filename.lower().endswith(".gcode")
            ]
            if not gcode_candidates:
                return False

            # Prefer explicit .gcode files and then larger candidates.
            best = max(
                gcode_candidates,
                key=lambda info: (
                    1 if info.filename.lower().endswith(".gcode") else 0,
                    info.file_size,
                ),
            )

            with zf.open(best, "r") as src, output_gcode.open("wb") as dst:
                shutil.copyfileobj(src, dst)
    except Exception:
        return False

    try:
        return output_gcode.exists() and output_gcode.is_file() and output_gcode.stat().st_size > 0
    except Exception:
        return False


def _run_bambu_with_runtime_fallback(command: list[str], executable: str) -> tuple[subprocess.CompletedProcess[str], str]:
    def _run_slice_cmd(cmd: list[str]) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=BAMBUSTUDIO_ATTEMPT_TIMEOUT_SEC,
        )

    def _resolve_exec_candidate(raw: str) -> str:
        value = str(raw or "").strip()
        if not value:
            return ""
        path = Path(value)
        if path.is_file():
            return str(path)
        return str(shutil.which(value) or "")

    try:
        proc = _run_slice_cmd(command)
    except subprocess.TimeoutExpired:
        raise RuntimeError("BambuStudio timeout")
    except FileNotFoundError:
        raise RuntimeError(f"BambuStudio blev ikke fundet: {executable}")
    except Exception as exc:
        raise RuntimeError(f"Kunne ikke starte BambuStudio: {exc}")

    details = (proc.stderr or proc.stdout or "Ukendt fejl").strip()

    if proc.returncode != 0 and "error while loading shared libraries" in details.lower():
        seen_execs: set[str] = {str(executable)}
        fallback_execs = [
            "/opt/bambu-studio/appdir/AppRun",
            "/opt/bambu-studio/appdir/bin/bambu-studio-console",
            "bambu-studio-console",
            "BambuStudio-console",
            "bambu-studio",
            "BambuStudio",
        ]
        for raw_exec in fallback_execs:
            candidate = _resolve_exec_candidate(raw_exec)
            if not candidate or candidate in seen_execs:
                continue
            seen_execs.add(candidate)

            alt_cmd = [candidate, *command[1:]]
            try:
                alt_proc = _run_slice_cmd(alt_cmd)
            except Exception:
                continue

            if alt_proc.returncode == 0:
                return alt_proc, ""

            alt_details = (alt_proc.stderr or alt_proc.stdout or "").strip()
            if alt_details:
                details = f"{details}\nFallback {candidate} -> {alt_details}".strip()

    return proc, details


def _normalize_profile_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def _find_bambu_profile_root(executable: str) -> Optional[Path]:
    candidates: list[Path] = [
        Path("/opt/bambu-studio/appdir/usr/resources/profiles/BBL"),
        Path("/opt/bambu-studio/appdir/resources/profiles/BBL"),
        Path("/opt/bambu-studio/resources/profiles/BBL"),
    ]

    env_profile_root = str(BAMBUSTUDIO_PROFILE_ROOT or "").strip()
    if env_profile_root:
        candidates.insert(0, Path(env_profile_root))

    def _is_profile_root(path: Path) -> bool:
        try:
            return (path / "machine").is_dir() and (path / "process").is_dir() and (path / "filament").is_dir()
        except Exception:
            return False

    raw_executable = str(executable or "").strip()
    if raw_executable:
        exe_path = Path(raw_executable)
        try:
            if exe_path.exists():
                exe_path = exe_path.resolve()
        except Exception:
            pass

        candidates.extend(
            [
                exe_path.parent / "usr" / "resources" / "profiles" / "BBL",
                exe_path.parent / "resources" / "profiles" / "BBL",
                exe_path.parent.parent / "usr" / "resources" / "profiles" / "BBL",
                exe_path.parent.parent / "resources" / "profiles" / "BBL",
                exe_path.parent.parent.parent / "usr" / "resources" / "profiles" / "BBL",
                exe_path.parent.parent.parent / "resources" / "profiles" / "BBL",
            ]
        )

    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate)
        if key in seen:
            continue
        seen.add(key)
        if candidate.exists() and candidate.is_dir() and _is_profile_root(candidate):
            return candidate

    scan_roots: list[Path] = [Path("/opt/bambu-studio")]
    if raw_executable:
        scan_roots.extend(
            [
                Path(raw_executable).parent,
                Path(raw_executable).parent.parent,
                Path(raw_executable).parent.parent.parent,
            ]
        )

    scanned: set[str] = set()
    for scan_root in scan_roots:
        key = str(scan_root)
        if key in scanned:
            continue
        scanned.add(key)

        try:
            if not scan_root.exists() or not scan_root.is_dir():
                continue
        except Exception:
            continue

        try:
            for found in scan_root.rglob("BBL"):
                try:
                    if found.name != "BBL":
                        continue
                    parent = found.parent.name.lower()
                    if parent != "profiles":
                        continue
                    if _is_profile_root(found):
                        return found
                except Exception:
                    continue
        except Exception:
            continue

    return None


def _pick_profile_json(
    profile_dir: Path,
    requested_name: str,
    fallback_first: bool = True,
    machine_profile_json: str = "",
    process_profile_json: str = "",
) -> str:
    try:
        files = sorted((p for p in profile_dir.glob("*.json") if p.is_file()), key=lambda p: p.name.lower())
    except Exception:
        return ""

    if not files:
        return ""

    def _profile_json_tokens(profile_json: str) -> list[str]:
        raw_path = str(profile_json or "").strip()
        if not raw_path:
            return []

        profile_path = Path(raw_path)
        payload = _read_profile_json_payload(profile_path)
        names: list[str] = []
        if payload is not None:
            names.extend(_profile_json_name_candidates(payload))

        stem_name = str(profile_path.stem or "").strip()
        if stem_name:
            names.append(stem_name)

        return [
            token
            for token in _dedupe_preserve_order(_normalize_profile_token(name) for name in names)
            if token
        ]

    def _compatibility_tokens(payload: Optional[dict[str, Any]], keys: tuple[str, ...]) -> list[str]:
        if payload is None:
            return []

        names: list[str] = []
        for key in keys:
            names.extend(_string_values_from_any(payload.get(key)))

        return [
            token
            for token in _dedupe_preserve_order(_normalize_profile_token(name) for name in names)
            if token
        ]

    def _extract_nozzle_hint(value: Any) -> str:
        raw = str(value or "").strip()
        if not raw:
            return ""
        match = re.search(r"(\d+(?:[.,]\d+)?)\s*nozzle\b", raw, flags=re.IGNORECASE)
        if not match:
            return ""
        return _normalize_slice_nozzle_diameter(match.group(1))

    def _candidate_nozzle_hints(path: Path, payload: Optional[dict[str, Any]]) -> list[str]:
        names: list[str] = [str(path.stem or "").strip()]
        if payload is not None:
            names = [*_profile_json_name_candidates(payload), *names]
        hints: list[str] = []
        for name in names:
            hint = _extract_nozzle_hint(name)
            if hint:
                hints.append(hint)
        return _dedupe_preserve_order(hints)

    def _profile_nozzle_hint_from_json(profile_json: str) -> str:
        raw_path = str(profile_json or "").strip()
        if not raw_path:
            return ""
        profile_path = Path(raw_path)
        payload = _read_profile_json_payload(profile_path)
        names: list[str] = []
        if payload is not None:
            names.extend(_profile_json_name_candidates(payload))
        stem_name = str(profile_path.stem or "").strip()
        if stem_name:
            names.append(stem_name)
        for name in names:
            hint = _extract_nozzle_hint(name)
            if hint:
                return hint
        return ""

    expected_type = _expected_profile_type_for_dir(profile_dir)
    candidates: list[tuple[Path, list[str], Optional[dict[str, Any]]]] = []
    for path in files:
        payload = _read_profile_json_payload(path)
        if not _profile_payload_is_usable(payload, expected_type):
            continue

        name_candidates: list[str] = [str(path.stem or "").strip()]
        if payload is not None:
            name_candidates = [*_profile_json_name_candidates(payload), *name_candidates]

        token_candidates = _dedupe_preserve_order(_normalize_profile_token(name) for name in name_candidates)
        tokens = [token for token in token_candidates if token]
        if not tokens:
            continue

        candidates.append((path, tokens, payload))

    if expected_type == "process" and machine_profile_json:
        machine_tokens = _profile_json_tokens(machine_profile_json)

        if machine_tokens:
            compatible_candidates: list[tuple[Path, list[str], Optional[dict[str, Any]]]] = []
            for path, tokens, payload in candidates:
                if payload is None:
                    compatible_candidates.append((path, tokens, payload))
                    continue

                compatible_tokens = _compatibility_tokens(payload, ("compatible_printers", "compatible_printer"))

                # If no explicit compatibility list exists, keep candidate as-is.
                if not compatible_tokens or _profile_tokens_overlap(compatible_tokens, machine_tokens):
                    compatible_candidates.append((path, tokens, payload))

            if compatible_candidates:
                candidates = compatible_candidates
            elif str(requested_name or "").strip():
                candidates = []

    if expected_type == "filament":
        machine_tokens = _profile_json_tokens(machine_profile_json)
        process_tokens = _profile_json_tokens(process_profile_json)

        if machine_tokens or process_tokens:
            compatible_candidates: list[tuple[Path, list[str], Optional[dict[str, Any]]]] = []
            for path, tokens, payload in candidates:
                if payload is None:
                    compatible_candidates.append((path, tokens, payload))
                    continue

                compatible = True
                if machine_tokens:
                    compatible_printer_tokens = _compatibility_tokens(
                        payload,
                        ("compatible_printers", "compatible_printer", "compatible_machines", "compatible_machine"),
                    )
                    if compatible_printer_tokens and not _profile_tokens_overlap(compatible_printer_tokens, machine_tokens):
                        compatible = False

                if compatible and process_tokens:
                    compatible_process_tokens = _compatibility_tokens(
                        payload,
                        (
                            "compatible_processes",
                            "compatible_process",
                            "compatible_prints",
                            "compatible_print",
                            "compatible_print_profiles",
                            "compatible_print_profile",
                        ),
                    )
                    if compatible_process_tokens and not _profile_tokens_overlap(compatible_process_tokens, process_tokens):
                        compatible = False

                if compatible:
                    compatible_candidates.append((path, tokens, payload))

            if compatible_candidates:
                candidates = compatible_candidates
            elif str(requested_name or "").strip():
                candidates = []

    requested_nozzle = _extract_nozzle_hint(requested_name)
    requested_has_nozzle = bool(requested_nozzle)
    machine_nozzle = _profile_nozzle_hint_from_json(machine_profile_json) if expected_type == "filament" else ""
    effective_nozzle = requested_nozzle or machine_nozzle
    if effective_nozzle and candidates:
        nozzle_candidates: list[tuple[Path, list[str], Optional[dict[str, Any]]]] = []
        for path, tokens, payload in candidates:
            hints = _candidate_nozzle_hints(path, payload)
            if not hints or effective_nozzle in hints:
                nozzle_candidates.append((path, tokens, payload))
        if nozzle_candidates:
            candidates = nozzle_candidates

    if not candidates:
        return str(files[0]) if fallback_first else ""

    wanted = _normalize_profile_token(requested_name)
    if wanted:
        if expected_type == "filament" and machine_nozzle and not requested_has_nozzle:
            nozzle_superset_matches: list[tuple[Path, int]] = []
            for path, tokens, payload in candidates:
                hints = _candidate_nozzle_hints(path, payload)
                if hints and machine_nozzle not in hints:
                    continue
                lengths = [len(token) for token in tokens if (wanted in token) and (token != wanted)]
                if lengths:
                    nozzle_superset_matches.append((path, min(lengths)))
            if nozzle_superset_matches:
                nozzle_superset_matches.sort(key=lambda item: (item[1], item[0].name.lower()))
                return str(nozzle_superset_matches[0][0])

        exact = [path for path, tokens, _payload in candidates if wanted in tokens]
        if exact:
            return str(exact[0])

        subset_matches: list[tuple[Path, int]] = []
        for path, tokens, _payload in candidates:
            lengths = [len(token) for token in tokens if token in wanted]
            if lengths:
                subset_matches.append((path, max(lengths)))
        if subset_matches:
            subset_matches.sort(key=lambda item: (-item[1], item[0].name.lower()))
            return str(subset_matches[0][0])

        superset_matches: list[tuple[Path, int]] = []
        for path, tokens, _payload in candidates:
            lengths = [len(token) for token in tokens if wanted in token]
            if lengths:
                superset_matches.append((path, min(lengths)))
        if superset_matches:
            superset_matches.sort(key=lambda item: (item[1], item[0].name.lower()))
            return str(superset_matches[0][0])

        if not fallback_first:
            return ""

    return str(candidates[0][0]) if fallback_first else ""


def _resolve_selected_profile_jsons(
    executable: str,
    printer_profile: str,
    print_profile: str,
    filament_profile: str,
    prefer_uploaded: bool = False,
    auto_pick_when_blank: bool = True,
) -> tuple[str, str, str]:
    discovered_profile_root: Optional[Path] = None

    machine_json = ""
    process_json = ""
    filament_json = ""

    strict_machine = bool(str(printer_profile or "").strip()) or not auto_pick_when_blank
    strict_process = bool(str(print_profile or "").strip()) or not auto_pick_when_blank
    strict_filament = bool(str(filament_profile or "").strip()) or not auto_pick_when_blank

    if prefer_uploaded:
        machine_json = _pick_profile_json(
            SLICER_PROFILE_PRINTER_DIR,
            printer_profile,
            fallback_first=not strict_machine,
        )
        process_json = _pick_profile_json(
            SLICER_PROFILE_PRINT_SETTINGS_DIR,
            print_profile,
            fallback_first=not strict_process,
            machine_profile_json=machine_json,
        )
        filament_json = _pick_profile_json(
            SLICER_PROFILE_FILAMENT_DIR,
            filament_profile,
            fallback_first=not strict_filament,
            machine_profile_json=machine_json,
            process_profile_json=process_json,
        )

    if (not machine_json) or (not process_json) or (not filament_json):
        discovered_profile_root = _find_bambu_profile_root(executable)

    if discovered_profile_root:
        if not machine_json:
            machine_json = _pick_profile_json(
                discovered_profile_root / "machine",
                printer_profile,
                fallback_first=not strict_machine,
            )

        if not process_json:
            process_json = _pick_profile_json(
                discovered_profile_root / "process",
                print_profile,
                fallback_first=not strict_process,
                machine_profile_json=machine_json,
            )

        if not filament_json:
            filament_json = _pick_profile_json(
                discovered_profile_root / "filament",
                filament_profile,
                fallback_first=not strict_filament,
                machine_profile_json=machine_json,
                process_profile_json=process_json,
            )

    return machine_json, process_json, filament_json


def _count_profile_extruder_hint_items(value: Any) -> int:
    if value is None:
        return 0

    # Prefer counting distinct extruder IDs (1,2,...) over raw list length.
    # Some profiles contain repeated per-setting values (e.g. "1,1,1,1,1"),
    # which should still represent a single extruder mapping.
    numeric_tokens = _extract_float_numbers(value, max_items=64)
    extruder_ids: set[int] = set()
    for token in numeric_tokens:
        rounded = int(round(float(token)))
        if rounded <= 0:
            continue
        if abs(float(token) - float(rounded)) > 1e-6:
            continue
        extruder_ids.add(rounded)
    if extruder_ids:
        return len(extruder_ids)

    if isinstance(value, (list, tuple, set)):
        compact = [item for item in value if str(item or "").strip()]
        return len(compact)
    if isinstance(value, dict):
        best = 0
        for nested in value.values():
            best = max(best, _count_profile_extruder_hint_items(nested))
        return best

    text = str(value or "").strip()
    if not text:
        return 0

    split_tokens = [part.strip() for part in re.split(r"[;,|]", text) if part.strip()]
    if len(split_tokens) > 1:
        return len(split_tokens)

    numeric_tokens = _extract_float_numbers(value, max_items=8)
    if len(numeric_tokens) > 1:
        return len(numeric_tokens)

    return 1


def _infer_required_extruder_count_for_slice(machine_json: str, process_json: str) -> int:
    detected = 0
    machine_detected = 0

    for json_path, is_machine in ((machine_json, True), (process_json, False)):
        path = Path(str(json_path or "").strip())
        if not path.exists() or not path.is_file():
            continue
        payload = _read_profile_json_payload(path)
        if not isinstance(payload, dict):
            continue

        count_value = payload.get("extruder_count")
        if count_value is not None:
            try:
                parsed_count = int(float(str(count_value).strip()))
            except Exception:
                parsed_count = 0
            detected = max(detected, parsed_count)
            if is_machine:
                machine_detected = max(machine_detected, parsed_count)

        for hint_key in ("print_extruder_id", "printer_extruder_id"):
            if hint_key not in payload:
                continue
            detected = max(detected, _count_profile_extruder_hint_items(payload.get(hint_key)))

    profile_text = f"{machine_json} {process_json}".lower()
    if "h2d" in profile_text:
        detected = max(detected, 2)
        machine_detected = max(machine_detected, 2)
    elif detected <= 1 and any(token in profile_text for token in ("dual", "idex")):
        detected = 2

    # Never expand filaments beyond the machine's own extruder count when known.
    if machine_detected > 0:
        detected = min(detected, machine_detected)

    return max(1, detected)


def _expand_load_filaments_for_extruders(load_filaments: str, extruder_count: int) -> str:
    parts = [part.strip() for part in str(load_filaments or "").split(";") if part.strip()]
    if not parts:
        return ""
    wanted = max(1, int(extruder_count or 1))
    if len(parts) >= wanted:
        return ";".join(parts[:wanted])
    expanded = list(parts)
    while len(expanded) < wanted:
        expanded.append(expanded[-1])
    return ";".join(expanded)


_PROCESS_PROFILE_META_KEYS = {
    "type",
    "from",
    "name",
    "inherits",
    "setting_id",
    "print_settings_id",
    "process_settings_id",
    "printer_settings_id",
    "filament_settings_id",
    "instantiation",
    "description",
    "author",
    "version",
    "created_at",
    "updated_at",
    "uuid",
    "compatible_printers",
    "compatible_printer",
    "compatible_processes",
    "compatible_process",
    "compatible_print_profiles",
    "compatible_print_profile",
    "compatible_prints",
    "compatible_print",
    "compatible_machines",
    "compatible_machine",
}

_PROCESS_SETTINGS_CONTAINER_KEYS = (
    "settings",
    "setting_values",
    "values",
    "process_settings",
    "print_settings",
    "config",
    "parameters",
    "params",
)


def _normalize_process_setting_scalar(value: Any) -> Optional[Any]:
    if isinstance(value, bool):
        return bool(value)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            number = float(value)
        except Exception:
            return None
        if not math.isfinite(number):
            return None
        if isinstance(value, int):
            return int(value)
        return round(number, 6)
    if isinstance(value, str):
        return str(value)
    return None


def _dedupe_process_setting_scalars(values: Iterable[Any], max_items: int = 128) -> list[Any]:
    out: list[Any] = []
    seen: set[str] = set()
    for raw in values:
        normalized = _normalize_process_setting_scalar(raw)
        if normalized is None:
            continue
        key = f"{type(normalized).__name__}:{normalized}"
        if key in seen:
            continue
        seen.add(key)
        out.append(normalized)
        if len(out) >= max_items:
            break
    return out


def _extract_process_setting_value_and_options(raw_value: Any) -> tuple[Optional[Any], list[Any]]:
    scalar = _normalize_process_setting_scalar(raw_value)
    if scalar is not None:
        return scalar, []

    if isinstance(raw_value, (list, tuple)):
        choices = _dedupe_process_setting_scalars(raw_value)
        if not choices:
            nested_choices: list[Any] = []
            for item in raw_value:
                nested_value, _nested_options = _extract_process_setting_value_and_options(item)
                if nested_value is not None:
                    nested_choices.append(nested_value)
            choices = _dedupe_process_setting_scalars(nested_choices)
        if not choices:
            return None, []
        if len(choices) == 1:
            return choices[0], []
        return choices[0], choices

    if isinstance(raw_value, dict):
        preferred_value: Optional[Any] = None
        for key in ("current", "selected", "value", "default"):
            if key not in raw_value:
                continue
            preferred_value = _normalize_process_setting_scalar(raw_value.get(key))
            if preferred_value is not None:
                break

        choices: list[Any] = []
        for key in ("options", "choices", "enum", "allowed_values", "values", "items"):
            if key not in raw_value:
                continue
            value = raw_value.get(key)
            if isinstance(value, (list, tuple)):
                choices = _dedupe_process_setting_scalars(value)
                if not choices:
                    nested_choices: list[Any] = []
                    for item in value:
                        nested_value, _nested_options = _extract_process_setting_value_and_options(item)
                        if nested_value is not None:
                            nested_choices.append(nested_value)
                    choices = _dedupe_process_setting_scalars(nested_choices)
            else:
                parsed_single = _normalize_process_setting_scalar(value)
                choices = [parsed_single] if parsed_single is not None else []
            if choices:
                break

        if preferred_value is None and choices:
            preferred_value = choices[0]

        if preferred_value is None:
            return None, []

        if choices:
            normalized_choices = _dedupe_process_setting_scalars([preferred_value, *choices])
            if len(normalized_choices) > 1:
                return preferred_value, normalized_choices
        return preferred_value, []

    return None, []


def _extract_effective_process_settings_from_payload(payload: Optional[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, list[Any]]]:
    if not isinstance(payload, dict):
        return {}, {}

    settings: dict[str, Any] = {}
    setting_options: dict[str, list[Any]] = {}

    visited_nodes: set[int] = set()

    def _normalize_setting_key(raw_key: Any, include_meta_keys: bool) -> str:
        key = str(raw_key or "").strip()[:120]
        if not key:
            return ""
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", key):
            return ""
        if not include_meta_keys and key in _PROCESS_PROFILE_META_KEYS:
            return ""
        return key

    def _record_setting(key_raw: Any, value_raw: Any, include_meta_keys: bool) -> bool:
        key = _normalize_setting_key(key_raw, include_meta_keys)
        if not key:
            return False

        value, options = _extract_process_setting_value_and_options(value_raw)
        if value is None:
            return False

        settings[key] = value
        if len(options) > 1:
            setting_options[key] = options
        return True

    def _extract_list_setting_entry(item: Any) -> tuple[str, Any]:
        if not isinstance(item, dict):
            return "", None

        entry_key = ""
        for key_name in ("key", "name", "id", "setting", "setting_key", "parameter", "param"):
            raw_name = item.get(key_name)
            if raw_name is None:
                continue
            candidate = str(raw_name).strip()
            if candidate:
                entry_key = candidate
                break

        if not entry_key:
            return "", None

        value_payload: Any = item
        for value_key in ("value", "current", "selected", "default"):
            if value_key in item:
                value_payload = item.get(value_key)
                break

        return entry_key, value_payload

    def _walk(node: Any, include_meta_keys: bool, depth: int) -> None:
        if len(settings) >= 2500:
            return
        if depth > 10:
            return

        if isinstance(node, dict):
            node_id = id(node)
            if node_id in visited_nodes:
                return
            visited_nodes.add(node_id)

            for key_raw, value_raw in node.items():
                key = _normalize_setting_key(key_raw, include_meta_keys)
                if not key:
                    continue

                if isinstance(value_raw, (list, tuple)):
                    consumed_list_entries = False
                    for item in value_raw:
                        item_key, item_value = _extract_list_setting_entry(item)
                        if item_key and _record_setting(item_key, item_value, include_meta_keys=True):
                            consumed_list_entries = True
                            if len(settings) >= 2500:
                                return
                            continue
                        if isinstance(item, (dict, list, tuple)):
                            _walk(item, include_meta_keys=True, depth=depth + 1)
                            if len(settings) >= 2500:
                                return
                    if consumed_list_entries:
                        continue

                if _record_setting(key, value_raw, include_meta_keys):
                    if len(settings) >= 2500:
                        return
                    continue

                if isinstance(value_raw, (dict, list, tuple)):
                    _walk(value_raw, include_meta_keys=True, depth=depth + 1)
                    if len(settings) >= 2500:
                        return
            return

        if isinstance(node, (list, tuple)):
            for item in node:
                if isinstance(item, (dict, list, tuple)):
                    _walk(item, include_meta_keys=include_meta_keys, depth=depth + 1)
                    if len(settings) >= 2500:
                        return

    _walk(payload, include_meta_keys=False, depth=0)

    for container_key in _PROCESS_SETTINGS_CONTAINER_KEYS:
        nested = payload.get(container_key)
        if isinstance(nested, (dict, list, tuple)):
            _walk(nested, include_meta_keys=True, depth=1)
            if len(settings) >= 2500:
                break

    return settings, setting_options


def _candidate_process_profile_dirs(executable: str, include_uploaded: bool = False) -> list[Path]:
    out: list[Path] = []
    if include_uploaded and SLICER_PROFILE_PRINT_SETTINGS_DIR.exists() and SLICER_PROFILE_PRINT_SETTINGS_DIR.is_dir():
        out.append(SLICER_PROFILE_PRINT_SETTINGS_DIR)

    discovered_root = _find_bambu_profile_root(executable)
    if discovered_root:
        discovered_process_dir = discovered_root / "process"
        if discovered_process_dir.exists() and discovered_process_dir.is_dir():
            out.append(discovered_process_dir)

    deduped: list[Path] = []
    seen: set[str] = set()
    for path in out:
        key = str(path.resolve()) if path.exists() else str(path)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(path)
    return deduped


def _resolve_effective_process_profile_settings(
    executable: str,
    process_json: str,
    machine_json: str = "",
    include_uploaded: bool = False,
    max_depth: int = 12,
) -> tuple[dict[str, Any], dict[str, list[Any]], list[str]]:
    start_path = Path(str(process_json or "").strip())
    if not start_path.exists() or not start_path.is_file():
        return {}, {}, []

    profile_dirs = _candidate_process_profile_dirs(executable, include_uploaded=include_uploaded)
    if not profile_dirs:
        profile_dirs = [start_path.parent]

    chain: list[str] = []
    visited: set[str] = set()

    def _resolve_parent_profile_path(inherits_name: str, current_path: Path) -> Optional[Path]:
        requested = str(inherits_name or "").strip()
        if not requested:
            return None

        machine_hints = [str(machine_json or "").strip(), ""]

        for profile_dir in profile_dirs:
            for machine_hint in machine_hints:
                candidate = _pick_profile_json(
                    profile_dir,
                    requested,
                    fallback_first=False,
                    machine_profile_json=machine_hint,
                )
                if candidate:
                    candidate_path = Path(candidate)
                    if candidate_path.exists() and candidate_path.is_file():
                        return candidate_path

        for machine_hint in machine_hints:
            same_dir = _pick_profile_json(
                current_path.parent,
                requested,
                fallback_first=False,
                machine_profile_json=machine_hint,
            )
            if same_dir:
                candidate_path = Path(same_dir)
                if candidate_path.exists() and candidate_path.is_file():
                    return candidate_path
        return None

    def _walk(path: Path, depth: int) -> tuple[dict[str, Any], dict[str, list[Any]]]:
        if depth > max_depth:
            return {}, {}

        path_key = str(path.resolve())
        if path_key in visited:
            return {}, {}
        visited.add(path_key)

        payload = _read_profile_json_payload(path)
        if not isinstance(payload, dict):
            chain.append(str(path))
            return {}, {}

        merged_settings: dict[str, Any] = {}
        merged_options: dict[str, list[Any]] = {}

        inherits_names = _slicer_profile_names_from_value(payload.get("inherits"))
        if not inherits_names:
            inherits_names = _slicer_profile_names_from_value(payload.get("from"))
        for inherits_name in inherits_names:
            parent_path = _resolve_parent_profile_path(inherits_name, path)
            if parent_path is None:
                continue
            parent_settings, parent_options = _walk(parent_path, depth + 1)
            merged_settings.update(parent_settings)
            merged_options.update(parent_options)

        current_settings, current_options = _extract_effective_process_settings_from_payload(payload)
        merged_settings.update(current_settings)
        for key, options in current_options.items():
            merged_options[key] = options

        chain.append(str(path))
        return merged_settings, merged_options

    resolved_settings, resolved_options = _walk(start_path, 0)
    return resolved_settings, resolved_options, chain


def _deep_merge_process_profile_payload(base: Any, patch: Any) -> Any:
    if isinstance(base, dict) and isinstance(patch, dict):
        merged: dict[str, Any] = dict(base)
        for key, value in patch.items():
            if key in merged:
                merged[key] = _deep_merge_process_profile_payload(merged.get(key), value)
            else:
                merged[key] = value
        return merged
    return patch


def _resolve_effective_process_profile_payload(
    executable: str,
    process_json: str,
    machine_json: str = "",
    include_uploaded: bool = False,
    max_depth: int = 12,
) -> tuple[dict[str, Any], list[str]]:
    start_path = Path(str(process_json or "").strip())
    if not start_path.exists() or not start_path.is_file():
        return {}, []

    profile_dirs = _candidate_process_profile_dirs(executable, include_uploaded=include_uploaded)
    if not profile_dirs:
        profile_dirs = [start_path.parent]

    chain: list[str] = []
    visited: set[str] = set()

    def _resolve_parent_profile_path(inherits_name: str, current_path: Path) -> Optional[Path]:
        requested = str(inherits_name or "").strip()
        if not requested:
            return None

        machine_hints = [str(machine_json or "").strip(), ""]

        for profile_dir in profile_dirs:
            for machine_hint in machine_hints:
                candidate = _pick_profile_json(
                    profile_dir,
                    requested,
                    fallback_first=False,
                    machine_profile_json=machine_hint,
                )
                if candidate:
                    candidate_path = Path(candidate)
                    if candidate_path.exists() and candidate_path.is_file():
                        return candidate_path

        for machine_hint in machine_hints:
            same_dir = _pick_profile_json(
                current_path.parent,
                requested,
                fallback_first=False,
                machine_profile_json=machine_hint,
            )
            if same_dir:
                candidate_path = Path(same_dir)
                if candidate_path.exists() and candidate_path.is_file():
                    return candidate_path

        return None

    def _walk(path: Path, depth: int) -> dict[str, Any]:
        if depth > max_depth:
            return {}

        path_key = str(path.resolve())
        if path_key in visited:
            return {}
        visited.add(path_key)

        payload = _read_profile_json_payload(path)
        if not isinstance(payload, dict):
            chain.append(str(path))
            return {}

        merged_payload: dict[str, Any] = {}
        inherits_names = _slicer_profile_names_from_value(payload.get("inherits"))
        if not inherits_names:
            inherits_names = _slicer_profile_names_from_value(payload.get("from"))

        for inherits_name in inherits_names:
            parent_path = _resolve_parent_profile_path(inherits_name, path)
            if parent_path is None:
                continue
            parent_payload = _walk(parent_path, depth + 1)
            merged_payload = _deep_merge_process_profile_payload(merged_payload, parent_payload)

        merged_payload = _deep_merge_process_profile_payload(merged_payload, payload)
        chain.append(str(path))
        return merged_payload if isinstance(merged_payload, dict) else {}

    resolved_payload = _walk(start_path, 0)
    return resolved_payload, chain


def _collect_process_settings_catalog(
    executable: str,
    include_uploaded: bool = False,
    max_files: int = 800,
) -> tuple[dict[str, Any], dict[str, list[Any]]]:
    profile_dirs = _candidate_process_profile_dirs(executable, include_uploaded=include_uploaded)
    if not profile_dirs:
        return {}, {}

    defaults: dict[str, Any] = {}
    value_samples: dict[str, list[Any]] = {}
    seen_files: set[str] = set()
    scanned_files = 0

    for profile_dir in profile_dirs:
        expected_type = _expected_profile_type_for_dir(profile_dir)
        try:
            files = sorted((p for p in profile_dir.glob("*.json") if p.is_file()), key=lambda p: p.name.lower())
        except Exception:
            continue

        for profile_file in files:
            if scanned_files >= max_files:
                break

            try:
                file_key = str(profile_file.resolve())
            except Exception:
                file_key = str(profile_file)
            if file_key in seen_files:
                continue
            seen_files.add(file_key)

            payload = _read_profile_json_payload(profile_file)
            if not _profile_payload_is_usable(payload, expected_type):
                continue
            if not isinstance(payload, dict):
                continue

            scanned_files += 1
            current_settings, current_options = _extract_effective_process_settings_from_payload(payload)

            # Many process JSON files are delta-only and rely on inherits.
            # Expand tiny payloads through effective-resolution to get full key coverage.
            if len(current_settings) <= 4:
                try:
                    resolved_settings, resolved_options, _resolved_chain = _resolve_effective_process_profile_settings(
                        executable,
                        str(profile_file),
                        machine_json="",
                    )
                    if len(resolved_settings) > len(current_settings):
                        current_settings = resolved_settings
                        current_options = resolved_options
                except Exception:
                    pass

            for key, value in current_settings.items():
                if key not in defaults:
                    defaults[key] = value

                existing_samples = value_samples.get(key, [])
                value_samples[key] = _dedupe_process_setting_scalars([*existing_samples, value], max_items=64)

            for key, options in current_options.items():
                if not isinstance(options, list):
                    continue
                existing_samples = value_samples.get(key, [])
                value_samples[key] = _dedupe_process_setting_scalars([*existing_samples, *options], max_items=64)

        if scanned_files >= max_files:
            break

    options_map: dict[str, list[Any]] = {}
    for key, values in value_samples.items():
        deduped = _dedupe_process_setting_scalars(values, max_items=64)
        if len(deduped) > 1:
            options_map[key] = deduped

    return defaults, options_map


def _build_modern_profile_args(
    executable: str,
    printer_profile: str,
    print_profile: str,
    filament_profile: str,
    prefer_uploaded: bool = False,
    load_settings_override: str = "",
    auto_pick_when_blank: bool = True,
    process_overrides: Optional[dict[str, Any]] = None,
    preferred_extruder_id_hint: int = 0,
) -> list[str]:
    args: list[str] = []
    normalized_overrides = _normalize_slice_process_overrides(process_overrides or {})

    def _has_explicit_filament_mapping_overrides() -> bool:
        if not isinstance(normalized_overrides, dict):
            return False
        for key in (
            "filament_map_mode",
            "filament_map",
            "filament_nozzle_map",
            "filament_map_2",
            "filament_volume_map",
        ):
            if key not in normalized_overrides:
                continue
            raw = normalized_overrides.get(key)
            if isinstance(raw, str) and not raw.strip():
                continue
            if raw is None:
                continue
            return True
        return False

    def _override_extruder_count_from_overrides() -> int:
        raw = normalized_overrides.get("extruder_count") if isinstance(normalized_overrides, dict) else None
        if raw is None:
            return 0
        try:
            if isinstance(raw, (int, float)) and not isinstance(raw, bool):
                parsed = int(round(float(raw)))
            else:
                nums = _extract_float_numbers(raw, max_items=1)
                parsed = int(round(float(nums[0]))) if nums else 0
        except Exception:
            parsed = 0
        return parsed if parsed > 0 else 0

    def _preferred_single_extruder_from_overrides() -> int:
        for key in ("print_extruder_id", "printer_extruder_id"):
            if key not in normalized_overrides:
                continue
            raw_value = normalized_overrides.get(key)
            if isinstance(raw_value, bool):
                continue
            if isinstance(raw_value, (int, float)) and not isinstance(raw_value, bool):
                try:
                    parsed = int(round(float(raw_value)))
                except Exception:
                    parsed = 0
                return parsed if parsed > 0 else 0
            numbers = _extract_float_numbers(raw_value, max_items=1)
            if numbers:
                try:
                    parsed = int(round(float(numbers[0])))
                except Exception:
                    parsed = 0
                return parsed if parsed > 0 else 0
        return 0

    preferred_extruder_id = _preferred_single_extruder_from_overrides()
    if preferred_extruder_id <= 0:
        try:
            preferred_extruder_id = int(preferred_extruder_id_hint)
        except Exception:
            preferred_extruder_id = 0
    if preferred_extruder_id < 0:
        preferred_extruder_id = 0
    explicit_filament_mapping_overrides = _has_explicit_filament_mapping_overrides()

    effective_load_settings = str(load_settings_override or "").strip() or _effective_bambustudio_load_settings()
    effective_load_filaments = _effective_bambustudio_load_filaments()

    machine_json = ""
    process_json = ""
    filament_json = ""
    should_resolve_profiles = (
        (not effective_load_settings)
        or (not effective_load_filaments)
        or (preferred_extruder_id > 0)
    )
    if should_resolve_profiles:
        machine_json, process_json, filament_json = _resolve_selected_profile_jsons(
            executable,
            printer_profile,
            print_profile,
            filament_profile,
            prefer_uploaded=prefer_uploaded,
            auto_pick_when_blank=auto_pick_when_blank,
        )

    override_extruders = _override_extruder_count_from_overrides()
    required_extruders = override_extruders or _infer_required_extruder_count_for_slice(machine_json, process_json)
    if required_extruders <= 0:
        required_extruders = 1

    # If caller provided load-filaments explicitly (from env/runtime config),
    # expand it to the required extruder count so dual-extruder profiles do not
    # fail auto mapping when only one filament entry is present.
    if effective_load_filaments:
        desired_filament_slots = 1 if explicit_filament_mapping_overrides else required_extruders
        effective_load_filaments = _expand_load_filaments_for_extruders(
            effective_load_filaments,
            desired_filament_slots,
        )

    if not effective_load_settings and machine_json:
        explicit_process_selected = bool(str(print_profile or "").strip())
        if explicit_process_selected and process_json:
            args.extend(["--load-settings", f"{machine_json};{process_json}"])
        else:
            # Compatibility mode for auto-process selection: let Bambu pick a
            # matching process for the selected machine instead of forcing
            # potentially incompatible process JSON into --load-settings.
            args.extend(["--load-settings", machine_json])

    if effective_load_settings:
        args.extend(["--load-settings", effective_load_settings])
    if effective_load_filaments:
        args.extend(["--load-filaments", effective_load_filaments])

    if effective_load_settings and effective_load_filaments:
        return args

    if not effective_load_filaments and filament_json:
        desired_filament_slots = 1 if explicit_filament_mapping_overrides else required_extruders
        effective_filaments = _expand_load_filaments_for_extruders(filament_json, desired_filament_slots)
        args.extend(["--load-filaments", effective_filaments])

    return args


def _normalize_slice_support_mode(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in {"auto", "on", "off"} else "auto"


def _normalize_slice_support_type(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in {"", "tree(auto)", "normal(auto)"} else ""


def _normalize_slice_support_style(value: Any) -> str:
    normalized = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    if normalized in {"tree_slim", "treeslim"}:
        normalized = "tree_slim"
    elif normalized in {"tree_strong", "treestrong"}:
        normalized = "tree_strong"
    elif normalized in {"tree_hybrid", "treehybrid"}:
        normalized = "tree_hybrid"
    elif normalized in {"tree_organic", "treeorganic"}:
        normalized = "tree_organic"
    elif normalized in {"default_style", "auto"}:
        normalized = "default"
    allowed = {
        "",
        "default",
        "grid",
        "snug",
        "tree_slim",
        "tree_strong",
        "tree_hybrid",
        "tree_organic",
    }
    return normalized if normalized in allowed else ""


def _normalize_slice_nozzle_diameter(value: Any) -> str:
    raw = str(value or "").strip().replace(",", ".")
    if not raw:
        return ""
    try:
        parsed = float(raw)
    except Exception:
        return ""
    if not math.isfinite(parsed) or parsed <= 0:
        return ""
    # Keep to common desktop FDM nozzle sizes used by Bambu profiles.
    allowed = {0.2, 0.4, 0.6, 0.8, 1.0}
    rounded = round(parsed, 1)
    if rounded not in allowed:
        return ""
    return f"{rounded:.1f}"


def _normalize_slice_nozzle_flow(value: Any) -> str:
    normalized = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    if normalized == "normal":
        normalized = "standard"
    return normalized if normalized in {"", "standard", "high_flow"} else ""


def _normalize_slice_print_nozzle(value: Any) -> str:
    normalized = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    if not normalized:
        return ""
    if normalized in {"left", "venstre", "l", "1"}:
        return "left"
    if normalized in {"right", "hojre", "højre", "r", "2"}:
        return "right"
    return ""


def _normalize_slice_process_overrides(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}

    out: dict[str, Any] = {}
    for key_raw, value_raw in raw.items():
        key = str(key_raw or "").strip()[:120]
        if not key:
            continue
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", key):
            continue

        value: Any = None
        if isinstance(value_raw, bool):
            value = bool(value_raw)
        elif isinstance(value_raw, (int, float)) and not isinstance(value_raw, bool):
            try:
                number = float(value_raw)
            except Exception:
                continue
            if not math.isfinite(number):
                continue
            if isinstance(value_raw, int):
                value = int(value_raw)
            else:
                value = float(round(number, 6))
        elif isinstance(value_raw, str):
            value = str(value_raw)[:400]
        else:
            continue

        out[key] = value
        if len(out) >= 400:
            break

    return out


def _coerce_process_override_value_like(existing: Any, incoming: Any) -> Any:
    if isinstance(existing, bool):
        if isinstance(incoming, bool):
            return incoming
        text = str(incoming or "").strip().lower()
        return text in {"1", "true", "yes", "on"}

    if isinstance(existing, int) and not isinstance(existing, bool):
        if isinstance(incoming, (int, float)) and not isinstance(incoming, bool):
            try:
                parsed = int(round(float(incoming)))
                return parsed
            except Exception:
                return existing
        return existing

    if isinstance(existing, float):
        if isinstance(incoming, (int, float)) and not isinstance(incoming, bool):
            try:
                parsed = float(incoming)
                if math.isfinite(parsed):
                    return round(parsed, 6)
            except Exception:
                return existing
        return existing

    if isinstance(existing, str):
        if isinstance(incoming, bool):
            return "true" if incoming else "false"
        return str(incoming)

    if isinstance(existing, (list, tuple)):
        existing_items = list(existing)
        if not existing_items:
            return [incoming]

        template = existing_items[0]
        if isinstance(template, (list, tuple, dict)):
            return [incoming]

        coerced_item = _coerce_process_override_value_like(template, incoming)
        return [coerced_item for _ in existing_items]

    return incoming


def _profile_bool_setting_value(existing: Any, enabled: bool) -> Any:
    if isinstance(existing, bool):
        return enabled
    if isinstance(existing, (int, float)) and not isinstance(existing, bool):
        return 1 if enabled else 0
    if isinstance(existing, str):
        text = str(existing).strip().lower()
        if text in {"true", "false", "yes", "no", "on", "off"}:
            return "true" if enabled else "false"
        return "1" if enabled else "0"
    return "1" if enabled else "0"


def _build_support_override_load_settings(
    executable: str,
    output_gcode: Path,
    printer_profile: str,
    print_profile: str,
    filament_profile: str,
    support_mode: str,
    support_type: str,
    support_style: str,
    process_overrides: Optional[dict[str, Any]] = None,
    nozzle_left_diameter: str = "",
    nozzle_right_diameter: str = "",
    nozzle_left_flow: str = "",
    nozzle_right_flow: str = "",
    force_runtime_compat: bool = False,
) -> tuple[str, list[Path], str]:
    normalized_mode = _normalize_slice_support_mode(support_mode)
    normalized_type = _normalize_slice_support_type(support_type)
    normalized_style = _normalize_slice_support_style(support_style)
    normalized_process_overrides = _normalize_slice_process_overrides(process_overrides or {})

    def _build_cli_override_args(overrides: dict[str, Any]) -> list[str]:
        if not isinstance(overrides, dict) or not overrides:
            return []

        ordered_keys = (
            "filament_map_mode",
            "filament_map",
            "filament_nozzle_map",
            "filament_volume_map",
            "print_extruder_id",
            "printer_extruder_id",
            "extruder_count",
            "extruder_nozzle_count",
            "extruder_nozzle_volume_type",
        )

        def _to_scalar_text(raw: Any) -> str:
            if raw is None:
                return ""
            if isinstance(raw, bool):
                return "1" if raw else "0"
            if isinstance(raw, int) and not isinstance(raw, bool):
                return str(raw)
            if isinstance(raw, float):
                if not math.isfinite(raw):
                    return ""
                rounded = round(raw, 6)
                if abs(rounded - int(round(rounded))) < 1e-9:
                    return str(int(round(rounded)))
                return f"{rounded:g}"
            return str(raw).strip()

        cli_args: list[str] = []
        for key in ordered_keys:
            if key not in overrides:
                continue
            text = _to_scalar_text(overrides.get(key))
            if not text:
                continue

            if key == "filament_map_mode":
                normalized_mode = text.lower().replace("_", " ").replace("-", " ").strip()
                if normalized_mode in {"manual", "manual map"}:
                    text = "Manual"
                elif normalized_mode in {"nozzle manual", "nozzlemanual"}:
                    text = "Nozzle Manual"
                elif normalized_mode in {"auto for flush", "auto flush", "autoforflush"}:
                    text = "Auto For Flush"
                elif normalized_mode in {"auto for match", "auto match", "autoformatch"}:
                    text = "Auto For Match"
                elif normalized_mode in {"auto for quality", "auto quality", "autoforquality"}:
                    text = "Auto For Quality"
                elif normalized_mode == "auto":
                    text = "Auto For Flush"

            if key in {
                "filament_map",
                "filament_nozzle_map",
                "filament_volume_map",
                "print_extruder_id",
                "printer_extruder_id",
                "extruder_count",
                "extruder_nozzle_count",
                "extruder_nozzle_volume_type",
            }:
                text = text.replace(";", ",").replace("|", ",")

            cli_args.append(f"--{key}={text}")

        return cli_args

    cli_override_args = _build_cli_override_args(normalized_process_overrides)
    # Keep nozzle-side hints out of temporary process override payloads unless
    # we're explicitly applying filament mapping (3MF-aligned flow).
    mapping_override_keys = {
        "filament_map_mode",
        "filament_map",
        "filament_nozzle_map",
        "filament_map_2",
        "filament_volume_map",
    }
    has_explicit_mapping_overrides = any(
        key in normalized_process_overrides and str(normalized_process_overrides.get(key) or "").strip()
        for key in mapping_override_keys
    )
    exclude_keys = set()
    if not has_explicit_mapping_overrides:
        exclude_keys = {"print_extruder_id", "printer_extruder_id"}
    profile_process_overrides: dict[str, Any] = {
        key: value
        for key, value in normalized_process_overrides.items()
        if key not in exclude_keys
    }
    normalized_nozzle_left_diameter = _normalize_slice_nozzle_diameter(nozzle_left_diameter)
    normalized_nozzle_right_diameter = _normalize_slice_nozzle_diameter(nozzle_right_diameter)
    normalized_nozzle_left_flow = _normalize_slice_nozzle_flow(nozzle_left_flow)
    normalized_nozzle_right_flow = _normalize_slice_nozzle_flow(nozzle_right_flow)

    if normalized_nozzle_right_diameter and not normalized_nozzle_left_diameter:
        normalized_nozzle_left_diameter = normalized_nozzle_right_diameter
    if normalized_nozzle_right_flow and not normalized_nozzle_left_flow:
        normalized_nozzle_left_flow = normalized_nozzle_right_flow

    # If nozzle settings simply mirror the selected machine defaults, avoid
    # generating a temporary process override file.
    if (
        normalized_mode == "auto"
        and not normalized_type
        and not normalized_style
        and not profile_process_overrides
        and not force_runtime_compat
    ):
        machine_nozzle = ""
        machine_nozzle_match = re.search(
            r"(\d+(?:[.,]\d+)?)\s*nozzle\b",
            str(printer_profile or ""),
            flags=re.IGNORECASE,
        )
        if machine_nozzle_match:
            machine_nozzle = _normalize_slice_nozzle_diameter(machine_nozzle_match.group(1))
        left_d = normalized_nozzle_left_diameter
        right_d = normalized_nozzle_right_diameter or left_d
        left_f = normalized_nozzle_left_flow or "standard"
        right_f = normalized_nozzle_right_flow or left_f
        if (
            machine_nozzle
            and left_d
            and right_d
            and left_d == right_d == machine_nozzle
            and left_f == right_f == "standard"
        ):
            return "", [], ""

    if (
        normalized_mode == "auto"
        and not normalized_type
        and not normalized_style
        and not profile_process_overrides
        and not normalized_nozzle_left_diameter
        and not normalized_nozzle_right_diameter
        and not normalized_nozzle_left_flow
        and not normalized_nozzle_right_flow
        and not force_runtime_compat
    ):
        return "", [], ""

    machine_json, process_json, _filament_json = _resolve_selected_profile_jsons(
        executable,
        str(printer_profile or "").strip(),
        str(print_profile or "").strip(),
        str(filament_profile or "").strip(),
        prefer_uploaded=False,
    )

    if not machine_json or not process_json:
        return "", [], "Profile-overrides kraever machine+process profiler (JSON)."

    process_payload = _read_profile_json_payload(Path(process_json))
    if not isinstance(process_payload, dict):
        return "", [], "Kunne ikke laese valgt process-profil som JSON."

    selected_process_name = str(
        process_payload.get("print_settings_id")
        or process_payload.get("process_settings_id")
        or process_payload.get("setting_id")
        or process_payload.get("name")
        or print_profile
        or "fjordshare-process"
    ).strip()
    if not selected_process_name:
        selected_process_name = "fjordshare-process"

    resolved_payload, _resolved_chain = _resolve_effective_process_profile_payload(
        executable,
        process_json,
        machine_json=machine_json,
    )
    patched_payload = dict(process_payload)
    override_template_payload = (
        dict(resolved_payload)
        if isinstance(resolved_payload, dict) and resolved_payload
        else dict(process_payload)
    )
    # Keep inherits chain so modern Bambu builds can still resolve full process defaults,
    # but force metadata accepted for external JSON files loaded through --load-settings.
    patched_payload["type"] = "process"
    patched_payload["from"] = "user"
    patched_payload["name"] = selected_process_name
    patched_payload["setting_id"] = selected_process_name
    if "print_settings_id" in patched_payload:
        patched_payload["print_settings_id"] = selected_process_name
    if "process_settings_id" in patched_payload:
        patched_payload["process_settings_id"] = selected_process_name

    # Some multi-extruder machine/process combos require these keys to exist explicitly
    # in the loaded process payload (observed on H2D with nozzle_volume_type errors).
    template_settings, _template_options = _extract_effective_process_settings_from_payload(override_template_payload)
    machine_payload = _read_profile_json_payload(Path(machine_json)) if machine_json else None
    patched_machine_payload = dict(machine_payload) if isinstance(machine_payload, dict) else None

    def _dedupe_numbers(values: Iterable[float], max_items: int = 8) -> list[float]:
        out: list[float] = []
        seen: set[str] = set()
        for raw in values:
            try:
                parsed = float(raw)
            except Exception:
                continue
            if not math.isfinite(parsed):
                continue
            key = f"{parsed:.6f}"
            if key in seen:
                continue
            seen.add(key)
            out.append(parsed)
            if len(out) >= max_items:
                break
        return out

    def _dedupe_text_values(values: Iterable[str], max_items: int = 8) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        for raw in values:
            text = str(raw or "").strip()
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(text)
            if len(out) >= max_items:
                break
        return out

    def _extract_text_tokens(value: Any, max_items: int = 8) -> list[str]:
        if value is None:
            return []

        out: list[str] = []
        queue: list[Any] = [value]

        while queue and len(out) < max_items:
            current = queue.pop(0)
            if current is None:
                continue
            if isinstance(current, dict):
                queue.extend(current.values())
                continue
            if isinstance(current, (list, tuple, set)):
                queue.extend(list(current))
                continue

            text = str(current or "").strip()
            if not text:
                continue

            if text.startswith("[") and text.endswith("]"):
                try:
                    parsed = json.loads(text)
                except Exception:
                    parsed = None
                if isinstance(parsed, (list, tuple, set, dict)):
                    queue.append(parsed)
                    continue

            split_tokens = [part.strip() for part in re.split(r"[;,|]", text) if part.strip()]
            if len(split_tokens) > 1:
                queue.extend(split_tokens)
                continue

            out.append(text)

        return _dedupe_text_values(out, max_items=max_items)

    def _is_nozzle_volume_enum_candidate(value: Any) -> bool:
        text = str(value or "").strip()
        if not text:
            return False
        if text.startswith("<") and text.endswith(">"):
            return False
        if re.fullmatch(r"[-+]?\d+(?:\.\d+)?", text):
            return False
        return True

    def _canonical_nozzle_volume_type_value(value: Any) -> str:
        text = str(value or "").strip()
        if not text:
            return ""
        normalized = text.lower().replace("-", "_").replace(" ", "_")
        if normalized in {"standard", "normal"}:
            return "Standard"
        if normalized in {"high_flow", "highflow"}:
            return "High Flow"
        return text

    def _detect_extruder_count() -> int:
        forced_from_override = 0
        try:
            raw_forced = profile_process_overrides.get("extruder_count")
            if raw_forced is not None:
                forced_from_override = int(float(str(raw_forced).strip()))
        except Exception:
            forced_from_override = 0

        preferred_extruder_from_override = 0
        for key in ("print_extruder_id", "printer_extruder_id"):
            if key not in profile_process_overrides:
                continue
            try:
                parsed = _extract_float_numbers(profile_process_overrides.get(key), max_items=1)
                if parsed:
                    candidate = int(round(float(parsed[0])))
                    if candidate > 0:
                        preferred_extruder_from_override = candidate
                        break
            except Exception:
                continue

        def _count_hint_items(value: Any) -> int:
            if value is None:
                return 0
            numeric_tokens = _extract_float_numbers(value, max_items=64)
            extruder_ids: set[int] = set()
            for token in numeric_tokens:
                rounded = int(round(float(token)))
                if rounded <= 0:
                    continue
                if abs(float(token) - float(rounded)) > 1e-6:
                    continue
                extruder_ids.add(rounded)
            if extruder_ids:
                return len(extruder_ids)
            if isinstance(value, (list, tuple, set)):
                compact = [item for item in value if str(item or "").strip()]
                return len(compact)
            if isinstance(value, dict):
                best = 0
                for nested in value.values():
                    best = max(best, _count_hint_items(nested))
                return best

            text = str(value or "").strip()
            if not text:
                return 0

            split_tokens = [part.strip() for part in re.split(r"[;,|]", text) if part.strip()]
            if len(split_tokens) > 1:
                return len(split_tokens)

            numeric_tokens = _extract_float_numbers(value, max_items=8)
            if len(numeric_tokens) > 1:
                return len(numeric_tokens)

            return 1

        detected = 0
        for source in (template_settings, override_template_payload, machine_payload):
            if not isinstance(source, dict):
                continue
            count_value = source.get("extruder_count")
            if count_value is None:
                parsed_count = 0
            else:
                try:
                    parsed_count = int(float(str(count_value).strip()))
                except Exception:
                    parsed_count = 0
            if parsed_count > detected:
                detected = parsed_count

            for hint_key in (
                "printer_extruder_id",
                "print_extruder_id",
            ):
                if hint_key not in source:
                    continue
                hint_count = _count_hint_items(source.get(hint_key))
                if hint_count > detected:
                    detected = hint_count

        profile_text = f"{printer_profile} {selected_process_name}".lower()
        if forced_from_override > 0:
            detected = forced_from_override
        elif "h2d" in profile_text:
            # H2D is dual extruder; force a stable value and avoid noisy hints.
            detected = 2
        elif detected <= 1 and any(token in profile_text for token in ("dual", "idex")):
            detected = 2
        elif preferred_extruder_from_override > 0 and detected <= 0:
            detected = 1
        return detected

    detected_extruder_count = _detect_extruder_count()

    def _expand_values_for_extruders(values: list[str]) -> list[str]:
        compact = [str(v or "").strip() for v in values if str(v or "").strip()]
        if not compact:
            return []
        wanted = detected_extruder_count if detected_extruder_count > 0 else len(compact)
        if wanted <= 1:
            return [compact[0]]
        expanded = list(compact)
        while len(expanded) < wanted:
            expanded.append(expanded[-1])
        return expanded[:wanted]

    def _expand_nozzle_volume_values(values: list[str]) -> list[str]:
        canonical_candidates = [_canonical_nozzle_volume_type_value(v) for v in values]
        compact = [str(v or "").strip() for v in canonical_candidates if _is_nozzle_volume_enum_candidate(v)]
        if not compact:
            return []
        wanted = detected_extruder_count if detected_extruder_count > 0 else len(compact)
        if wanted <= 1:
            return [compact[0]]
        expanded = list(compact)
        while len(expanded) < wanted:
            expanded.append(expanded[-1])
        return expanded[:wanted]

    def _guess_nozzle_volume_type_value() -> Optional[str]:
        nozzle_candidates: list[str] = []

        for source in (template_settings, override_template_payload, machine_payload):
            if not isinstance(source, dict):
                continue
            for key in (
                "nozzle_volume_type",
                "default_nozzle_volume_type",
            ):
                if key in source:
                    nozzle_candidates.extend(_extract_text_tokens(source.get(key), max_items=8))

        candidate_values = _expand_nozzle_volume_values(_dedupe_text_values(nozzle_candidates, max_items=8))
        if candidate_values:
            return ",".join(candidate_values)

        fallback_values = ["Standard"]
        if detected_extruder_count > 1:
            fallback_values = ["Standard"] * detected_extruder_count
        return ",".join(fallback_values)

    def _guess_nozzle_diameter_value() -> Optional[str]:
        nozzle_candidates: list[float] = []

        for source in (template_settings, override_template_payload, machine_payload):
            if not isinstance(source, dict):
                continue
            for key in (
                "nozzle_diameter",
                "nozzle_diameters",
                "nozzle_size",
                "nozzle_sizes",
                "nozzle",
            ):
                if key in source:
                    nozzle_candidates.extend(_extract_float_numbers(source.get(key), max_items=8))

        if not nozzle_candidates:
            match = re.search(
                r"(\d+(?:\.\d+)?)\s*nozzle",
                f"{printer_profile} {selected_process_name}",
                flags=re.IGNORECASE,
            )
            if match:
                try:
                    nozzle_candidates.append(float(match.group(1)))
                except Exception:
                    pass

        nozzles = _dedupe_numbers(nozzle_candidates, max_items=8)
        if not nozzles:
            return None

        if detected_extruder_count > 1:
            expanded = list(nozzles)
            while len(expanded) < detected_extruder_count:
                expanded.append(expanded[-1])
            expanded = expanded[:detected_extruder_count]
            return ",".join(f"{value:g}" for value in expanded)

        return f"{nozzles[0]:g}"

    def _compose_user_nozzle_values() -> tuple[list[str], list[str]]:
        diameter_values: list[str] = []
        if normalized_nozzle_left_diameter:
            diameter_values.append(normalized_nozzle_left_diameter)
        if normalized_nozzle_right_diameter:
            diameter_values.append(normalized_nozzle_right_diameter)

        volume_type_values: list[str] = []
        if normalized_nozzle_left_flow:
            volume_type_values.append(_canonical_nozzle_volume_type_value(normalized_nozzle_left_flow))
        if normalized_nozzle_right_flow:
            volume_type_values.append(_canonical_nozzle_volume_type_value(normalized_nozzle_right_flow))

        return _expand_values_for_extruders(diameter_values), _expand_nozzle_volume_values(volume_type_values)

    runtime_compat_changed = False
    machine_runtime_changed = False
    user_nozzle_diameter_values, user_nozzle_flow_values = _compose_user_nozzle_values()

    def _process_settings_container() -> Optional[dict[str, Any]]:
        for container_key in _PROCESS_SETTINGS_CONTAINER_KEYS:
            container = patched_payload.get(container_key)
            if isinstance(container, dict):
                return container
        return None

    def _set_runtime_value(key: str, value: Any) -> None:
        nonlocal runtime_compat_changed
        if value is None:
            return
        if isinstance(value, str) and not value.strip():
            return
        settings_container = _process_settings_container()
        if isinstance(settings_container, dict):
            if key not in settings_container or settings_container.get(key) != value:
                settings_container[key] = value
                runtime_compat_changed = True
            if key in patched_payload and patched_payload.get(key) != value:
                patched_payload[key] = value
                runtime_compat_changed = True
            return
        if patched_payload.get(key) != value:
            patched_payload[key] = value
            runtime_compat_changed = True

    _MACHINE_SETTINGS_CONTAINER_KEYS = (
        *_PROCESS_SETTINGS_CONTAINER_KEYS,
        "machine_settings",
        "printer_settings",
        "machine",
        "printer",
    )

    def _machine_settings_container() -> Optional[dict[str, Any]]:
        if not isinstance(patched_machine_payload, dict):
            return None
        for container_key in _MACHINE_SETTINGS_CONTAINER_KEYS:
            container = patched_machine_payload.get(container_key)
            if isinstance(container, dict):
                return container
        return None

    def _set_machine_runtime_value(key: str, value: Any) -> None:
        nonlocal machine_runtime_changed
        if not isinstance(patched_machine_payload, dict):
            return
        if value is None:
            return
        if isinstance(value, str) and not value.strip():
            return

        settings_container = _machine_settings_container()
        if isinstance(settings_container, dict):
            if key not in settings_container or settings_container.get(key) != value:
                settings_container[key] = value
                machine_runtime_changed = True

        if key not in patched_machine_payload or patched_machine_payload.get(key) != value:
            patched_machine_payload[key] = value
            machine_runtime_changed = True

    def _typed_extruder_count_for_process(desired_count: int) -> Any:
        settings_container = _process_settings_container()
        for source in (settings_container, patched_payload, template_settings, override_template_payload):
            if not isinstance(source, dict) or "extruder_count" not in source:
                continue
            return _coerce_process_override_value_like(source.get("extruder_count"), desired_count)
        return str(max(0, int(desired_count)))

    def _split_csv_tokens(value: Any) -> list[str]:
        text = str(value or "").strip()
        if not text:
            return []
        return [part.strip() for part in re.split(r"[;,|]", text) if part.strip()]

    def _typed_nozzle_volume_type_for_process(desired_values: list[str], preferred_key: str = "") -> Any:
        expanded = _expand_nozzle_volume_values(desired_values)
        if not expanded:
            return ""
        settings_container = _process_settings_container()
        key_order = [preferred_key] if preferred_key else []
        key_order.extend([k for k in ("nozzle_volume_type", "default_nozzle_volume_type") if k not in key_order])
        for source in (settings_container, patched_payload, process_payload, override_template_payload, resolved_payload):
            if not isinstance(source, dict):
                continue
            for key in key_order:
                if key not in source:
                    continue
                existing = source.get(key)
                if isinstance(existing, (list, tuple, set)):
                    return list(expanded)
                if isinstance(existing, str):
                    text = existing.strip()
                    if text.startswith("[") and text.endswith("]"):
                        return list(expanded)
                    return ",".join(expanded)
                return ",".join(expanded)
        if len(expanded) > 1:
            return list(expanded)
        return expanded[0]

    def _typed_nozzle_diameter_for_process(desired_values: list[str], preferred_key: str = "") -> Any:
        expanded = _expand_values_for_extruders(desired_values)
        if not expanded:
            return ""
        settings_container = _process_settings_container()
        key_order = [preferred_key] if preferred_key else []
        key_order.extend([k for k in ("nozzle_diameter", "nozzle_diameters") if k not in key_order])
        for source in (settings_container, patched_payload, process_payload, override_template_payload, resolved_payload):
            if not isinstance(source, dict):
                continue
            for key in key_order:
                if key not in source:
                    continue
                existing = source.get(key)
                if isinstance(existing, (list, tuple, set)):
                    return list(expanded)
                if isinstance(existing, str):
                    text = existing.strip()
                    if text.startswith("[") and text.endswith("]"):
                        return list(expanded)
                    return ",".join(expanded)
                return ",".join(expanded)
        if len(expanded) > 1:
            return list(expanded)
        return expanded[0]

    def _process_has_key(key: str) -> bool:
        settings_container = _process_settings_container()
        if isinstance(settings_container, dict) and key in settings_container:
            return True
        if key in patched_payload:
            return True
        if key in template_settings:
            return True
        return key in override_template_payload

    effective_nozzle_diameter_value = ",".join(user_nozzle_diameter_values) if user_nozzle_diameter_values else ""
    if not effective_nozzle_diameter_value:
        effective_nozzle_diameter_value = _guess_nozzle_diameter_value() or ""

    effective_nozzle_volume_type_value = ",".join(user_nozzle_flow_values) if user_nozzle_flow_values else ""
    if not effective_nozzle_volume_type_value:
        effective_nozzle_volume_type_value = _guess_nozzle_volume_type_value() or ""
    effective_nozzle_diameter_values = _expand_values_for_extruders(_split_csv_tokens(effective_nozzle_diameter_value))
    effective_nozzle_volume_type_values = _expand_nozzle_volume_values(_split_csv_tokens(effective_nozzle_volume_type_value))

    if detected_extruder_count > 0:
        _set_runtime_value("extruder_count", _typed_extruder_count_for_process(detected_extruder_count))

    if effective_nozzle_volume_type_values:
        nozzle_volume_keys = [
            key
            for key in ("nozzle_volume_type", "default_nozzle_volume_type")
            if _process_has_key(key)
        ]
        if not nozzle_volume_keys:
            nozzle_volume_keys = ["nozzle_volume_type"]
        for nozzle_volume_key in nozzle_volume_keys:
            _set_runtime_value(
                nozzle_volume_key,
                _typed_nozzle_volume_type_for_process(effective_nozzle_volume_type_values, preferred_key=nozzle_volume_key),
            )

    for runtime_key in ("different_extruder", "new_printer_name"):
        settings_container = _process_settings_container()
        has_runtime_key = runtime_key in patched_payload or (isinstance(settings_container, dict) and runtime_key in settings_container)
        if has_runtime_key:
            continue
        if runtime_key in template_settings:
            _set_runtime_value(runtime_key, template_settings.get(runtime_key))

    if effective_nozzle_diameter_values:
        nozzle_diameter_keys = [
            key
            for key in ("nozzle_diameter", "nozzle_diameters")
            if _process_has_key(key)
        ]
        if not nozzle_diameter_keys:
            nozzle_diameter_keys = ["nozzle_diameter"]
        for key in nozzle_diameter_keys:
            _set_runtime_value(key, _typed_nozzle_diameter_for_process(effective_nozzle_diameter_values, preferred_key=key))

    distinct_diameters = {v for v in user_nozzle_diameter_values if str(v or "").strip()}
    distinct_flows = {v for v in user_nozzle_flow_values if str(v or "").strip()}
    should_force_different_extruder = len(distinct_diameters) > 1 or len(distinct_flows) > 1
    if should_force_different_extruder:
        if "different_extruder" in patched_payload:
            desired = _profile_bool_setting_value(patched_payload.get("different_extruder"), True)
            _set_runtime_value("different_extruder", desired)
        elif "different_extruder" in template_settings:
            desired = _profile_bool_setting_value(template_settings.get("different_extruder"), True)
            _set_runtime_value("different_extruder", desired)

    changed = False
    if runtime_compat_changed:
        changed = True

    if normalized_mode in {"on", "off"}:
        enabled = normalized_mode == "on"
        enable_keys = (
            "enable_support",
            "support_enable",
            "enable_support_material",
            "support_material",
            "support",
        )
        had_enable_key = False
        for key in enable_keys:
            if key not in patched_payload:
                continue
            had_enable_key = True
            current = patched_payload.get(key)
            next_value = _profile_bool_setting_value(current, enabled)
            if current != next_value:
                patched_payload[key] = next_value
                changed = True
        if not had_enable_key:
            patched_payload["enable_support"] = "1" if enabled else "0"
            changed = True

    if normalized_mode != "off" and normalized_type:
        type_keys = ("support_type", "support_structure")
        found_type = False
        for key in type_keys:
            if key not in patched_payload:
                continue
            found_type = True
            if str(patched_payload.get(key) or "") != normalized_type:
                patched_payload[key] = normalized_type
                changed = True
        if not found_type:
            patched_payload["support_type"] = normalized_type
            changed = True

    if normalized_mode != "off" and normalized_style:
        style_keys = ("support_style",)
        found_style = False
        for key in style_keys:
            if key not in patched_payload:
                continue
            found_style = True
            if str(patched_payload.get(key) or "") != normalized_style:
                patched_payload[key] = normalized_style
                changed = True
        if not found_style:
            patched_payload["support_style"] = normalized_style
            changed = True

    if profile_process_overrides:
        manual_mapping_keys = {
            "filament_map_mode",
            "filament_map",
            "filament_nozzle_map",
            "filament_map_2",
            "filament_volume_map",
        }

        def _coerce_mapping_index_value(existing_value: Any, index_value: int) -> Any:
            token = str(max(0, int(index_value)))
            if isinstance(existing_value, (list, tuple, set)):
                existing_items = list(existing_value)
                wanted = len(existing_items) if existing_items else 1
                return [token for _ in range(wanted)]
            if isinstance(existing_value, str):
                text = existing_value.strip()
                if text.startswith("[") and text.endswith("]"):
                    return [token]
            if existing_value is None:
                return [token]
            return token

        for key, incoming in profile_process_overrides.items():
            if key not in override_template_payload and key not in manual_mapping_keys:
                continue
            existing = (
                override_template_payload.get(key)
                if key in override_template_payload
                else patched_payload.get(key)
            )
            current_value = patched_payload.get(key)
            if key in {"print_extruder_id", "printer_extruder_id"}:
                parsed_extruder = 0
                try:
                    if isinstance(incoming, (int, float)) and not isinstance(incoming, bool):
                        parsed_extruder = int(round(float(incoming)))
                    else:
                        numbers = _extract_float_numbers(incoming, max_items=1)
                        if numbers:
                            parsed_extruder = int(round(float(numbers[0])))
                except Exception:
                    parsed_extruder = 0
                target_extruder = str(parsed_extruder if parsed_extruder > 0 else 1)
                next_value = _coerce_process_override_value_like(existing, target_extruder)
            elif key in {"filament_map", "filament_nozzle_map", "filament_map_2", "filament_volume_map"}:
                parsed_index = 0
                try:
                    if isinstance(incoming, (int, float)) and not isinstance(incoming, bool):
                        parsed_index = int(round(float(incoming)))
                    else:
                        numbers = _extract_float_numbers(incoming, max_items=1)
                        if numbers:
                            parsed_index = int(round(float(numbers[0])))
                except Exception:
                    parsed_index = 0
                next_value = _coerce_mapping_index_value(existing, parsed_index)
            elif key == "filament_map_mode":
                mode_text = str(incoming or "").strip().lower().replace("_", " ").replace("-", " ")
                if mode_text in {"manual", "manual map"}:
                    next_value = "Manual"
                elif mode_text in {"auto for flush", "autoforflush", "auto flush"}:
                    next_value = "Auto For Flush"
                elif mode_text == "auto":
                    next_value = "Auto"
                else:
                    next_value = str(incoming or "").strip()
            else:
                next_value = _coerce_process_override_value_like(existing, incoming)
            if current_value != next_value:
                patched_payload[key] = next_value
                changed = True

    if not changed and not machine_runtime_changed:
        return f"{machine_json};{process_json}", [], ""

    temp_override_files: list[Path] = []
    load_machine = machine_json
    load_process = process_json

    if machine_runtime_changed and isinstance(patched_machine_payload, dict):
        temp_machine = output_gcode.with_suffix(".slice_support_override.machine.json")
        try:
            temp_machine.parent.mkdir(parents=True, exist_ok=True)
            machine_bytes = _normalize_uploaded_profile_json_bytes(patched_machine_payload, "machine")
            temp_machine.write_bytes(machine_bytes)
            temp_override_files.append(temp_machine)
            load_machine = str(temp_machine)
        except Exception as exc:
            for temp_file in temp_override_files:
                try:
                    temp_file.unlink(missing_ok=True)
                except Exception:
                    pass
            return "", [], f"Kunne ikke skrive machine-override profil: {exc}"

    if changed:
        temp_process = output_gcode.with_suffix(".slice_support_override.process.json")
        try:
            temp_process.parent.mkdir(parents=True, exist_ok=True)
            normalized_bytes = _normalize_uploaded_profile_json_bytes(patched_payload, "process")
            temp_process.write_bytes(normalized_bytes)
            temp_override_files.append(temp_process)
            load_process = str(temp_process)
        except Exception as exc:
            for temp_file in temp_override_files:
                try:
                    temp_file.unlink(missing_ok=True)
                except Exception:
                    pass
            return "", [], f"Kunne ikke skrive profile-override profil: {exc}"

    return f"{load_machine};{load_process}", temp_override_files, ""


def _validate_selected_slice_profiles(
    executable: str,
    printer_profile: str,
    print_profile: str,
    filament_profile: str,
) -> str:
    machine_json, process_json, filament_json = _resolve_selected_profile_jsons(
        executable,
        printer_profile,
        print_profile,
        filament_profile,
        prefer_uploaded=False,
    )

    if printer_profile and not machine_json:
        return f'Printerprofil "{printer_profile}" blev ikke fundet.'

    if print_profile and not process_json:
        if printer_profile:
            return f'Printprofil "{print_profile}" findes ikke eller er ikke kompatibel med printer "{printer_profile}".'
        return f'Printprofil "{print_profile}" blev ikke fundet.'

    if filament_profile and not filament_json:
        if printer_profile and print_profile:
            return (
                f'Filamentprofil "{filament_profile}" findes ikke eller er ikke kompatibel med '
                f'printer "{printer_profile}" og printprofil "{print_profile}".'
            )
        if printer_profile:
            return f'Filamentprofil "{filament_profile}" findes ikke eller er ikke kompatibel med printer "{printer_profile}".'
        if print_profile:
            return f'Filamentprofil "{filament_profile}" findes ikke eller er ikke kompatibel med printprofil "{print_profile}".'
        return f'Filamentprofil "{filament_profile}" blev ikke fundet.'

    return ""


def _normalize_rotation_degrees(value: Any) -> float:
    try:
        parsed = float(value or 0.0)
    except Exception:
        parsed = 0.0

    if not math.isfinite(parsed):
        return 0.0

    normalized = ((parsed + 180.0) % 360.0) - 180.0
    return round(normalized, 3)


def _normalize_bed_size_mm(value: Any) -> float:
    try:
        parsed = float(value or 0.0)
    except Exception:
        parsed = 0.0

    if not math.isfinite(parsed):
        return 0.0

    parsed = abs(parsed)
    if parsed < 40.0 or parsed > 2000.0:
        return 0.0

    return round(parsed, 3)


def _normalize_lift_mm(value: Any) -> float:
    try:
        parsed = float(value or 0.0)
    except Exception:
        parsed = 0.0

    if not math.isfinite(parsed):
        return 0.0

    if parsed < 0.0:
        parsed = 0.0
    if parsed > 80.0:
        parsed = 80.0

    return round(parsed, 3)


def _normalize_slicer_printer_bed_map(raw: Any) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    if not isinstance(raw, dict):
        return out

    for name_raw, value in raw.items():
        name = str(name_raw or "").strip()[:200]
        if not name:
            continue

        width_mm = 0.0
        depth_mm = 0.0
        if isinstance(value, dict):
            width_mm = _normalize_bed_size_mm(value.get("width_mm"))
            depth_mm = _normalize_bed_size_mm(value.get("depth_mm"))
        else:
            nums = _extract_float_numbers(value, max_items=2)
            if len(nums) >= 2:
                width_mm = _normalize_bed_size_mm(nums[0])
                depth_mm = _normalize_bed_size_mm(nums[1])

        if width_mm > 0.0 and depth_mm > 0.0:
            entry: dict[str, Any] = {
                "width_mm": float(width_mm),
                "depth_mm": float(depth_mm),
            }
            if isinstance(value, dict):
                manufacturer = str(value.get("manufacturer") or "").strip()[:80]
                model_key = str(value.get("model_key") or "").strip().lower()[:120]
                if manufacturer:
                    entry["manufacturer"] = manufacturer
                if model_key:
                    entry["model_key"] = re.sub(r"[^a-z0-9._-]+", "-", model_key).strip("-")
            out[name] = entry

    return out


def _normalize_slicer_printer_bed_hidden(raw: Any) -> list[str]:
    if not isinstance(raw, (list, tuple, set)):
        return []

    seen: set[str] = set()
    out: list[str] = []
    for value in raw:
        name = str(value or "").strip()[:200]
        if not name or name in seen:
            continue
        seen.add(name)
        out.append(name)

    out.sort(key=lambda v: v.lower())
    return out


def _load_slicer_printer_bed_map() -> dict[str, dict[str, Any]]:
    raw = str(get_setting(SLICER_PRINTER_BED_MAP_SETTING_KEY, "") or "").strip()
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
    except Exception:
        return {}
    return _normalize_slicer_printer_bed_map(payload)


def _save_slicer_printer_bed_map(mapping: Any) -> dict[str, dict[str, Any]]:
    normalized = _normalize_slicer_printer_bed_map(mapping)
    set_setting(
        SLICER_PRINTER_BED_MAP_SETTING_KEY,
        json.dumps(normalized, ensure_ascii=False, sort_keys=True),
    )
    return normalized


def _load_slicer_printer_bed_hidden() -> list[str]:
    raw = str(get_setting(SLICER_PRINTER_BED_HIDDEN_SETTING_KEY, "") or "").strip()
    if not raw:
        return []
    try:
        payload = json.loads(raw)
    except Exception:
        return []
    return _normalize_slicer_printer_bed_hidden(payload)


def _save_slicer_printer_bed_hidden(hidden_names: Any) -> list[str]:
    normalized = _normalize_slicer_printer_bed_hidden(hidden_names)
    set_setting(
        SLICER_PRINTER_BED_HIDDEN_SETTING_KEY,
        json.dumps(normalized, ensure_ascii=False),
    )
    return normalized


def _estimate_mesh_contact_z(mesh: Any, min_z: float, max_z: float) -> float:
    """Estimate a stable Z contact plane and ignore sparse low outliers."""
    contact_min = float(min_z)
    contact_max = float(max_z)
    if not math.isfinite(contact_min) or not math.isfinite(contact_max):
        return contact_min

    span = contact_max - contact_min
    if span <= 1e-9:
        return contact_min

    vertices = getattr(mesh, "vertices", None)
    if vertices is None:
        return contact_min

    try:
        import numpy as np

        values = np.asarray(vertices, dtype=float)
        if values.ndim != 2 or values.shape[1] < 3 or values.shape[0] < 128:
            return contact_min

        z_values = np.asarray(values[:, 2], dtype=float)
        if z_values.size < 128:
            return contact_min

        finite_mask = np.isfinite(z_values)
        if finite_mask is None:
            return contact_min
        z_values = z_values[finite_mask]
        if z_values.size < 128:
            return contact_min

        percentile_01 = float(np.percentile(z_values, 1.0))
        if not math.isfinite(percentile_01):
            return contact_min

        outlier_gap = percentile_01 - contact_min
        outlier_threshold = max(0.35, span * 0.05)
        if outlier_gap > outlier_threshold:
            return percentile_01
    except Exception:
        return contact_min

    return contact_min


def _best_effort_mesh_cleanup(mesh: Any) -> None:
    if mesh is None:
        return
    for method_name in (
        "remove_infinite_values",
        "remove_unreferenced_vertices",
        "remove_degenerate_faces",
        "remove_duplicate_faces",
        "merge_vertices",
    ):
        try:
            method = getattr(mesh, method_name, None)
            if callable(method):
                method()
        except Exception:
            pass
    try:
        import trimesh

        trimesh.repair.fix_normals(mesh, multibody=True)
    except Exception:
        pass


def _slice_debug_mesh_snapshot(mesh_path: Path) -> dict[str, Any]:
    snapshot: dict[str, Any] = {
        "path": str(mesh_path),
        "exists": bool(mesh_path.exists() and mesh_path.is_file()),
    }
    if not snapshot["exists"]:
        return snapshot

    try:
        mesh = _load_mesh_for_thumbnail(mesh_path)
        _best_effort_mesh_cleanup(mesh)
    except Exception as exc:
        snapshot["error"] = str(exc)[:500]
        return snapshot

    try:
        bounds = getattr(mesh, "bounds", None)
        if bounds is not None and len(bounds) == 2:
            mins = [float(v) for v in bounds[0]]
            maxs = [float(v) for v in bounds[1]]
            if len(mins) == 3 and len(maxs) == 3:
                snapshot["bounds_min"] = [round(v, 5) for v in mins]
                snapshot["bounds_max"] = [round(v, 5) for v in maxs]
                extent_x = maxs[0] - mins[0]
                extent_y = maxs[1] - mins[1]
                extent_z = maxs[2] - mins[2]
                snapshot["extents_mm"] = [round(extent_x, 5), round(extent_y, 5), round(extent_z, 5)]
    except Exception:
        pass

    try:
        face_count = int(len(getattr(mesh, "faces", []) or []))
        snapshot["faces"] = face_count
    except Exception:
        pass

    try:
        vertex_count = int(len(getattr(mesh, "vertices", []) or []))
        snapshot["vertices"] = vertex_count
    except Exception:
        pass

    try:
        snapshot["is_watertight"] = bool(getattr(mesh, "is_watertight", False))
    except Exception:
        pass

    try:
        components = mesh.split(only_watertight=False)
        if isinstance(components, (list, tuple)):
            snapshot["components"] = int(len(components))
    except Exception:
        pass

    try:
        volume = float(getattr(mesh, "volume", 0.0))
        if math.isfinite(volume):
            snapshot["volume_mm3"] = round(volume, 5)
    except Exception:
        pass

    return snapshot


def _write_centered_stl_for_slicing(
    input_stl: Path,
    output_stl: Path,
    rotation_x_degrees: float = 0.0,
    rotation_y_degrees: float = 0.0,
    rotation_z_degrees: float = 0.0,
    placement_x_mm: float = 0.0,
    placement_y_mm: float = 0.0,
    placement_z_mm: float = 0.0,
    z_contact_mode: str = "min",
) -> bool:
    if str(input_stl.suffix or "").lower() != ".stl":
        return False

    try:
        mesh = _load_mesh_for_thumbnail(input_stl)
    except Exception:
        return False

    try:
        centered = mesh.copy()
        _best_effort_mesh_cleanup(centered)

        rotation_x = _normalize_rotation_degrees(rotation_x_degrees)
        rotation_y = _normalize_rotation_degrees(rotation_y_degrees)
        rotation_z = _normalize_rotation_degrees(rotation_z_degrees)

        for axis, angle_deg in (("x", rotation_x), ("y", rotation_y), ("z", rotation_z)):
            if abs(angle_deg) < 1e-6:
                continue

            angle = math.radians(angle_deg)
            cos_v = math.cos(angle)
            sin_v = math.sin(angle)

            if axis == "x":
                rotation_matrix = [
                    [1.0, 0.0, 0.0, 0.0],
                    [0.0, cos_v, -sin_v, 0.0],
                    [0.0, sin_v, cos_v, 0.0],
                    [0.0, 0.0, 0.0, 1.0],
                ]
            elif axis == "y":
                rotation_matrix = [
                    [cos_v, 0.0, sin_v, 0.0],
                    [0.0, 1.0, 0.0, 0.0],
                    [-sin_v, 0.0, cos_v, 0.0],
                    [0.0, 0.0, 0.0, 1.0],
                ]
            else:
                rotation_matrix = [
                    [cos_v, -sin_v, 0.0, 0.0],
                    [sin_v, cos_v, 0.0, 0.0],
                    [0.0, 0.0, 1.0, 0.0],
                    [0.0, 0.0, 0.0, 1.0],
                ]

            centered.apply_transform(rotation_matrix)

        bounds = centered.bounds
        if bounds is None or len(bounds) != 2:
            return False

        mins = [float(v) for v in bounds[0]]
        maxs = [float(v) for v in bounds[1]]
        if len(mins) != 3 or len(maxs) != 3:
            return False

        tx = -((mins[0] + maxs[0]) / 2.0)
        ty = -((mins[1] + maxs[1]) / 2.0)
        mode = str(z_contact_mode or "").strip().lower()
        if mode == "robust":
            contact_z = _estimate_mesh_contact_z(centered, mins[2], maxs[2])
        else:
            contact_z = float(mins[2])
        tz = -float(contact_z)

        offset_x = float(placement_x_mm or 0.0)
        offset_y = float(placement_y_mm or 0.0)
        offset_z = float(placement_z_mm or 0.0)
        if not math.isfinite(offset_x):
            offset_x = 0.0
        if not math.isfinite(offset_y):
            offset_y = 0.0
        if not math.isfinite(offset_z):
            offset_z = 0.0
        if offset_z < 0.0:
            offset_z = 0.0

        tx += offset_x
        ty += offset_y
        tz += offset_z

        if (
            abs(tx) < 1e-6
            and abs(ty) < 1e-6
            and abs(tz) < 1e-6
            and abs(rotation_x) < 1e-6
            and abs(rotation_y) < 1e-6
            and abs(rotation_z) < 1e-6
            and abs(offset_x) < 1e-6
            and abs(offset_y) < 1e-6
            and abs(offset_z) < 1e-6
        ):
            return False

        centered.apply_translation([tx, ty, tz])
        _best_effort_mesh_cleanup(centered)

        # Guard against tiny negative precision artifacts after transform.
        try:
            post_bounds = centered.bounds
            if post_bounds is not None and len(post_bounds) == 2:
                post_mins = [float(v) for v in post_bounds[0]]
                if len(post_mins) == 3 and math.isfinite(post_mins[2]) and post_mins[2] < 0.0:
                    centered.apply_translation([0.0, 0.0, -post_mins[2] + 0.02])
        except Exception:
            pass

        output_stl.parent.mkdir(parents=True, exist_ok=True)
        centered.export(str(output_stl))
        return output_stl.exists() and output_stl.is_file() and output_stl.stat().st_size > 0
    except Exception:
        try:
            output_stl.unlink(missing_ok=True)
        except Exception:
            pass
        return False


def _slice_stl_to_gcode(
    input_stl: Path,
    output_gcode: Path,
    printer_profile: str = "",
    print_profile: str = "",
    filament_profile: str = "",
    rotation_x_degrees: float = 0.0,
    rotation_y_degrees: float = 0.0,
    rotation_z_degrees: float = 0.0,
    lift_z_mm: float = 0.0,
    support_mode: str = "auto",
    support_type: str = "",
    support_style: str = "",
    nozzle_left_diameter: str = "",
    nozzle_right_diameter: str = "",
    nozzle_left_flow: str = "",
    nozzle_right_flow: str = "",
    bed_width_mm: float = 0.0,
    bed_depth_mm: float = 0.0,
    process_overrides: Optional[dict[str, Any]] = None,
    allow_support_override_fallback: bool = True,
    force_profile_runtime_compat: bool = False,
    auto_pick_blank_profiles: bool = True,
    debug_trace: Optional[list[dict[str, Any]]] = None,
    z_contact_mode: str = "min",
    preferred_extruder_id_hint: int = 0,
    # Internal guard to avoid recursive legacy-retry loops
    disable_legacy_retry: bool = False,
) -> None:
    if not input_stl.exists() or not input_stl.is_file():
        raise RuntimeError("STL filen findes ikke på disk")

    if debug_trace is not None:
        try:
            retry_events_count = sum(
                1
                for entry in debug_trace
                if isinstance(entry, dict) and str(entry.get("event") or "").strip() == "retry-start"
            )
            if retry_events_count >= BAMBUSTUDIO_MAX_RETRY_EVENTS:
                raise RuntimeError(
                    f"BambuStudio retry-graense ramt ({BAMBUSTUDIO_MAX_RETRY_EVENTS}). "
                    "Stopper for at undgaa fastkoert loop."
                )
        except RuntimeError:
            raise
        except Exception:
            pass

    executable = _resolve_bambustudio_executable()
    legacy_cmd = [executable]
    _trace: Callable[[str, Optional[dict[str, Any]]], None] = (
        lambda event, data=None: _record_slice_debug_event(debug_trace, event, data)
    )

    effective_config_path = _effective_bambustudio_config_path()
    if effective_config_path:
        config_path = Path(effective_config_path)
        if not config_path.exists() or not config_path.is_file():
            if BAMBUSTUDIO_CONFIG_PATH:
                raise RuntimeError(f"BAMBUSTUDIO_CONFIG_PATH findes ikke: {config_path}")
            raise RuntimeError(f"Slicer config-fil findes ikke: {config_path}")
        legacy_cmd.extend(["--load", str(config_path)])

    printer_profile_value = str(printer_profile or "").strip()
    print_profile_value = str(print_profile or "").strip()
    filament_profile_value = str(filament_profile or "").strip()
    # Always keep transformed meshes snapped to the plate (Z=0 contact).
    # Lifting in Z makes Bambu CLI reject some rotated models as "nothing to be sliced".
    normalized_lift_z = 0.0
    normalized_support_mode = _normalize_slice_support_mode(support_mode)
    normalized_support_type = _normalize_slice_support_type(support_type)
    normalized_support_style = _normalize_slice_support_style(support_style)
    normalized_nozzle_left_diameter = _normalize_slice_nozzle_diameter(nozzle_left_diameter)
    normalized_nozzle_right_diameter = _normalize_slice_nozzle_diameter(nozzle_right_diameter)
    normalized_nozzle_left_flow = _normalize_slice_nozzle_flow(nozzle_left_flow)
    normalized_nozzle_right_flow = _normalize_slice_nozzle_flow(nozzle_right_flow)
    if normalized_nozzle_right_diameter and not normalized_nozzle_left_diameter:
        normalized_nozzle_left_diameter = normalized_nozzle_right_diameter
    if normalized_nozzle_right_flow and not normalized_nozzle_left_flow:
        normalized_nozzle_left_flow = normalized_nozzle_right_flow
    normalized_process_overrides = _normalize_slice_process_overrides(process_overrides or {})
    resolved_preferred_extruder_id = 0
    try:
        resolved_preferred_extruder_id = int(preferred_extruder_id_hint)
    except Exception:
        resolved_preferred_extruder_id = 0
    for preferred_key in ("print_extruder_id", "printer_extruder_id"):
        if preferred_key not in normalized_process_overrides:
            continue
        try:
            numbers = _extract_float_numbers(normalized_process_overrides.get(preferred_key), max_items=1)
            if numbers:
                parsed_preferred = int(round(float(numbers[0])))
                if parsed_preferred > 0:
                    resolved_preferred_extruder_id = parsed_preferred
                    break
        except Exception:
            continue
    if normalized_support_mode == "off":
        normalized_support_type = ""
        normalized_support_style = ""

    _trace(
        "slice-input-normalized",
        {
            "input_stl": str(input_stl),
            "output_gcode": str(output_gcode),
            "executable": executable,
            "printer_profile": printer_profile_value,
            "print_profile": print_profile_value,
            "filament_profile": filament_profile_value,
            "rotation_x_degrees": rotation_x_degrees,
            "rotation_y_degrees": rotation_y_degrees,
            "rotation_z_degrees": rotation_z_degrees,
            "lift_z_mm": normalized_lift_z,
            "support_mode": normalized_support_mode,
            "support_type": normalized_support_type,
            "support_style": normalized_support_style,
            "nozzle_left_diameter": normalized_nozzle_left_diameter,
            "nozzle_right_diameter": normalized_nozzle_right_diameter,
            "nozzle_left_flow": normalized_nozzle_left_flow,
            "nozzle_right_flow": normalized_nozzle_right_flow,
            "bed_width_mm": bed_width_mm,
            "bed_depth_mm": bed_depth_mm,
            "normalized_bed_width_mm": _normalize_bed_size_mm(bed_width_mm),
            "normalized_bed_depth_mm": _normalize_bed_size_mm(bed_depth_mm),
            "process_overrides_count": len(normalized_process_overrides),
            "cli_override_args": cli_override_args,
            "allow_support_override_fallback": bool(allow_support_override_fallback),
            "force_profile_runtime_compat": bool(force_profile_runtime_compat),
            "auto_pick_blank_profiles": bool(auto_pick_blank_profiles),
            "z_contact_mode": str(z_contact_mode or "min"),
            "preferred_extruder_id_hint": int(resolved_preferred_extruder_id),
            "disable_legacy_retry": bool(disable_legacy_retry),
            "attempt_timeout_sec": int(BAMBUSTUDIO_ATTEMPT_TIMEOUT_SEC),
            "max_retry_events": int(BAMBUSTUDIO_MAX_RETRY_EVENTS),
        },
    )

    if debug_trace is not None:
        try:
            dbg_machine_json, dbg_process_json, dbg_filament_json = _resolve_selected_profile_jsons(
                executable,
                printer_profile_value,
                print_profile_value,
                filament_profile_value,
                prefer_uploaded=False,
                auto_pick_when_blank=auto_pick_blank_profiles,
            )
            _trace(
                "selected-profile-jsons",
                {
                    "machine_json": dbg_machine_json,
                    "process_json": dbg_process_json,
                    "filament_json": dbg_filament_json,
                },
            )
        except Exception as dbg_profile_exc:
            _trace(
                "selected-profile-jsons-error",
                {
                    "error": str(dbg_profile_exc),
                },
            )

    if printer_profile_value:
        legacy_cmd.extend(["--printer-profile", printer_profile_value])
    if print_profile_value:
        legacy_cmd.extend(["--print-profile", print_profile_value])
    if filament_profile_value:
        legacy_cmd.extend(["--filament-profile", filament_profile_value])

    support_load_settings_override = ""
    temp_profile_overrides: list[Path] = []
    support_override_requested = (
        normalized_support_mode != "auto"
        or bool(normalized_support_type)
        or bool(normalized_support_style)
        or bool(normalized_nozzle_left_diameter)
        or bool(normalized_nozzle_right_diameter)
        or bool(normalized_nozzle_left_flow)
        or bool(normalized_nozzle_right_flow)
        or bool(normalized_process_overrides)
        or bool(force_profile_runtime_compat)
    )
    legacy_allowed = not support_override_requested
    _trace(
        "support-override-check",
        {
            "support_override_requested": bool(support_override_requested),
            "legacy_allowed": bool(legacy_allowed),
        },
    )
    if support_override_requested:
        (
            support_load_settings_override,
            support_override_files,
            support_override_error,
        ) = _build_support_override_load_settings(
            executable,
            output_gcode,
            printer_profile_value,
            print_profile_value,
            filament_profile_value,
            normalized_support_mode,
            normalized_support_type,
            normalized_support_style,
            normalized_process_overrides,
            normalized_nozzle_left_diameter,
            normalized_nozzle_right_diameter,
            normalized_nozzle_left_flow,
            normalized_nozzle_right_flow,
            force_runtime_compat=force_profile_runtime_compat,
        )
        if support_override_files:
            temp_profile_overrides.extend(support_override_files)
            _trace(
                "support-override-payload-snapshot",
                {
                    "profiles": [
                        _slice_debug_profile_snapshot(Path(path))
                        for path in support_override_files
                    ],
                },
            )
        _trace(
            "support-override-built",
            {
                "support_load_settings_override": support_load_settings_override,
                "support_override_files": [str(path) for path in support_override_files],
                "support_override_error": support_override_error,
            },
        )
        if support_override_error:
            raise RuntimeError(f"Support-override fejl: {support_override_error}")

    normalized_bed_width = _normalize_bed_size_mm(bed_width_mm)
    normalized_bed_depth = _normalize_bed_size_mm(bed_depth_mm)
    if normalized_bed_width <= 0.0 or normalized_bed_depth <= 0.0:
        try:
            machine_json, _process_json, _filament_json = _resolve_selected_profile_jsons(
                executable,
                printer_profile_value,
                print_profile_value,
                filament_profile_value,
                prefer_uploaded=False,
            )
            if machine_json:
                payload = _read_profile_json_payload(Path(machine_json))
                detected_bed = _extract_printer_bed_size_mm(payload)
                if detected_bed:
                    if normalized_bed_width <= 0.0:
                        normalized_bed_width = _normalize_bed_size_mm(detected_bed[0])
                    if normalized_bed_depth <= 0.0:
                        normalized_bed_depth = _normalize_bed_size_mm(detected_bed[1])
        except Exception:
            pass

    _trace(
        "bed-size-effective",
        {
            "effective_bed_width_mm": normalized_bed_width,
            "effective_bed_depth_mm": normalized_bed_depth,
        },
    )

    requested_transform = (
        abs(float(rotation_x_degrees or 0.0)) >= 1e-6
        or abs(float(rotation_y_degrees or 0.0)) >= 1e-6
        or abs(float(rotation_z_degrees or 0.0)) >= 1e-6
        or normalized_lift_z > 1e-6
    )

    slice_input_candidates: list[tuple[str, Path]] = []
    temp_slice_inputs: list[Path] = []

    centered_input = output_gcode.with_suffix(".slice_input.centered.stl")
    try:
        if _write_centered_stl_for_slicing(
            input_stl,
            centered_input,
            rotation_x_degrees=rotation_x_degrees,
            rotation_y_degrees=rotation_y_degrees,
            rotation_z_degrees=rotation_z_degrees,
            placement_z_mm=normalized_lift_z,
            z_contact_mode=z_contact_mode,
        ):
            slice_input_candidates.append(("center-origin", centered_input))
            temp_slice_inputs.append(centered_input)
    except Exception:
        pass

    if normalized_bed_width > 0.0 and normalized_bed_depth > 0.0:
        corner_input = output_gcode.with_suffix(".slice_input.corner.stl")
        try:
            if _write_centered_stl_for_slicing(
                input_stl,
                corner_input,
                rotation_x_degrees=rotation_x_degrees,
                rotation_y_degrees=rotation_y_degrees,
                rotation_z_degrees=rotation_z_degrees,
                placement_x_mm=normalized_bed_width / 2.0,
                placement_y_mm=normalized_bed_depth / 2.0,
                placement_z_mm=normalized_lift_z,
                z_contact_mode=z_contact_mode,
            ):
                slice_input_candidates.append(("corner-origin", corner_input))
                temp_slice_inputs.append(corner_input)
        except Exception:
            pass

    transformed_candidates = [label for label, _path in slice_input_candidates if label in {"center-origin", "corner-origin"}]
    if requested_transform:
        if not transformed_candidates:
            raise RuntimeError(
                "Kunne ikke forberede roteret/loeftet STL til slicing. "
                "Proev med lavere rotation/loeft eller upload en STL med korrekt orientering."
            )
    else:
        slice_input_candidates.append(("original", input_stl))

    traced_candidates: list[dict[str, Any]] = []
    for label, path in slice_input_candidates:
        candidate_entry: dict[str, Any] = {
            "label": label,
            "path": str(path),
        }
        if debug_trace is not None:
            candidate_entry["mesh_snapshot"] = _slice_debug_mesh_snapshot(path)
        traced_candidates.append(candidate_entry)

    _trace(
        "slice-input-candidates",
        {
            "requested_transform": bool(requested_transform),
            "candidates": traced_candidates,
        },
    )

    try:
        modern_profile_args = _build_modern_profile_args(
            executable,
            printer_profile_value,
            print_profile_value,
            filament_profile_value,
            prefer_uploaded=False,
            load_settings_override=support_load_settings_override,
            auto_pick_when_blank=auto_pick_blank_profiles,
            process_overrides=normalized_process_overrides,
            preferred_extruder_id_hint=resolved_preferred_extruder_id,
        )
        modern_base = [executable, "--slice", "0", *modern_profile_args, *cli_override_args]

        fallback_profile_args = _build_modern_profile_args(
            executable,
            printer_profile_value,
            print_profile_value,
            filament_profile_value,
            prefer_uploaded=False,
            load_settings_override=support_load_settings_override,
            auto_pick_when_blank=auto_pick_blank_profiles,
            process_overrides=normalized_process_overrides,
            preferred_extruder_id_hint=resolved_preferred_extruder_id,
        )
        fallback_base = [executable, "--slice", "0", *fallback_profile_args, *cli_override_args]
        _trace(
            "profile-args-built",
            {
                "modern_profile_args": modern_profile_args,
                "fallback_profile_args": fallback_profile_args,
                "cli_override_args": cli_override_args,
                "fallback_enabled": bool(
                    BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK and fallback_profile_args != modern_profile_args
                ),
            },
        )

        temp_3mf = output_gcode.with_suffix(".gcode.3mf")
        enable_modern_underscore_variant = True

        def _build_attempts(slice_input_path: Path) -> list[tuple[str, list[str], str]]:
            attempts: list[tuple[str, list[str], str]] = []

            if legacy_allowed:
                attempts.extend(
                    [
                        (
                            "legacy-hyphen",
                            [*legacy_cmd, "--export-gcode", "--output", str(output_gcode), str(slice_input_path)],
                            "gcode",
                        ),
                        (
                            "legacy-underscore",
                            [*legacy_cmd, "--export_gcode", "--output", str(output_gcode), str(slice_input_path)],
                            "gcode",
                        ),
                    ]
                )

            attempts.extend(
                [
                    (
                        "modern-3mf-hyphen",
                        [*modern_base, "--export-3mf", str(temp_3mf), str(slice_input_path)],
                        "3mf",
                    ),
                    (
                        "modern-3mf-outputdir-hyphen",
                        [
                            *modern_base,
                            "--outputdir",
                            str(temp_3mf.parent),
                            "--export-3mf",
                            temp_3mf.name,
                            str(slice_input_path),
                        ],
                        "3mf",
                    ),
                ]
            )
            if enable_modern_underscore_variant:
                attempts.append(
                    (
                        "modern-3mf-underscore",
                        [*modern_base, "--export_3mf", str(temp_3mf), str(slice_input_path)],
                        "3mf",
                    )
                )

            if BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK and fallback_profile_args != modern_profile_args:
                attempts.extend(
                    [
                        (
                            "modern-fallback-3mf-hyphen",
                            [*fallback_base, "--export-3mf", str(temp_3mf), str(slice_input_path)],
                            "3mf",
                        ),
                        (
                            "modern-fallback-3mf-outputdir-hyphen",
                            [
                                *fallback_base,
                                "--outputdir",
                                str(temp_3mf.parent),
                                "--export-3mf",
                                temp_3mf.name,
                                str(slice_input_path),
                            ],
                            "3mf",
                        ),
                    ]
                )

            return attempts

        errors: list[str] = []
        has_shared_lib_error = False
        attempted_corner_origin = any(label == "corner-origin" for label, _path in slice_input_candidates)

        for candidate_label, candidate_input in slice_input_candidates:
            attempts = _build_attempts(candidate_input)
            _trace(
                "attempt-batch",
                {
                    "candidate_label": candidate_label,
                    "candidate_input": str(candidate_input),
                    "attempts": [
                        {
                            "label": attempt_label,
                            "mode": attempt_mode,
                            "cmd": attempt_cmd,
                        }
                        for attempt_label, attempt_cmd, attempt_mode in attempts
                    ],
                },
            )
            for label, cmd, mode in attempts:
                try:
                    output_gcode.unlink(missing_ok=True)
                    temp_3mf.unlink(missing_ok=True)
                except Exception:
                    pass

                _trace(
                    "attempt-start",
                    {
                        "candidate_label": candidate_label,
                        "attempt_label": label,
                        "mode": mode,
                        "cmd": cmd,
                    },
                )
                proc, details = _run_bambu_with_runtime_fallback(cmd, executable)
                details = details.strip()
                _trace(
                    "attempt-result",
                    {
                        "candidate_label": candidate_label,
                        "attempt_label": label,
                        "mode": mode,
                        "returncode": int(proc.returncode),
                        "details": details,
                    },
                )

                if proc.returncode != 0:
                    details_lower = details.lower()
                    legacy_profile_option_unsupported = (
                        label.startswith("legacy-")
                        and any(
                            token in details_lower
                            for token in (
                                "invalid option --printer-profile",
                                "invalid option --printer_profile",
                                "invalid option --print-profile",
                                "invalid option --print_profile",
                                "invalid option --filament-profile",
                                "invalid option --filament_profile",
                            )
                        )
                    )
                    if legacy_profile_option_unsupported:
                        _trace(
                            "legacy-profile-option-unsupported",
                            {
                                "candidate_label": candidate_label,
                                "attempt_label": label,
                                "details": details,
                            },
                        )
                        continue
                    modern_underscore_unsupported = (
                        label == "modern-3mf-underscore"
                        and "invalid option --export_3mf" in details_lower
                    )
                    if modern_underscore_unsupported:
                        enable_modern_underscore_variant = False
                        _trace(
                            "modern-underscore-option-unsupported",
                            {
                                "candidate_label": candidate_label,
                                "attempt_label": label,
                                "details": details,
                            },
                        )
                        continue
                    if "libsoup2 symbols detected" in details_lower and "libsoup3" in details_lower:
                        raise RuntimeError(
                            "BambuStudio libsoup-mismatch: libsoup2 og libsoup3 er loaded samtidigt i samme proces. "
                            "Genbyg image med seneste Dockerfile (matcher WebKit/JSC + libsoup automatisk)."
                        )
                    errors.append(f"{candidate_label}/{label} (rc={int(proc.returncode)}): {details[:350]}")
                    if "error while loading shared libraries" in details_lower:
                        has_shared_lib_error = True
                        break
                    continue

                if mode == "gcode":
                    if output_gcode.exists() and output_gcode.is_file() and output_gcode.stat().st_size > 0:
                        _trace(
                            "slice-success",
                            {
                                "source": f"{candidate_label}/{label}",
                                "mode": mode,
                                "output_gcode": str(output_gcode),
                                "output_bytes": int(output_gcode.stat().st_size),
                            },
                        )
                        return
                    errors.append(f"{candidate_label}/{label}: kommandoen kørte men lavede ingen G-code output")
                    continue

                if _extract_gcode_from_3mf_archive(temp_3mf, output_gcode):
                    try:
                        temp_3mf.unlink(missing_ok=True)
                    except Exception:
                        pass
                    _trace(
                        "slice-success",
                        {
                            "source": f"{candidate_label}/{label}",
                            "mode": mode,
                            "output_gcode": str(output_gcode),
                            "output_bytes": int(output_gcode.stat().st_size) if output_gcode.exists() else 0,
                            "source_3mf": str(temp_3mf),
                        },
                    )
                    return

                if temp_3mf.exists() and temp_3mf.is_file() and temp_3mf.stat().st_size > 0:
                    errors.append(f"{candidate_label}/{label}: 3MF blev lavet men indeholdt ingen G-code")
                else:
                    errors.append(f"{candidate_label}/{label}: kommandoen kørte men lavede ingen 3MF output")

            if has_shared_lib_error:
                break

        if errors:
            guidance = ""
            errors_lower = [err.lower() for err in errors]
            has_nozzle_setup_error = any(
                ("nozzle_volume_type not found" in err)
                or (
                    ("setup params error" in err)
                    and ("invalid option --export_3mf" not in err)
                )
                for err in errors_lower
            )
            has_filament_mapping_error = any(
                ("some filaments can not be mapped under auto mode for multi extruder printer" in err)
                or ("cannot be mapped to correct extruders for multi-extruder printer" in err)
                for err in errors_lower
            )
            has_process_compat_error = any(
                ("process not compatible with printer" in err)
                for err in errors_lower
            )
            has_sigsegv_error = any(
                ("rc=-11" in err)
                or ("segmentation fault" in err)
                or ("signal 11" in err)
                for err in errors_lower
            )
            profile_text_for_mapping = f"{printer_profile_value} {print_profile_value}".lower()
            is_multi_extruder_profile = any(token in profile_text_for_mapping for token in ("h2d", "dual", "idex"))

            # Some Bambu multi-extruder builds reject explicit nozzle overrides
            # with setup/nozzle errors; retry once without explicit nozzle values.
            should_retry_without_support_override = (
                allow_support_override_fallback
                and bool(support_load_settings_override)
                and (has_nozzle_setup_error or has_filament_mapping_error or has_sigsegv_error)
            )
            if should_retry_without_support_override:
                _trace(
                    "retry-start",
                    {
                        "strategy": "without-support-override",
                        "reason": "nozzle/setup params error with support override",
                    },
                )
                try:
                    _slice_stl_to_gcode(
                        input_stl,
                        output_gcode,
                        printer_profile=printer_profile_value,
                        print_profile=print_profile_value,
                        filament_profile=filament_profile_value,
                        rotation_x_degrees=rotation_x_degrees,
                        rotation_y_degrees=rotation_y_degrees,
                        rotation_z_degrees=rotation_z_degrees,
                        lift_z_mm=normalized_lift_z,
                        support_mode=normalized_support_mode,
                        support_type=normalized_support_type,
                        support_style=normalized_support_style,
                        nozzle_left_diameter="",
                        nozzle_right_diameter="",
                        nozzle_left_flow="",
                        nozzle_right_flow="",
                        bed_width_mm=normalized_bed_width,
                        bed_depth_mm=normalized_bed_depth,
                        # True "without-support-override" retry: clear process
                        # runtime overrides so no temporary override process JSON
                        # is materialized in this attempt.
                        process_overrides={},
                        allow_support_override_fallback=False,
                        force_profile_runtime_compat=force_profile_runtime_compat,
                        auto_pick_blank_profiles=auto_pick_blank_profiles,
                        debug_trace=debug_trace,
                        preferred_extruder_id_hint=resolved_preferred_extruder_id,
                        z_contact_mode=z_contact_mode,
                    )
                    _trace("retry-success", {"strategy": "without-support-override"})
                    return
                except Exception as retry_exc:
                    retry_text = str(retry_exc)
                    _trace(
                        "retry-failed",
                        {
                            "strategy": "without-support-override",
                            "error": retry_text,
                        },
                    )
                    errors.append(f"support-override-fallback: {retry_text[:350]}")

                    # Final compatibility fallback for H2D-style nozzle/profile mismatches:
                    # retry with auto process selection (empty print profile).
                    if print_profile_value and "nozzle_volume_type not found" in retry_text.lower():
                        _trace(
                            "retry-start",
                            {
                                "strategy": "auto-process-after-support-fallback",
                                "reason": "nozzle_volume_type not found after support fallback",
                            },
                        )
                        try:
                            _slice_stl_to_gcode(
                                input_stl,
                                output_gcode,
                                printer_profile=printer_profile_value,
                                print_profile="",
                                filament_profile=filament_profile_value,
                                rotation_x_degrees=rotation_x_degrees,
                                rotation_y_degrees=rotation_y_degrees,
                                rotation_z_degrees=rotation_z_degrees,
                                lift_z_mm=normalized_lift_z,
                                support_mode=normalized_support_mode,
                                support_type=normalized_support_type,
                                support_style=normalized_support_style,
                                nozzle_left_diameter="",
                                nozzle_right_diameter="",
                                nozzle_left_flow="",
                                nozzle_right_flow="",
                                bed_width_mm=normalized_bed_width,
                                bed_depth_mm=normalized_bed_depth,
                                process_overrides=normalized_process_overrides,
                                allow_support_override_fallback=False,
                                force_profile_runtime_compat=force_profile_runtime_compat,
                                auto_pick_blank_profiles=False,
                                debug_trace=debug_trace,
                                preferred_extruder_id_hint=resolved_preferred_extruder_id,
                                z_contact_mode=z_contact_mode,
                            )
                            _trace("retry-success", {"strategy": "auto-process-after-support-fallback"})
                            return
                        except Exception as retry2_exc:
                            _trace(
                                "retry-failed",
                                {
                                    "strategy": "auto-process-after-support-fallback",
                                    "error": str(retry2_exc),
                                },
                            )
                            errors.append(f"process-auto-fallback: {str(retry2_exc)[:350]}")

            # If explicit process+filament segfaults, retry with explicit process
            # but no runtime overrides/support/nozzle injections.
            should_retry_explicit_process_plain = (
                allow_support_override_fallback
                and has_sigsegv_error
                and bool(print_profile_value)
            )
            if should_retry_explicit_process_plain:
                _trace(
                    "retry-start",
                    {
                        "strategy": "explicit-process-plain",
                        "reason": "segfault with runtime override payload; retry plain process profile",
                    },
                )
                try:
                    _slice_stl_to_gcode(
                        input_stl,
                        output_gcode,
                        printer_profile=printer_profile_value,
                        print_profile=print_profile_value,
                        filament_profile=filament_profile_value,
                        rotation_x_degrees=rotation_x_degrees,
                        rotation_y_degrees=rotation_y_degrees,
                        rotation_z_degrees=rotation_z_degrees,
                        lift_z_mm=normalized_lift_z,
                        support_mode="auto",
                        support_type="",
                        support_style="",
                        nozzle_left_diameter="",
                        nozzle_right_diameter="",
                        nozzle_left_flow="",
                        nozzle_right_flow="",
                        bed_width_mm=normalized_bed_width,
                        bed_depth_mm=normalized_bed_depth,
                        process_overrides={},
                        allow_support_override_fallback=False,
                        force_profile_runtime_compat=False,
                        auto_pick_blank_profiles=auto_pick_blank_profiles,
                        debug_trace=debug_trace,
                        preferred_extruder_id_hint=resolved_preferred_extruder_id,
                        z_contact_mode=z_contact_mode,
                    )
                    _trace("retry-success", {"strategy": "explicit-process-plain"})
                    return
                except Exception as explicit_plain_exc:
                    explicit_plain_text = str(explicit_plain_exc)
                    _trace(
                        "retry-failed",
                        {
                            "strategy": "explicit-process-plain",
                            "error": explicit_plain_text,
                        },
                    )
                    errors.append(f"explicit-process-plain-fallback: {explicit_plain_text[:350]}")

            # Direct single-extruder retry for multi-extruder filament mapping errors.
            # Forces extruder_count=1 so _expand_load_filaments_for_extruders sends
            # only one filament, bypassing BambuStudio's auto-mapping which fails
            # for H2D-style dual extruders with identical filaments.
            should_retry_manual_filament_map = (
                allow_support_override_fallback
                and has_filament_mapping_error
                and bool(filament_profile_value)
                and bool(print_profile_value)
                and is_multi_extruder_profile
                and resolved_preferred_extruder_id > 0
            )
            if should_retry_manual_filament_map:
                preferred_index = max(1, int(resolved_preferred_extruder_id))
                manual_map_overrides = dict(normalized_process_overrides)
                manual_map_overrides["extruder_count"] = 2
                manual_map_overrides["print_extruder_id"] = preferred_index
                manual_map_overrides["printer_extruder_id"] = preferred_index
                # Force manual mapping path in Bambu CLI (avoids auto-map rejection).
                manual_map_overrides["filament_map_mode"] = "Manual"
                manual_map_overrides["filament_map"] = preferred_index
                manual_map_overrides["filament_nozzle_map"] = max(0, preferred_index - 1)
                manual_map_overrides["filament_volume_map"] = 0
                _trace(
                    "retry-start",
                    {
                        "strategy": "manual-filament-map",
                        "reason": "auto mode mapping failed for multi-extruder profile",
                        "preferred_extruder_id": preferred_index,
                    },
                )
                try:
                    _slice_stl_to_gcode(
                        input_stl,
                        output_gcode,
                        printer_profile=printer_profile_value,
                        print_profile=print_profile_value,
                        filament_profile=filament_profile_value,
                        rotation_x_degrees=rotation_x_degrees,
                        rotation_y_degrees=rotation_y_degrees,
                        rotation_z_degrees=rotation_z_degrees,
                        lift_z_mm=normalized_lift_z,
                        support_mode=normalized_support_mode,
                        support_type=normalized_support_type,
                        support_style=normalized_support_style,
                        nozzle_left_diameter=normalized_nozzle_left_diameter,
                        nozzle_right_diameter=normalized_nozzle_right_diameter,
                        nozzle_left_flow=normalized_nozzle_left_flow,
                        nozzle_right_flow=normalized_nozzle_right_flow,
                        bed_width_mm=normalized_bed_width,
                        bed_depth_mm=normalized_bed_depth,
                        process_overrides=manual_map_overrides,
                        allow_support_override_fallback=False,
                        force_profile_runtime_compat=True,
                        auto_pick_blank_profiles=auto_pick_blank_profiles,
                        debug_trace=debug_trace,
                        preferred_extruder_id_hint=preferred_index,
                        z_contact_mode=z_contact_mode,
                    )
                    _trace("retry-success", {"strategy": "manual-filament-map"})
                    return
                except Exception as manual_map_exc:
                    _trace(
                        "retry-failed",
                        {
                            "strategy": "manual-filament-map",
                            "error": str(manual_map_exc),
                        },
                    )
                    errors.append(f"manual-filament-map-fallback: {str(manual_map_exc)[:350]}")

            should_retry_single_extruder_direct = (
                allow_support_override_fallback
                and
                has_filament_mapping_error
                and bool(filament_profile_value)
                and bool(print_profile_value)
            )
            if should_retry_single_extruder_direct:
                forced_single_overrides = dict(normalized_process_overrides)
                forced_single_overrides["extruder_count"] = 1
                forced_single_overrides["print_extruder_id"] = 1
                forced_single_overrides["printer_extruder_id"] = 1
                _trace(
                    "retry-start",
                    {
                        "strategy": "single-extruder-direct",
                        "reason": "filament auto-mapping failed for multi-extruder – force single extruder",
                    },
                )
                try:
                    _slice_stl_to_gcode(
                        input_stl,
                        output_gcode,
                        printer_profile=printer_profile_value,
                        print_profile=print_profile_value,
                        filament_profile=filament_profile_value,
                        rotation_x_degrees=rotation_x_degrees,
                        rotation_y_degrees=rotation_y_degrees,
                        rotation_z_degrees=rotation_z_degrees,
                        lift_z_mm=normalized_lift_z,
                        support_mode=normalized_support_mode,
                        support_type=normalized_support_type,
                        support_style=normalized_support_style,
                        nozzle_left_diameter=normalized_nozzle_left_diameter,
                        nozzle_right_diameter="",
                        nozzle_left_flow=normalized_nozzle_left_flow,
                        nozzle_right_flow="",
                        bed_width_mm=normalized_bed_width,
                        bed_depth_mm=normalized_bed_depth,
                        process_overrides=forced_single_overrides,
                        allow_support_override_fallback=False,
                        force_profile_runtime_compat=True,
                        auto_pick_blank_profiles=auto_pick_blank_profiles,
                        debug_trace=debug_trace,
                        preferred_extruder_id_hint=resolved_preferred_extruder_id,
                        z_contact_mode=z_contact_mode,
                    )
                    _trace("retry-success", {"strategy": "single-extruder-direct"})
                    return
                except Exception as single_direct_exc:
                    _trace(
                        "retry-failed",
                        {
                            "strategy": "single-extruder-direct",
                            "error": str(single_direct_exc),
                        },
                    )
                    errors.append(f"single-extruder-direct-fallback: {str(single_direct_exc)[:350]}")

            # If no explicit support/nozzle override file was used, force one
            # compatibility retry for H2D/multi-extruder process payloads so
            # runtime keys (e.g. nozzle_volume_type) get materialized.
            should_retry_with_forced_compat_override = (
                allow_support_override_fallback
                and has_nozzle_setup_error
                and not bool(support_load_settings_override)
                and not bool(force_profile_runtime_compat)
                and bool(print_profile_value)
            )
            if should_retry_with_forced_compat_override:
                _trace(
                    "retry-start",
                    {
                        "strategy": "forced-runtime-compat-override",
                        "reason": "nozzle/setup params error without support override",
                    },
                )
                try:
                    _slice_stl_to_gcode(
                        input_stl,
                        output_gcode,
                        printer_profile=printer_profile_value,
                        print_profile=print_profile_value,
                        filament_profile=filament_profile_value,
                        rotation_x_degrees=rotation_x_degrees,
                        rotation_y_degrees=rotation_y_degrees,
                        rotation_z_degrees=rotation_z_degrees,
                        lift_z_mm=normalized_lift_z,
                        support_mode=normalized_support_mode,
                        support_type=normalized_support_type,
                        support_style=normalized_support_style,
                        nozzle_left_diameter=normalized_nozzle_left_diameter,
                        nozzle_right_diameter=normalized_nozzle_right_diameter,
                        nozzle_left_flow=normalized_nozzle_left_flow,
                        nozzle_right_flow=normalized_nozzle_right_flow,
                        bed_width_mm=normalized_bed_width,
                        bed_depth_mm=normalized_bed_depth,
                        process_overrides=normalized_process_overrides,
                        allow_support_override_fallback=False,
                        force_profile_runtime_compat=True,
                        auto_pick_blank_profiles=auto_pick_blank_profiles,
                        debug_trace=debug_trace,
                        preferred_extruder_id_hint=resolved_preferred_extruder_id,
                        z_contact_mode=z_contact_mode,
                    )
                    _trace("retry-success", {"strategy": "forced-runtime-compat-override"})
                    return
                except Exception as retry_force_compat_exc:
                    _trace(
                        "retry-failed",
                        {
                            "strategy": "forced-runtime-compat-override",
                            "error": str(retry_force_compat_exc),
                        },
                    )
                    errors.append(f"compat-runtime-override-fallback: {str(retry_force_compat_exc)[:350]}")

            # Compatibility fallback even when no explicit support/nozzle override
            # file was provided. Some H2D profile combos still fail with
            # nozzle_volume_type/setup-params errors unless process is auto-selected.
            should_retry_process_auto = (
                allow_support_override_fallback
                and (has_nozzle_setup_error or has_filament_mapping_error or has_sigsegv_error)
                and bool(print_profile_value)
            )
            if should_retry_process_auto:
                _trace(
                    "retry-start",
                    {
                        "strategy": "auto-process-direct",
                        "reason": "nozzle/setup params error with explicit process profile",
                    },
                )
                try:
                    _slice_stl_to_gcode(
                        input_stl,
                        output_gcode,
                        printer_profile=printer_profile_value,
                        print_profile="",
                        filament_profile=filament_profile_value,
                        rotation_x_degrees=rotation_x_degrees,
                        rotation_y_degrees=rotation_y_degrees,
                        rotation_z_degrees=rotation_z_degrees,
                        lift_z_mm=normalized_lift_z,
                        support_mode=normalized_support_mode,
                        support_type=normalized_support_type,
                        support_style=normalized_support_style,
                        nozzle_left_diameter="",
                        nozzle_right_diameter="",
                        nozzle_left_flow="",
                        nozzle_right_flow="",
                        bed_width_mm=normalized_bed_width,
                        bed_depth_mm=normalized_bed_depth,
                        process_overrides={},
                        allow_support_override_fallback=False,
                        auto_pick_blank_profiles=False,
                        debug_trace=debug_trace,
                        preferred_extruder_id_hint=resolved_preferred_extruder_id,
                        z_contact_mode=z_contact_mode,
                    )
                    _trace("retry-success", {"strategy": "auto-process-direct"})
                    return
                except Exception as retry_process_auto_exc:
                    retry_process_auto_text = str(retry_process_auto_exc)
                    retry_process_auto_text_lower = retry_process_auto_text.lower()
                    retry_auto_has_nozzle_setup_error = (
                        ("nozzle_volume_type not found" in retry_process_auto_text_lower)
                        or ("setup params error" in retry_process_auto_text_lower)
                    )
                    retry_auto_has_filament_mapping_error = (
                        ("some filaments can not be mapped under auto mode for multi extruder printer" in retry_process_auto_text_lower)
                        or ("cannot be mapped to correct extruders for multi-extruder printer" in retry_process_auto_text_lower)
                    )
                    retry_auto_has_process_compat_error = ("process not compatible with printer" in retry_process_auto_text_lower)
                    _trace(
                        "retry-failed",
                        {
                            "strategy": "auto-process-direct",
                            "error": retry_process_auto_text,
                        },
                    )
                    errors.append(f"process-auto-direct-fallback: {retry_process_auto_text[:350]}")

                    # Final rescue for persistent multi-extruder mapping/compat issues:
                    # force single-extruder operation by overriding extruder_count=1 and
                    # sending only a single filament. We also keep print_extruder_id when provided.
                    if filament_profile_value and (
                        has_filament_mapping_error
                        or has_process_compat_error
                        or retry_auto_has_filament_mapping_error
                        or retry_auto_has_process_compat_error
                    ):
                        forced_overrides = dict(normalized_process_overrides)
                        try:
                            # Preserve preferred print nozzle if present
                            if "print_extruder_id" not in forced_overrides and "printer_extruder_id" in forced_overrides:
                                forced_overrides["print_extruder_id"] = forced_overrides.get("printer_extruder_id")
                        except Exception:
                            pass
                        forced_overrides["extruder_count"] = 1
                        forced_overrides["print_extruder_id"] = 1
                        forced_overrides["printer_extruder_id"] = 1
                        _trace(
                            "retry-start",
                            {
                                "strategy": "single-extruder-compat",
                                "reason": "force extruder_count=1 to bypass auto-mapping",
                            },
                        )
                        try:
                            _slice_stl_to_gcode(
                                input_stl,
                                output_gcode,
                                printer_profile=printer_profile_value,
                                print_profile=print_profile_value,
                                filament_profile=filament_profile_value,
                                rotation_x_degrees=rotation_x_degrees,
                                rotation_y_degrees=rotation_y_degrees,
                                rotation_z_degrees=rotation_z_degrees,
                                lift_z_mm=normalized_lift_z,
                                support_mode=normalized_support_mode,
                                support_type=normalized_support_type,
                                support_style=normalized_support_style,
                                nozzle_left_diameter=normalized_nozzle_left_diameter,
                                nozzle_right_diameter="",
                                nozzle_left_flow=normalized_nozzle_left_flow,
                                nozzle_right_flow="",
                                bed_width_mm=normalized_bed_width,
                                bed_depth_mm=normalized_bed_depth,
                                process_overrides=forced_overrides,
                                allow_support_override_fallback=False,
                                force_profile_runtime_compat=True,
                                auto_pick_blank_profiles=auto_pick_blank_profiles,
                                debug_trace=debug_trace,
                                preferred_extruder_id_hint=resolved_preferred_extruder_id,
                                z_contact_mode=z_contact_mode,
                            )
                            _trace("retry-success", {"strategy": "single-extruder-compat"})
                            return
                        except Exception as single_exc:
                            _trace(
                                "retry-failed",
                                {
                                    "strategy": "single-extruder-compat",
                                    "error": str(single_exc),
                                },
                            )
                            errors.append(f"single-extruder-compat-fallback: {str(single_exc)[:350]}")
                    if filament_profile_value and (
                        has_nozzle_setup_error
                        or has_filament_mapping_error
                        or has_process_compat_error
                        or retry_auto_has_nozzle_setup_error
                        or retry_auto_has_filament_mapping_error
                        or retry_auto_has_process_compat_error
                    ):
                        _trace(
                            "retry-start",
                            {
                                "strategy": "auto-process-and-filament-direct",
                                "reason": "auto-process retry failed while filament was explicit",
                            },
                        )
                        try:
                            _slice_stl_to_gcode(
                                input_stl,
                                output_gcode,
                                printer_profile=printer_profile_value,
                                print_profile="",
                                filament_profile="",
                                rotation_x_degrees=rotation_x_degrees,
                                rotation_y_degrees=rotation_y_degrees,
                                rotation_z_degrees=rotation_z_degrees,
                                lift_z_mm=normalized_lift_z,
                                support_mode=normalized_support_mode,
                                support_type=normalized_support_type,
                                support_style=normalized_support_style,
                                nozzle_left_diameter="",
                                nozzle_right_diameter="",
                                nozzle_left_flow="",
                                nozzle_right_flow="",
                                bed_width_mm=normalized_bed_width,
                                bed_depth_mm=normalized_bed_depth,
                                process_overrides={},
                                allow_support_override_fallback=False,
                                auto_pick_blank_profiles=False,
                                debug_trace=debug_trace,
                                preferred_extruder_id_hint=resolved_preferred_extruder_id,
                                z_contact_mode=z_contact_mode,
                            )
                            _trace("retry-success", {"strategy": "auto-process-and-filament-direct"})
                            return
                        except Exception as retry_process_filament_auto_exc:
                            _trace(
                                "retry-failed",
                                {
                                    "strategy": "auto-process-and-filament-direct",
                                    "error": str(retry_process_filament_auto_exc),
                                },
                            )
                            errors.append(
                                f"process+filament-auto-fallback: {str(retry_process_filament_auto_exc)[:350]}"
                            )

            # Final compatibility attempt for models reported as "Nothing to be sliced"
            # or similar empty-plate messages. Some Bambu CLI builds succeed only via
            # legacy export-gcode path without modern 3MF `--load-settings` chaining.
            has_nothing_to_be_sliced_error = any(
                ("nothing to be sliced" in err)
                or ("print is empty" in err)
                or ("plate is empty" in err)
                for err in errors_lower
            )
            profile_text = f"{printer_profile_value} {print_profile_value}".lower()
            is_multi_extruder_profile = any(token in profile_text for token in ("h2d", "dual", "idex"))
            override_extruder_count = 0
            raw_override_extruder_count = normalized_process_overrides.get("extruder_count")
            if raw_override_extruder_count is not None:
                try:
                    numbers = _extract_float_numbers(raw_override_extruder_count, max_items=1)
                    if numbers:
                        parsed_count = int(round(float(numbers[0])))
                        if parsed_count > 0:
                            override_extruder_count = parsed_count
                except Exception:
                    override_extruder_count = 0

            preferred_extruder_id = 0
            for override_key in ("print_extruder_id", "printer_extruder_id"):
                if override_key not in normalized_process_overrides:
                    continue
                try:
                    numbers = _extract_float_numbers(normalized_process_overrides.get(override_key), max_items=1)
                    if numbers:
                        parsed_extruder = int(round(float(numbers[0])))
                        if parsed_extruder > 0:
                            preferred_extruder_id = parsed_extruder
                            break
                except Exception:
                    continue

            should_retry_single_extruder_empty_plate = (
                has_nothing_to_be_sliced_error
                and allow_support_override_fallback
                and bool(filament_profile_value)
                and (is_multi_extruder_profile or override_extruder_count > 1)
            )
            if should_retry_single_extruder_empty_plate:
                forced_single_overrides = dict(normalized_process_overrides)
                forced_single_overrides["extruder_count"] = 1
                # Keep a valid preferred nozzle id for single-extruder fallback.
                # Single-extruder fallback uses the primary extruder id.
                forced_single_overrides["print_extruder_id"] = 1
                _trace(
                    "retry-start",
                    {
                        "strategy": "single-extruder-empty-plate",
                        "reason": "multi-extruder profile reports empty plate",
                        "preferred_extruder_id": preferred_extruder_id,
                    },
                )
                try:
                    _slice_stl_to_gcode(
                        input_stl,
                        output_gcode,
                        printer_profile=printer_profile_value,
                        print_profile=print_profile_value,
                        filament_profile=filament_profile_value,
                        rotation_x_degrees=rotation_x_degrees,
                        rotation_y_degrees=rotation_y_degrees,
                        rotation_z_degrees=rotation_z_degrees,
                        lift_z_mm=normalized_lift_z,
                        support_mode=normalized_support_mode,
                        support_type=normalized_support_type,
                        support_style=normalized_support_style,
                        nozzle_left_diameter=normalized_nozzle_left_diameter,
                        nozzle_right_diameter="",
                        nozzle_left_flow=normalized_nozzle_left_flow,
                        nozzle_right_flow="",
                        bed_width_mm=normalized_bed_width,
                        bed_depth_mm=normalized_bed_depth,
                        process_overrides=forced_single_overrides,
                        allow_support_override_fallback=False,
                        force_profile_runtime_compat=True,
                        auto_pick_blank_profiles=auto_pick_blank_profiles,
                        debug_trace=debug_trace,
                        preferred_extruder_id_hint=resolved_preferred_extruder_id,
                        z_contact_mode=z_contact_mode,
                        disable_legacy_retry=True,
                    )
                    _trace("retry-success", {"strategy": "single-extruder-empty-plate"})
                    return
                except Exception as single_empty_exc:
                    _trace(
                        "retry-failed",
                        {
                            "strategy": "single-extruder-empty-plate",
                            "error": str(single_empty_exc),
                        },
                    )
                    errors.append(f"single-extruder-empty-plate-fallback: {str(single_empty_exc)[:350]}")

            if has_nothing_to_be_sliced_error and str(z_contact_mode or "min").strip().lower() != "robust":
                _trace(
                    "retry-start",
                    {
                        "strategy": "z-contact-mode-robust",
                        "reason": "strict Z snap reported empty plate",
                    },
                )
                try:
                    _slice_stl_to_gcode(
                        input_stl,
                        output_gcode,
                        printer_profile=printer_profile_value,
                        print_profile=print_profile_value,
                        filament_profile=filament_profile_value,
                        rotation_x_degrees=rotation_x_degrees,
                        rotation_y_degrees=rotation_y_degrees,
                        rotation_z_degrees=rotation_z_degrees,
                        lift_z_mm=normalized_lift_z,
                        support_mode=normalized_support_mode,
                        support_type=normalized_support_type,
                        support_style=normalized_support_style,
                        nozzle_left_diameter=normalized_nozzle_left_diameter,
                        nozzle_right_diameter=normalized_nozzle_right_diameter,
                        nozzle_left_flow=normalized_nozzle_left_flow,
                        nozzle_right_flow=normalized_nozzle_right_flow,
                        bed_width_mm=normalized_bed_width,
                        bed_depth_mm=normalized_bed_depth,
                        process_overrides=normalized_process_overrides,
                        allow_support_override_fallback=False,
                        force_profile_runtime_compat=force_profile_runtime_compat,
                        auto_pick_blank_profiles=auto_pick_blank_profiles,
                        debug_trace=debug_trace,
                        preferred_extruder_id_hint=resolved_preferred_extruder_id,
                        z_contact_mode="robust",
                        disable_legacy_retry=True,
                    )
                    _trace("retry-success", {"strategy": "z-contact-mode-robust"})
                    return
                except Exception as robust_contact_exc:
                    _trace(
                        "retry-failed",
                        {
                            "strategy": "z-contact-mode-robust",
                            "error": str(robust_contact_exc),
                        },
                    )
                    errors.append(f"z-contact-robust-fallback: {str(robust_contact_exc)[:350]}")
            if has_nothing_to_be_sliced_error and not disable_legacy_retry:
                _trace(
                    "retry-start",
                    {
                        "strategy": "legacy-export-gcode",
                        "reason": "modern 3MF path reports 'Nothing to be sliced'",
                    },
                )
                try:
                    _slice_stl_to_gcode(
                        input_stl,
                        output_gcode,
                        printer_profile=printer_profile_value,
                        print_profile=print_profile_value,
                        filament_profile=filament_profile_value,
                        rotation_x_degrees=rotation_x_degrees,
                        rotation_y_degrees=rotation_y_degrees,
                        rotation_z_degrees=rotation_z_degrees,
                        lift_z_mm=normalized_lift_z,
                        support_mode=normalized_support_mode,
                        support_type="",
                        support_style="",
                        nozzle_left_diameter="",
                        nozzle_right_diameter="",
                        nozzle_left_flow="",
                        nozzle_right_flow="",
                        bed_width_mm=normalized_bed_width,
                        bed_depth_mm=normalized_bed_depth,
                        process_overrides={},
                        allow_support_override_fallback=False,
                        force_profile_runtime_compat=False,
                        auto_pick_blank_profiles=auto_pick_blank_profiles,
                        debug_trace=debug_trace,
                        preferred_extruder_id_hint=resolved_preferred_extruder_id,
                        z_contact_mode=z_contact_mode,
                        disable_legacy_retry=True,
                    )
                    _trace("retry-success", {"strategy": "legacy-export-gcode"})
                    return
                except Exception as legacy_exc:
                    _trace(
                        "retry-failed",
                        {
                            "strategy": "legacy-export-gcode",
                            "error": str(legacy_exc),
                        },
                    )
                    errors.append(f"legacy-export-gcode-fallback: {str(legacy_exc)[:350]}")

            if any("unable to create plate triangles" in err for err in errors_lower):
                guidance = (
                    " | Mangler muligvis machine/process/filament settings til modern CLI. "
                    "Sæt BAMBUSTUDIO_LOAD_SETTINGS og BAMBUSTUDIO_LOAD_FILAMENTS i .env."
                )
            if any(("nothing to be sliced" in err) or ("no object is fully in" in err) for err in errors_lower):
                guidance += " | STL blev auto-centreret, men objektet er stadig udenfor pladen eller inkompatibelt med valgt profil."
                if attempted_corner_origin:
                    guidance += " Forsøgte både center-origin og corner-origin placering."
            _trace(
                "slice-failed",
                {
                    "errors": errors,
                    "guidance": guidance,
                },
            )
            raise RuntimeError(f"BambuStudio fejl: {(' | '.join(errors) + guidance)[:1000]}")

        if not output_gcode.exists() or not output_gcode.is_file() or output_gcode.stat().st_size <= 0:
            raise RuntimeError("BambuStudio lavede ingen output-fil")
    finally:
        for temp_input in temp_slice_inputs:
            try:
                if temp_input != input_stl:
                    temp_input.unlink(missing_ok=True)
            except Exception:
                pass
        for override_file in temp_profile_overrides:
            try:
                override_file.unlink(missing_ok=True)
            except Exception:
                pass


def _archive_completed_slice_output(output_gcode: Path) -> Optional[Path]:
    try:
        if not output_gcode.exists() or not output_gcode.is_file():
            return None
    except Exception:
        return None

    try:
        BAMBU_SLICED_DIR.mkdir(parents=True, exist_ok=True)
        archive_target = allocate_unique_target(BAMBU_SLICED_DIR, output_gcode.name)
        shutil.copy2(str(output_gcode), str(archive_target))
        return archive_target
    except Exception:
        return None


def _slice_debug_json_safe(value: Any, depth: int = 0) -> Any:
    if depth > 8:
        return "<max-depth>"

    if value is None or isinstance(value, (bool, int, float)):
        return value

    if isinstance(value, Path):
        return str(value)

    if isinstance(value, str):
        if len(value) <= 4000:
            return value
        return f"{value[:4000]}...<truncated {len(value) - 4000} chars>"

    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for idx, (key, item) in enumerate(value.items()):
            if idx >= 200:
                out["__truncated_items__"] = max(0, len(value) - idx)
                break
            out[str(key)[:200]] = _slice_debug_json_safe(item, depth + 1)
        return out

    if isinstance(value, (list, tuple, set)):
        seq = list(value)
        out_list: list[Any] = []
        for idx, item in enumerate(seq):
            if idx >= 250:
                out_list.append(f"... <truncated {len(seq) - idx} items>")
                break
            out_list.append(_slice_debug_json_safe(item, depth + 1))
        return out_list

    return str(value)[:2000]


def _slice_debug_collect_values_for_key(
    node: Any,
    key: str,
    out: list[Any],
    depth: int = 0,
    max_items: int = 10,
) -> None:
    if len(out) >= max_items or depth > 10:
        return
    if isinstance(node, dict):
        for current_key, current_value in node.items():
            if str(current_key or "").strip() == key and len(out) < max_items:
                out.append(_slice_debug_json_safe(current_value, depth=0))
            if len(out) >= max_items:
                return
            if isinstance(current_value, (dict, list, tuple)):
                _slice_debug_collect_values_for_key(current_value, key, out, depth + 1, max_items)
                if len(out) >= max_items:
                    return
        return
    if isinstance(node, (list, tuple)):
        for item in node:
            if len(out) >= max_items:
                return
            if isinstance(item, (dict, list, tuple)):
                _slice_debug_collect_values_for_key(item, key, out, depth + 1, max_items)


def _slice_debug_profile_snapshot(profile_path: Path) -> dict[str, Any]:
    snapshot: dict[str, Any] = {
        "path": str(profile_path),
        "exists": bool(profile_path.exists() and profile_path.is_file()),
    }
    if not snapshot["exists"]:
        return snapshot

    payload = _read_profile_json_payload(profile_path)
    if not isinstance(payload, dict):
        snapshot["parse_error"] = "invalid-json-object"
        return snapshot

    snapshot["top_level_key_count"] = len(payload)
    snapshot["top_level_keys"] = sorted([str(key) for key in payload.keys()])[:120]

    meta_keys = (
        "type",
        "name",
        "from",
        "setting_id",
        "printer_settings_id",
        "print_settings_id",
        "process_settings_id",
        "filament_settings_id",
        "inherits",
        "compatible_printers",
        "compatible_processes",
        "compatible_filaments",
    )
    meta: dict[str, Any] = {}
    for key in meta_keys:
        if key in payload:
            meta[key] = _slice_debug_json_safe(payload.get(key), depth=0)
    if meta:
        snapshot["meta"] = meta

    interesting_keys = (
        "extruder_count",
        "print_extruder_id",
        "printer_extruder_id",
        "filament_map_mode",
        "filament_map",
        "filament_nozzle_map",
        "filament_map_2",
        "filament_volume_map",
        "extruder_ams_count",
        "different_extruder",
        "new_printer_name",
        "nozzle_volume_type",
        "nozzle_diameter",
        "nozzle_diameters",
        "nozzle_size",
        "nozzle_sizes",
        "nozzle_flow_type",
        "nozzle_flow_types",
        "filament_type",
        "filament_types",
    )
    interesting: dict[str, Any] = {}
    for key in interesting_keys:
        values: list[Any] = []
        _slice_debug_collect_values_for_key(payload, key, values, depth=0, max_items=8)
        if values:
            interesting[key] = values

    effective_settings, _effective_options = _extract_effective_process_settings_from_payload(payload)
    interesting_effective: dict[str, Any] = {}
    if effective_settings:
        for key in interesting_keys:
            if key in effective_settings:
                interesting_effective[key] = _slice_debug_json_safe(effective_settings.get(key), depth=0)
        if "default_nozzle_volume_type" in effective_settings:
            interesting_effective["default_nozzle_volume_type"] = _slice_debug_json_safe(
                effective_settings.get("default_nozzle_volume_type"),
                depth=0,
            )

    if interesting:
        snapshot["interesting"] = interesting
    if interesting_effective:
        snapshot["interesting_effective"] = interesting_effective

    return snapshot


def _record_slice_debug_event(
    trace: Optional[list[dict[str, Any]]],
    event: str,
    data: Optional[dict[str, Any]] = None,
) -> None:
    if trace is None:
        return
    try:
        safe_event = str(event or "").strip()[:120] or "event"
        entry: dict[str, Any] = {"ts": now_iso(), "event": safe_event}
        if data:
            entry["data"] = _slice_debug_json_safe(data)
        trace.append(entry)
        if len(trace) > BAMBUSTUDIO_SLICE_DEBUG_MAX_EVENTS:
            del trace[: len(trace) - BAMBUSTUDIO_SLICE_DEBUG_MAX_EVENTS]
    except Exception:
        pass


def _write_slice_debug_record(
    file_id: int,
    payload: dict[str, Any],
    preferred_dir: Optional[Path] = None,
) -> Optional[Path]:
    try:
        target_dir: Optional[Path] = None
        if isinstance(preferred_dir, Path):
            try:
                preferred_dir.mkdir(parents=True, exist_ok=True)
                if preferred_dir.exists() and preferred_dir.is_dir():
                    target_dir = preferred_dir
            except Exception:
                target_dir = None
        if target_dir is None:
            BAMBU_SLICE_DEBUG_DIR.mkdir(parents=True, exist_ok=True)
            target_dir = BAMBU_SLICE_DEBUG_DIR

        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        target = target_dir / f"slice-debug-{stamp}-file-{max(0, int(file_id))}.json"
        safe_payload = _slice_debug_json_safe(payload)
        target.write_text(json.dumps(safe_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return target
    except Exception:
        try:
            if (
                not isinstance(preferred_dir, Path)
                or BAMBU_SLICE_DEBUG_DIR.resolve() == preferred_dir.resolve()
            ):
                return None
            BAMBU_SLICE_DEBUG_DIR.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            target = BAMBU_SLICE_DEBUG_DIR / f"slice-debug-{stamp}-file-{max(0, int(file_id))}.json"
            safe_payload = _slice_debug_json_safe(payload)
            target.write_text(json.dumps(safe_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            return target
        except Exception:
            return None


# ---- Slice cancel + status helpers and endpoints ----
try:
    from threading import Lock
    from typing import Set, Dict
except Exception:  # pragma: no cover
    Lock = None  # type: ignore
    Set = set  # type: ignore
    Dict = dict  # type: ignore

# Best-effort in-memory state (resets on restart)
SLICE_CANCELLED: Set[int] = set()
SLICER_STATS: Dict[str, int] = {"total": 0, "completed": 0, "processing": 0, "errors": 0}
SLICER_PROCESSING_IDS: Set[int] = set()
SLICER_LOCK = Lock() if Lock else None  # type: ignore


def _slice_stats_mark_started(file_id: int) -> None:
    if not SLICER_LOCK:
        return
    with SLICER_LOCK:  # type: ignore
        SLICER_STATS["total"] += 1
        SLICER_STATS["processing"] += 1
        SLICER_PROCESSING_IDS.add(int(file_id))


def _slice_stats_mark_success(file_id: int) -> None:
    if not SLICER_LOCK:
        return
    with SLICER_LOCK:  # type: ignore
        SLICER_STATS["processing"] = max(0, SLICER_STATS.get("processing", 0) - 1)
        SLICER_STATS["completed"] = SLICER_STATS.get("completed", 0) + 1
        SLICER_PROCESSING_IDS.discard(int(file_id))


def _slice_stats_mark_error(file_id: int) -> None:
    if not SLICER_LOCK:
        return
    with SLICER_LOCK:  # type: ignore
        SLICER_STATS["processing"] = max(0, SLICER_STATS.get("processing", 0) - 1)
        SLICER_STATS["errors"] = SLICER_STATS.get("errors", 0) + 1
        SLICER_PROCESSING_IDS.discard(int(file_id))


def _slice_is_cancelled(file_id: int) -> bool:
    if not SLICER_LOCK:
        return False
    with SLICER_LOCK:  # type: ignore
        return int(file_id) in SLICE_CANCELLED


def _slice_cancel_mark(file_id: int) -> None:
    if not SLICER_LOCK:
        return
    with SLICER_LOCK:  # type: ignore
        SLICE_CANCELLED.add(int(file_id))


def _slice_cancel_clear(file_id: int) -> None:
    if not SLICER_LOCK:
        return
    with SLICER_LOCK:  # type: ignore
        SLICE_CANCELLED.discard(int(file_id))


def _process_slice_job_payload(payload: Dict[str, Any]) -> None:
    # Hook: mark slice started for status bar
    try:
        f_id = int(payload.get("file_id") or 0)
    except Exception:
        f_id = 0
    if f_id:
        _slice_cancel_clear(f_id)
        _slice_stats_mark_started(f_id)
        if _slice_is_cancelled(f_id):
            _slice_stats_mark_error(f_id)
            raise RuntimeError("Slice canceled by user")
    file_id = int(payload.get("file_id") or 0)
    requested_by = str(payload.get("requested_by") or "").strip()
    printer_profile = str(payload.get("printer_profile") or "").strip()
    print_profile = str(payload.get("print_profile") or "").strip()
    filament_profile = str(payload.get("filament_profile") or "").strip()
    support_mode = _normalize_slice_support_mode(payload.get("support_mode"))
    support_type = _normalize_slice_support_type(payload.get("support_type"))
    support_style = _normalize_slice_support_style(payload.get("support_style"))
    nozzle_left_diameter = _normalize_slice_nozzle_diameter(payload.get("nozzle_left_diameter"))
    nozzle_right_diameter = _normalize_slice_nozzle_diameter(payload.get("nozzle_right_diameter"))
    nozzle_left_flow = _normalize_slice_nozzle_flow(payload.get("nozzle_left_flow"))
    nozzle_right_flow = _normalize_slice_nozzle_flow(payload.get("nozzle_right_flow"))
    if support_mode == "off":
        support_type = ""
        support_style = ""
    rotation_x_degrees = _normalize_rotation_degrees(payload.get("rotation_x_degrees"))
    rotation_y_degrees = _normalize_rotation_degrees(payload.get("rotation_y_degrees"))
    rotation_z_degrees = _normalize_rotation_degrees(payload.get("rotation_z_degrees"))
    # Ignore queued/API lift and always snap to plate during slicing.
    lift_z_mm = 0.0
    bed_width_mm = _normalize_bed_size_mm(payload.get("bed_width_mm"))
    bed_depth_mm = _normalize_bed_size_mm(payload.get("bed_depth_mm"))
    process_overrides = _normalize_slice_process_overrides(payload.get("process_overrides"))
    slice_debug_trace: list[dict[str, Any]] = []
    slice_error_text = ""
    folder_path = ""
    target_name = ""
    _record_slice_debug_event(
        slice_debug_trace,
        "worker-payload",
        {
            "file_id": file_id,
            "requested_by": requested_by,
            "printer_profile": printer_profile,
            "print_profile": print_profile,
            "filament_profile": filament_profile,
            "support_mode": support_mode,
            "support_type": support_type,
            "support_style": support_style,
            "nozzle_left_diameter": nozzle_left_diameter,
            "nozzle_right_diameter": nozzle_right_diameter,
            "nozzle_left_flow": nozzle_left_flow,
            "nozzle_right_flow": nozzle_right_flow,
            "rotation_x_degrees": rotation_x_degrees,
            "rotation_y_degrees": rotation_y_degrees,
            "rotation_z_degrees": rotation_z_degrees,
            "lift_z_mm": lift_z_mm,
            "bed_width_mm": bed_width_mm,
            "bed_depth_mm": bed_depth_mm,
            "process_overrides": process_overrides,
        },
    )
    if file_id <= 0:
        return

    with closing(get_conn()) as conn:
        row = conn.execute("SELECT * FROM files WHERE id=?", (file_id,)).fetchone()

    if row is None:
        _record_slice_debug_event(slice_debug_trace, "worker-file-missing", {"file_id": file_id})
        return

    folder_path = normalize_folder_path(str(row["folder_path"] or ""))
    target_name = str(row["filename"] or "")
    _record_slice_debug_event(
        slice_debug_trace,
        "worker-file-row",
        {
            "folder_path": folder_path,
            "filename": target_name,
            "ext": str(row["ext"] or "").lower(),
        },
    )

    ext = str(row["ext"] or "").lower()
    if not _supports_slicing_for_ext(ext):
        _record_slice_debug_event(
            slice_debug_trace,
            "worker-invalid-ext",
            {
                "ext": ext,
            },
        )
        _set_file_slice_state(file_id, "error", "Slicing understøtter kun STL", actor=requested_by or "system")
        return

    _set_file_slice_state(file_id, "processing", "", actor=requested_by or "system")

    output_path: Optional[Path] = None
    source_path_for_debug: Optional[Path] = None
    try:
        source_path = file_disk_path(row)
        source_path_for_debug = source_path
        _, folder_abs = folder_abs_path(folder_path)
        base_name = Path(str(row["filename"] or "model.stl")).stem
        gcode_name = sanitize_filename(f"{base_name}.gcode")
        output_path = allocate_unique_target(folder_abs, gcode_name)
        _record_slice_debug_event(
            slice_debug_trace,
            "worker-slice-start",
            {
                "source_path": str(source_path),
                "output_path": str(output_path),
            },
        )

        _slice_stl_to_gcode(
            source_path,
            output_path,
            printer_profile=printer_profile,
            print_profile=print_profile,
            filament_profile=filament_profile,
            rotation_x_degrees=rotation_x_degrees,
            rotation_y_degrees=rotation_y_degrees,
            rotation_z_degrees=rotation_z_degrees,
            lift_z_mm=lift_z_mm,
            support_mode=support_mode,
            support_type=support_type,
            support_style=support_style,
            nozzle_left_diameter=nozzle_left_diameter,
            nozzle_right_diameter=nozzle_right_diameter,
            nozzle_left_flow=nozzle_left_flow,
            nozzle_right_flow=nozzle_right_flow,
            bed_width_mm=bed_width_mm,
            bed_depth_mm=bed_depth_mm,
            process_overrides=process_overrides,
            debug_trace=slice_debug_trace,
        )
        _record_slice_debug_event(
            slice_debug_trace,
            "worker-slice-complete",
            {
                "output_path": str(output_path),
                "output_bytes": int(output_path.stat().st_size) if output_path.exists() else 0,
            },
        )

        creator = requested_by or str(row["uploaded_by"] or "slicer")
        upsert_file_record(
            folder_path=folder_path,
            filename=output_path.name,
            disk_path=output_path,
            uploaded_by=creator,
            upload_client_id=None,
        )

        archived_path = _archive_completed_slice_output(output_path)
        if archived_path is not None:
            try:
                log_activity(
                    kind="slice",
                    action="archived",
                    message=f"Sliced fil kopieret til bambu/sliced ({int(archived_path.stat().st_size)} bytes)",
                    level="info",
                    folder_path="bambu/sliced",
                    target=str(archived_path.name),
                    actor=requested_by or "system",
                    file_id=file_id,
                )
            except Exception:
                pass

        _set_file_slice_state(file_id, "ready", "", actor=requested_by or "system")
        _slice_stats_mark_success(file_id)
    except Exception as exc:
        slice_error_text = str(exc)
        _record_slice_debug_event(
            slice_debug_trace,
            "worker-slice-error",
            {
                "error": slice_error_text,
            },
        )
        try:
            if output_path and output_path.exists() and output_path.is_file():
                output_path.unlink(missing_ok=True)
        except Exception:
            pass
        _set_file_slice_state(file_id, "error", slice_error_text, actor=requested_by or "system")
        _slice_stats_mark_error(file_id)
    finally:
        should_write_debug = bool(slice_error_text) or BAMBUSTUDIO_SLICE_DEBUG_ALWAYS
        if should_write_debug:
            debug_payload = {
                "file_id": file_id,
                "requested_by": requested_by,
                "status": "error" if slice_error_text else "ready",
                "error": slice_error_text,
                "folder_path": folder_path,
                "target": target_name,
                "trace": slice_debug_trace,
            }
            debug_target_dir = source_path_for_debug.parent if isinstance(source_path_for_debug, Path) else None
            debug_path = _write_slice_debug_record(file_id, debug_payload, preferred_dir=debug_target_dir)
            if debug_path is not None:
                rel_path = str(debug_path)
                try:
                    rel_path = str(debug_path.relative_to(DATA_DIR)).replace("\\", "/")
                except Exception:
                    pass
                log_activity(
                    kind="slice",
                    action="debug",
                    message=f"Slice debug gemt ({rel_path})",
                    level="warn" if slice_error_text else "info",
                    folder_path=folder_path,
                    target=target_name,
                    actor=requested_by or "system",
                    file_id=file_id,
                )


def _slice_worker_loop() -> None:
    while True:
        payload = SLICE_QUEUE.get()
        file_id_for_cleanup = 0
        try:
            if isinstance(payload, dict):
                file_id_for_cleanup = int(payload.get("file_id") or 0)
                _process_slice_job_payload(payload)
        except Exception as exc:
            try:
                fid = int((payload or {}).get("file_id") or 0)
                if fid > 0:
                    _slice_stats_mark_error(fid)
                    _set_file_slice_state(fid, "error", f"slice worker error: {exc}", actor="system")
            except Exception:
                pass
        finally:
            with SLICE_QUEUE_LOCK:
                if file_id_for_cleanup > 0:
                    SLICE_QUEUED_IDS.discard(file_id_for_cleanup)
            SLICE_QUEUE.task_done()
            # Reset accumulated stats when no jobs remain so a new batch
            # starts with clean counters instead of accumulating old totals.
            try:
                if SLICER_LOCK:
                    with SLICER_LOCK:  # type: ignore
                        if SLICER_STATS.get("processing", 0) <= 0 and SLICE_QUEUE.empty():
                            SLICER_STATS["total"] = 0
                            SLICER_STATS["completed"] = 0
                            SLICER_STATS["processing"] = 0
                            SLICER_STATS["errors"] = 0
                            SLICER_PROCESSING_IDS.clear()
            except Exception:
                pass


def _start_slice_worker_if_needed() -> None:
    global SLICE_WORKER_STARTED
    with SLICE_WORKER_LOCK:
        if SLICE_WORKER_STARTED:
            return
        SLICE_WORKER_STARTED = True
    t = threading.Thread(target=_slice_worker_loop, daemon=True, name="slice-worker")
    t.start()


def enqueue_slice_job(
    file_id: int,
    requested_by: str,
    printer_profile: str = "",
    print_profile: str = "",
    filament_profile: str = "",
    support_mode: str = "auto",
    support_type: str = "",
    support_style: str = "",
    nozzle_left_diameter: str = "",
    nozzle_right_diameter: str = "",
    nozzle_left_flow: str = "",
    nozzle_right_flow: str = "",
    rotation_x_degrees: float = 0.0,
    rotation_y_degrees: float = 0.0,
    rotation_z_degrees: float = 0.0,
    lift_z_mm: float = 0.0,
    bed_width_mm: float = 0.0,
    bed_depth_mm: float = 0.0,
    process_overrides: Optional[dict[str, Any]] = None,
) -> bool:
    fid = int(file_id)
    with SLICE_QUEUE_LOCK:
        if fid in SLICE_QUEUED_IDS:
            return False
        SLICE_QUEUED_IDS.add(fid)
    _start_slice_worker_if_needed()
    normalized_rotation_x = _normalize_rotation_degrees(rotation_x_degrees)
    normalized_rotation_y = _normalize_rotation_degrees(rotation_y_degrees)
    normalized_rotation_z = _normalize_rotation_degrees(rotation_z_degrees)
    # Lift is intentionally disabled; slicer always snaps to plate.
    normalized_lift_z = 0.0
    normalized_support_mode = _normalize_slice_support_mode(support_mode)
    normalized_support_type = _normalize_slice_support_type(support_type)
    normalized_support_style = _normalize_slice_support_style(support_style)
    normalized_nozzle_left_diameter = _normalize_slice_nozzle_diameter(nozzle_left_diameter)
    normalized_nozzle_right_diameter = _normalize_slice_nozzle_diameter(nozzle_right_diameter)
    normalized_nozzle_left_flow = _normalize_slice_nozzle_flow(nozzle_left_flow)
    normalized_nozzle_right_flow = _normalize_slice_nozzle_flow(nozzle_right_flow)
    if normalized_support_mode == "off":
        normalized_support_type = ""
        normalized_support_style = ""
    normalized_bed_width = _normalize_bed_size_mm(bed_width_mm)
    normalized_bed_depth = _normalize_bed_size_mm(bed_depth_mm)
    normalized_process_overrides = _normalize_slice_process_overrides(process_overrides or {})
    SLICE_QUEUE.put(
        {
            "file_id": fid,
            "requested_by": str(requested_by or ""),
            "printer_profile": str(printer_profile or "").strip(),
            "print_profile": str(print_profile or "").strip(),
            "filament_profile": str(filament_profile or "").strip(),
            "support_mode": normalized_support_mode,
            "support_type": normalized_support_type,
            "support_style": normalized_support_style,
            "nozzle_left_diameter": normalized_nozzle_left_diameter,
            "nozzle_right_diameter": normalized_nozzle_right_diameter,
            "nozzle_left_flow": normalized_nozzle_left_flow,
            "nozzle_right_flow": normalized_nozzle_right_flow,
            "rotation_x_degrees": normalized_rotation_x,
            "rotation_y_degrees": normalized_rotation_y,
            "rotation_z_degrees": normalized_rotation_z,
            "lift_z_mm": normalized_lift_z,
            "bed_width_mm": normalized_bed_width,
            "bed_depth_mm": normalized_bed_depth,
            "process_overrides": normalized_process_overrides,
        }
    )
    return True


def _load_mesh_for_thumbnail(mesh_path: Path):
    import trimesh

    loaded = trimesh.load(str(mesh_path), force="scene")
    if isinstance(loaded, trimesh.Scene):
        meshes = []
        for geom in loaded.geometry.values():
            if isinstance(geom, trimesh.Trimesh):
                meshes.append(geom.copy())
        if not meshes:
            raise RuntimeError("No mesh geometry in scene")
        mesh = trimesh.util.concatenate(meshes)
    elif isinstance(loaded, trimesh.Trimesh):
        mesh = loaded
    else:
        raise RuntimeError("Unsupported mesh payload")

    if mesh.is_empty:
        raise RuntimeError("Mesh is empty")
    mesh.remove_unreferenced_vertices()
    if mesh.faces is None or len(mesh.faces) == 0:
        raise RuntimeError("Mesh has no faces")
    return mesh


def _convert_step_to_obj(input_path: Path, temp_dir: Path) -> Tuple[Optional[Path], str]:
    assimp_bin = shutil.which("assimp")
    if not assimp_bin:
        return None, "assimp command not found in container"

    output_path = temp_dir / f"{input_path.stem}.obj"
    commands = [
        [assimp_bin, "export", str(input_path), str(output_path)],
        [assimp_bin, "export", str(input_path), str(output_path), "-fobj"],
    ]

    last_error = ""
    for cmd in commands:
        try:
            proc = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=360,
            )
        except Exception as exc:
            last_error = str(exc)
            continue

        if proc.returncode == 0 and output_path.exists() and output_path.stat().st_size > 0:
            return output_path, ""

        err = (proc.stderr or proc.stdout or "").strip()
        if err:
            last_error = err

    return None, last_error or "assimp could not convert STEP file"


def _render_mesh_thumbnail(mesh_path: Path, output_png: Path) -> None:
    import numpy as np
    import matplotlib

    matplotlib.use("Agg")
    from matplotlib import pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    mesh = _load_mesh_for_thumbnail(mesh_path)
    try:
        mesh.remove_degenerate_faces()
    except Exception:
        pass
    try:
        mesh.fix_normals()
    except Exception:
        pass

    verts = mesh.vertices
    faces = mesh.faces
    normals = mesh.face_normals

    if len(faces) > THUMB_RENDER_FACE_LIMIT:
        # Keep contiguous surface appearance instead of random sparse sampling.
        step = max(1, int(np.ceil(len(faces) / float(THUMB_RENDER_FACE_LIMIT))))
        faces = faces[::step]
        normals = normals[::step]

    triangles = verts[faces]

    fig = plt.figure(figsize=(THUMB_SIZE_PX / 100.0, THUMB_SIZE_PX / 100.0), dpi=100)
    ax = fig.add_subplot(111, projection="3d")
    fig.patch.set_facecolor((0.06, 0.09, 0.13, 1.0))
    ax.set_facecolor((0.06, 0.09, 0.13, 1.0))
    ax.set_axis_off()

    light = np.array([0.25, 0.45, 0.85], dtype=float)
    light = light / np.linalg.norm(light)
    safe_normals = np.asarray(normals, dtype=float)
    norm_len = np.linalg.norm(safe_normals, axis=1, keepdims=True)
    safe_normals = safe_normals / np.maximum(norm_len, 1e-9)
    # Use absolute dot so inconsistent winding does not create random dark patches.
    intensity = np.clip(np.abs(safe_normals.dot(light)), 0.18, 1.0)
    base_rgb = np.array([0.58, 0.70, 0.86], dtype=float)
    face_rgb = np.clip((0.42 + 0.58 * intensity[:, None]) * base_rgb, 0.0, 1.0)
    face_rgba = np.concatenate([face_rgb, np.ones((face_rgb.shape[0], 1), dtype=float)], axis=1)

    poly = Poly3DCollection(triangles, linewidths=0.0, antialiaseds=False)
    poly.set_facecolor(face_rgba)
    poly.set_edgecolor((0.0, 0.0, 0.0, 0.0))
    ax.add_collection3d(poly)

    mins = verts.min(axis=0)
    maxs = verts.max(axis=0)
    center = (mins + maxs) / 2.0
    span = float(max((maxs - mins).max(), 1.0))
    half = span * 0.58
    ax.set_xlim(center[0] - half, center[0] + half)
    ax.set_ylim(center[1] - half, center[1] + half)
    ax.set_zlim(center[2] - half, center[2] + half)
    ax.view_init(elev=24, azim=-38)
    dims = np.maximum(maxs - mins, 1e-6)
    ax.set_box_aspect((float(dims[0]), float(dims[1]), float(dims[2])))

    fig.tight_layout(pad=0.0)
    fig.savefig(str(output_png), dpi=100)
    plt.close(fig)


def _generate_thumbnail_file(file_row: sqlite3.Row) -> str:
    ext = str(file_row["ext"] or "").lower()
    file_id = int(file_row["id"])
    rel_name = _thumbnail_rel_name(file_id)
    thumb_path = _thumbnail_abs_path_from_rel(rel_name)

    source_path = file_disk_path(file_row)
    if not source_path.exists() or not source_path.is_file():
        raise RuntimeError("Source file missing on disk")

    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    temp_output = thumb_path.with_suffix(".tmp.png")
    if temp_output.exists():
        temp_output.unlink(missing_ok=True)

    render_source = source_path
    with tempfile.TemporaryDirectory(prefix="thumb-", dir=str(DATA_DIR)) as tmp:
        tmp_dir = Path(tmp)
        if ext in {".step", ".stp"}:
            converted_obj, convert_error = _convert_step_to_obj(source_path, tmp_dir)
            if not converted_obj:
                raise RuntimeError(f"STEP conversion failed: {convert_error}")
            render_source = converted_obj

        _render_mesh_thumbnail(render_source, temp_output)

    temp_output.replace(thumb_path)
    return rel_name


def _process_thumbnail_for_file_id(file_id: int) -> None:
    with closing(get_conn()) as conn:
        row = conn.execute("SELECT * FROM files WHERE id=?", (int(file_id),)).fetchone()

    if row is None:
        return

    ext = str(row["ext"] or "").lower()
    existing_rel = str(row["thumb_rel"] or "").strip()
    if not _supports_thumbnail_for_ext(ext):
        if existing_rel:
            _safe_remove_thumbnail(existing_rel)
        _set_file_thumbnail_state(int(file_id), "none", thumb_rel="", error="")
        return

    _set_file_thumbnail_state(int(file_id), "processing", thumb_rel=existing_rel, error="")
    try:
        rel_name = _generate_thumbnail_file(row)
        if existing_rel and existing_rel != rel_name:
            _safe_remove_thumbnail(existing_rel)
        _set_file_thumbnail_state(int(file_id), "ready", thumb_rel=rel_name, error="")
    except Exception as exc:
        _set_file_thumbnail_state(int(file_id), "error", thumb_rel=existing_rel, error=str(exc))


def _thumbnail_worker_loop() -> None:
    while True:
        file_id = THUMB_QUEUE.get()
        fid = int(file_id)
        try:
            _process_thumbnail_for_file_id(fid)
        except Exception as exc:
            # Keep queue/state consistent even if unexpected worker errors happen.
            try:
                _set_file_thumbnail_state(fid, "error", error=f"thumbnail worker error: {exc}")
            except Exception:
                pass
        finally:
            with THUMB_QUEUE_LOCK:
                THUMB_QUEUED_IDS.discard(fid)
            THUMB_QUEUE.task_done()


def _start_thumbnail_worker_if_needed() -> None:
    global THUMB_WORKER_STARTED
    with THUMB_WORKER_LOCK:
        if THUMB_WORKER_STARTED:
            return
        THUMB_WORKER_STARTED = True
    t = threading.Thread(target=_thumbnail_worker_loop, daemon=True, name="thumbnail-worker")
    t.start()


def enqueue_thumbnail(file_id: int) -> None:
    fid = int(file_id)
    with THUMB_QUEUE_LOCK:
        if fid in THUMB_QUEUED_IDS:
            return
        THUMB_QUEUED_IDS.add(fid)
    _start_thumbnail_worker_if_needed()
    THUMB_QUEUE.put(fid)


def _serialize_zip_job_row(row: sqlite3.Row) -> dict:
    return {
        "id": int(row["id"]),
        "folder_path": str(row["folder_path"] or ""),
        "zip_name": str(row["zip_name"] or ""),
        "status": str(row["status"] or "queued"),
        "extracted_files": int(row["extracted_files"] or 0),
        "error": str(row["error"] or ""),
        "created_at": str(row["created_at"] or ""),
        "updated_at": str(row["updated_at"] or ""),
    }


def list_zip_jobs_for_folder(folder_path: str) -> list[dict]:
    folder = normalize_folder_path(folder_path)
    if not folder:
        return []

    with closing(get_conn()) as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM zip_jobs
            WHERE folder_path=?
              AND lower(COALESCE(status,'')) IN ('queued', 'processing', 'error')
            ORDER BY id DESC
            LIMIT 25
            """,
            (folder,),
        ).fetchall()
    return [_serialize_zip_job_row(row) for row in rows]


def _create_zip_job(
    folder_path: str,
    zip_name: str,
    created_by: str,
    owner_user_id: Optional[int] = None,
    share_id: Optional[int] = None,
) -> int:
    folder = normalize_folder_path(folder_path)
    if not folder:
        raise ValueError("ZIP job kræver en målmappe")

    created = now_iso()
    with closing(get_conn()) as conn:
        cur = conn.execute(
            """
            INSERT INTO zip_jobs(
                folder_path, zip_name, status, extracted_files, error,
                owner_user_id, share_id, created_by, created_at, updated_at
            ) VALUES (?, ?, 'queued', 0, '', ?, ?, ?, ?, ?)
            """,
            (
                folder,
                str(zip_name or ""),
                int(owner_user_id) if owner_user_id else None,
                int(share_id) if share_id else None,
                str(created_by or ""),
                created,
                created,
            ),
        )
        job_id = int(cur.lastrowid or 0)
        _insert_activity_log_conn(
            conn,
            kind="zip",
            action="queued",
            message="ZIP upload modtaget og sat i kø",
            level="info",
            folder_path=folder,
            target=str(zip_name or f"zip-job-{job_id}"),
            actor=str(created_by or ""),
            job_id=job_id,
        )
        conn.commit()
        return job_id


def _set_zip_job_state(
    job_id: int,
    status: str,
    error: str = "",
    extracted_files: Optional[int] = None,
) -> None:
    jid = int(job_id)
    safe_status = str(status or "").strip().lower() or "queued"
    safe_error = str(error or "").strip()[:1000]
    updated_at = now_iso()

    with closing(get_conn()) as conn:
        row = conn.execute(
            "SELECT folder_path, zip_name, status, error, created_by FROM zip_jobs WHERE id=?",
            (jid,),
        ).fetchone()
        prev_status = str(row["status"] or "").strip().lower() if row else ""
        prev_error = str(row["error"] or "").strip() if row else ""

        if extracted_files is None:
            conn.execute(
                """
                UPDATE zip_jobs
                SET status=?, error=?, updated_at=?
                WHERE id=?
                """,
                (safe_status, safe_error, updated_at, jid),
            )
        else:
            conn.execute(
                """
                UPDATE zip_jobs
                SET status=?, error=?, extracted_files=?, updated_at=?
                WHERE id=?
                """,
                (safe_status, safe_error, max(0, int(extracted_files)), updated_at, jid),
            )

        status_changed = prev_status != safe_status
        error_changed = bool(safe_error) and safe_error != prev_error
        if row is not None and (status_changed or error_changed):
            if safe_status == "processing":
                message = "ZIP udpakning startet"
            elif safe_status == "done":
                count_txt = f" ({max(0, int(extracted_files))} filer)" if extracted_files is not None else ""
                message = f"ZIP udpakning færdig{count_txt}"
            elif safe_status == "error":
                message = safe_error or "ZIP fejl"
            elif safe_status == "queued":
                message = "ZIP sat i kø"
            else:
                message = f"ZIP status: {safe_status}"

            _insert_activity_log_conn(
                conn,
                kind="zip",
                action=safe_status,
                message=message,
                level="error" if safe_status == "error" else "info",
                folder_path=str(row["folder_path"] or ""),
                target=str(row["zip_name"] or f"zip-job-{jid}"),
                actor=str(row["created_by"] or "system"),
                job_id=jid,
            )

        conn.commit()


def _process_zip_extract_job(payload: Dict[str, Any]) -> None:
    job_id = int(payload.get("job_id") or 0)
    zip_path_raw = payload.get("zip_path")
    zip_path = Path(str(zip_path_raw or "")).resolve()
    base_folder = normalize_folder_path(str(payload.get("base_folder") or ""))
    uploaded_by = str(payload.get("uploaded_by") or "")
    upload_client_id = str(payload.get("upload_client_id") or "").strip() or None
    zip_name = str(payload.get("zip_name") or "")
    try:
        last_modified_ms = int(payload.get("last_modified_ms") or 0)
    except Exception:
        last_modified_ms = 0

    _set_zip_job_state(job_id, "processing", "")
    extracted_count = 0
    err_text = ""
    try:
        extracted_count, _row, _created_folders = _extract_zip_upload(
            zip_path=zip_path,
            base_folder=base_folder,
            uploaded_by=uploaded_by,
            upload_client_id=upload_client_id,
            last_modified_ms=last_modified_ms,
            original_zip_name=zip_name,
        )
        if extracted_count <= 0:
            err_text = "ZIP indeholdt ingen gyldige filer."
            _set_zip_job_state(job_id, "error", err_text, extracted_files=0)
            return
        _set_zip_job_state(job_id, "done", "", extracted_files=extracted_count)
    except Exception as exc:
        _set_zip_job_state(job_id, "error", str(exc), extracted_files=extracted_count)
    finally:
        try:
            zip_path.unlink(missing_ok=True)
        except Exception:
            pass


def _zip_extract_worker_loop() -> None:
    while True:
        payload = ZIP_EXTRACT_QUEUE.get()
        try:
            if isinstance(payload, dict):
                _process_zip_extract_job(payload)
        except Exception as exc:
            try:
                job_id = int((payload or {}).get("job_id") or 0)
                if job_id > 0:
                    _set_zip_job_state(job_id, "error", f"zip worker error: {exc}")
            except Exception:
                pass
        finally:
            ZIP_EXTRACT_QUEUE.task_done()


def _start_zip_extract_worker_if_needed() -> None:
    global ZIP_EXTRACT_WORKER_STARTED
    with ZIP_EXTRACT_WORKER_LOCK:
        if ZIP_EXTRACT_WORKER_STARTED:
            return
        ZIP_EXTRACT_WORKER_STARTED = True
    t = threading.Thread(target=_zip_extract_worker_loop, daemon=True, name="zip-extract-worker")
    t.start()


def enqueue_zip_extract_job(payload: Dict[str, Any]) -> None:
    _start_zip_extract_worker_if_needed()
    ZIP_EXTRACT_QUEUE.put(dict(payload or {}))


def _bootstrap_thumbnail_queue() -> None:
    _start_thumbnail_worker_if_needed()
    placeholders = ",".join("?" for _ in THUMBABLE_3D_EXTENSIONS)
    if not placeholders:
        return

    sql = f"""
        SELECT id
        FROM files
        WHERE lower(COALESCE(ext,'')) IN ({placeholders})
          AND (thumb_rel IS NULL OR TRIM(thumb_rel)='' OR lower(COALESCE(thumb_status,'')) IN ('queued','processing','error'))
        ORDER BY id DESC
        LIMIT 2000
    """
    with closing(get_conn()) as conn:
        rows = conn.execute(sql, tuple(sorted(THUMBABLE_3D_EXTENSIONS))).fetchall()
    for row in rows:
        try:
            enqueue_thumbnail(int(row["id"]))
        except Exception:
            pass


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _insert_activity_log_conn(
    conn: sqlite3.Connection,
    kind: str,
    action: str,
    message: str,
    level: str = "info",
    folder_path: str = "",
    target: str = "",
    actor: str = "",
    file_id: Optional[int] = None,
    job_id: Optional[int] = None,
) -> None:
    safe_level = str(level or "info").strip().lower() or "info"
    if safe_level not in {"info", "warn", "error"}:
        safe_level = "info"
    safe_kind = str(kind or "system").strip().lower() or "system"
    safe_action = str(action or "event").strip().lower() or "event"
    safe_message = str(message or "").strip()[:2000]
    safe_folder = normalize_folder_path(str(folder_path or ""))
    safe_target = str(target or "").strip()[:300]
    safe_actor = str(actor or "").strip()[:120]

    conn.execute(
        """
        INSERT INTO activity_logs(
            level, kind, action, target, folder_path, message, actor, file_id, job_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            safe_level,
            safe_kind,
            safe_action,
            safe_target,
            safe_folder,
            safe_message,
            safe_actor,
            int(file_id) if file_id else None,
            int(job_id) if job_id else None,
            now_iso(),
        ),
    )


def log_activity(
    kind: str,
    action: str,
    message: str,
    level: str = "info",
    folder_path: str = "",
    target: str = "",
    actor: str = "",
    file_id: Optional[int] = None,
    job_id: Optional[int] = None,
) -> None:
    try:
        with closing(get_conn()) as conn:
            _insert_activity_log_conn(
                conn,
                kind=kind,
                action=action,
                message=message,
                level=level,
                folder_path=folder_path,
                target=target,
                actor=actor,
                file_id=file_id,
                job_id=job_id,
            )
            conn.commit()
    except Exception:
        pass


def init_db() -> None:
    with closing(get_conn()) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                home_folder TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_folder_access (
                user_id INTEGER NOT NULL,
                folder_path TEXT NOT NULL,
                permission TEXT NOT NULL DEFAULT 'view',
                created_at TEXT NOT NULL,
                PRIMARY KEY (user_id, folder_path),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                folder_path TEXT UNIQUE NOT NULL,
                owner_user_id INTEGER,
                created_at TEXT NOT NULL,
                FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                folder_path TEXT NOT NULL,
                rel_path TEXT UNIQUE NOT NULL,
                filename TEXT NOT NULL,
                ext TEXT,
                mime_type TEXT,
                file_size INTEGER,
                uploaded_by TEXT,
                uploaded_at TEXT NOT NULL,
                note TEXT,
                quantity INTEGER DEFAULT 1,
                printed INTEGER NOT NULL DEFAULT 0,
                printed_at TEXT,
                printed_by TEXT,
                slice_status TEXT DEFAULT 'none',
                slice_error TEXT,
                slice_updated_at TEXT,
                upload_client_id TEXT,
                thumb_rel TEXT,
                thumb_status TEXT DEFAULT 'none',
                thumb_error TEXT,
                thumb_updated_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_path);
            CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at DESC);
            CREATE INDEX IF NOT EXISTS idx_files_upload_client_id ON files(upload_client_id);

            CREATE TABLE IF NOT EXISTS file_attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                rel_name TEXT UNIQUE NOT NULL,
                original_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                uploaded_by TEXT,
                uploaded_at TEXT NOT NULL,
                FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_file_attachments_file ON file_attachments(file_id, uploaded_at DESC, id DESC);

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS zip_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                folder_path TEXT NOT NULL,
                zip_name TEXT,
                status TEXT NOT NULL DEFAULT 'queued',
                extracted_files INTEGER NOT NULL DEFAULT 0,
                error TEXT,
                owner_user_id INTEGER,
                share_id INTEGER,
                created_by TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_zip_jobs_folder_status ON zip_jobs(folder_path, status, id DESC);

            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL DEFAULT 'info',
                kind TEXT NOT NULL,
                action TEXT NOT NULL,
                target TEXT,
                folder_path TEXT,
                message TEXT,
                actor TEXT,
                file_id INTEGER,
                job_id INTEGER,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC, id DESC);
            CREATE INDEX IF NOT EXISTS idx_activity_logs_kind ON activity_logs(kind, action, id DESC);

            CREATE TABLE IF NOT EXISTS share_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_hash TEXT UNIQUE NOT NULL,
                token_plain TEXT,
                share_name TEXT,
                folder_path TEXT NOT NULL,
                permission TEXT NOT NULL DEFAULT 'view',
                expires_at TEXT,
                revoked INTEGER NOT NULL DEFAULT 0,
                use_external_base_url INTEGER NOT NULL DEFAULT 0,
                password_hash TEXT,
                require_visitor_name INTEGER NOT NULL DEFAULT 0,
                created_by_user_id INTEGER,
                created_at TEXT NOT NULL,
                last_used_at TEXT,
                FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS share_link_folders (
                share_id INTEGER NOT NULL,
                folder_path TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (share_id, folder_path),
                FOREIGN KEY(share_id) REFERENCES share_links(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_share_link_folders_share ON share_link_folders(share_id);
            """
        )

        dns_row = conn.execute("SELECT value FROM settings WHERE key='external_base_url'").fetchone()
        if dns_row is None:
            conn.execute(
                "INSERT INTO settings(key, value) VALUES('external_base_url', '')"
            )

        file_cols = [r[1] for r in conn.execute("PRAGMA table_info(files)").fetchall()]
        if "thumb_rel" not in file_cols:
            conn.execute("ALTER TABLE files ADD COLUMN thumb_rel TEXT")
        if "thumb_status" not in file_cols:
            conn.execute("ALTER TABLE files ADD COLUMN thumb_status TEXT DEFAULT 'none'")
        if "thumb_error" not in file_cols:
            conn.execute("ALTER TABLE files ADD COLUMN thumb_error TEXT")
        if "thumb_updated_at" not in file_cols:
            conn.execute("ALTER TABLE files ADD COLUMN thumb_updated_at TEXT")
        if "printed" not in file_cols:
            conn.execute("ALTER TABLE files ADD COLUMN printed INTEGER NOT NULL DEFAULT 0")
        if "printed_at" not in file_cols:
            conn.execute("ALTER TABLE files ADD COLUMN printed_at TEXT")
        if "printed_by" not in file_cols:
            conn.execute("ALTER TABLE files ADD COLUMN printed_by TEXT")
        if "slice_status" not in file_cols:
            conn.execute("ALTER TABLE files ADD COLUMN slice_status TEXT DEFAULT 'none'")
        if "slice_error" not in file_cols:
            conn.execute("ALTER TABLE files ADD COLUMN slice_error TEXT")
        if "slice_updated_at" not in file_cols:
            conn.execute("ALTER TABLE files ADD COLUMN slice_updated_at TEXT")
        conn.execute(
            "UPDATE files SET thumb_status='none' WHERE thumb_status IS NULL OR TRIM(thumb_status)=''"
        )
        conn.execute("UPDATE files SET printed=0 WHERE printed IS NULL")
        conn.execute(
            "UPDATE files SET slice_status='none' WHERE slice_status IS NULL OR TRIM(slice_status)=''"
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_files_thumb_status ON files(thumb_status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_files_printed ON files(printed)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_files_slice_status ON files(slice_status)")
        conn.commit()


@dataclass
class User(UserMixin):
    id: int
    username: str
    role: str
    home_folder: str

    @property
    def is_admin(self) -> bool:
        return str(self.role or "").lower() == "admin"


def row_to_user(row: Optional[sqlite3.Row]) -> Optional[User]:
    if row is None:
        return None
    return User(
        id=int(row["id"]),
        username=str(row["username"]),
        role=str(row["role"] or "user"),
        home_folder=normalize_folder_path(str(row["home_folder"] or "")),
    )


def users_count() -> int:
    with closing(get_conn()) as conn:
        row = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()
        return int(row["c"] if row else 0)


def get_setting(key: str, default: str = "") -> str:
    with closing(get_conn()) as conn:
        row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return str(row["value"] if row and row["value"] is not None else default)


def set_setting(key: str, value: str) -> None:
    with closing(get_conn()) as conn:
        conn.execute(
            "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (str(key), str(value)),
        )
        conn.commit()


def migrate_thumbnail_render_style_if_needed() -> None:
    current = str(get_setting("thumb_render_style_version", "") or "").strip()
    if current == THUMB_RENDER_STYLE_VERSION:
        return

    rels_to_remove: list[str] = []
    with closing(get_conn()) as conn:
        rows = conn.execute(
            f"""
            SELECT id, thumb_rel
            FROM files
            WHERE lower(COALESCE(ext,'')) IN ({",".join("?" for _ in THUMBABLE_3D_EXTENSIONS)})
            """,
            tuple(sorted(THUMBABLE_3D_EXTENSIONS)),
        ).fetchall()

        for row in rows:
            rel = str(row["thumb_rel"] or "").strip()
            if rel:
                rels_to_remove.append(rel)

        conn.execute(
            f"""
            UPDATE files
            SET thumb_rel='',
                thumb_status='queued',
                thumb_error='',
                thumb_updated_at=?
            WHERE lower(COALESCE(ext,'')) IN ({",".join("?" for _ in THUMBABLE_3D_EXTENSIONS)})
            """,
            (now_iso(), *tuple(sorted(THUMBABLE_3D_EXTENSIONS))),
        )
        conn.commit()

    for rel in rels_to_remove:
        _safe_remove_thumbnail(rel)

    set_setting("thumb_render_style_version", THUMB_RENDER_STYLE_VERSION)


def ensure_folder_record(folder_path: str, owner_user_id: Optional[int] = None) -> None:
    folder = normalize_folder_path(folder_path)
    if not folder:
        return
    with closing(get_conn()) as conn:
        conn.execute(
            "INSERT OR IGNORE INTO folders(folder_path, owner_user_id, created_at) VALUES(?,?,?)",
            (folder, int(owner_user_id) if owner_user_id else None, now_iso()),
        )
        conn.commit()


def ensure_user_home_folder(user_id: int, username: str, home_folder: str) -> None:
    _ = username
    folder, abs_folder = folder_abs_path(home_folder)
    abs_folder.mkdir(parents=True, exist_ok=True)

    with closing(get_conn()) as conn:
        conn.execute(
            "INSERT OR IGNORE INTO folders(folder_path, owner_user_id, created_at) VALUES(?,?,?)",
            (folder, int(user_id), now_iso()),
        )
        conn.execute(
            "INSERT OR REPLACE INTO user_folder_access(user_id, folder_path, permission, created_at) VALUES(?,?,?,?)",
            (int(user_id), folder, "manage", now_iso()),
        )
        conn.commit()


def ensure_user_storage_ready(user: User) -> str:
    home_folder = normalize_folder_path(str(user.home_folder or ""))
    if not home_folder:
        fallback = normalize_folder_path(f"users/{username_to_folder_slug(user.username, int(user.id))}")
        if fallback:
            home_folder = fallback
            try:
                with closing(get_conn()) as conn:
                    conn.execute("UPDATE users SET home_folder=? WHERE id=?", (home_folder, int(user.id)))
                    conn.commit()
            except Exception:
                pass
            user.home_folder = home_folder

    if not home_folder:
        raise ValueError("Kunne ikke bestemme brugerens hjemmemappe")

    ensure_user_home_folder(int(user.id), str(user.username), home_folder)
    return home_folder


def ensure_user_daily_upload_folder(user: User) -> str:
    home_folder = ensure_user_storage_ready(user)
    day_segment = datetime.now().strftime("%Y-%m-%d")
    day_folder = normalize_folder_path(f"{home_folder}/{day_segment}")
    _, abs_day_folder = folder_abs_path(day_folder)
    abs_day_folder.mkdir(parents=True, exist_ok=True)
    ensure_folder_record(day_folder, owner_user_id=int(user.id))
    return day_folder


def create_user(username: str, password: str, role: str = "user") -> int:
    clean_username = normalize_username(username)
    if len(str(password or "")) < 4:
        raise ValueError("Password skal være mindst 4 tegn.")

    role_norm = "admin" if str(role or "").strip().lower() == "admin" else "user"
    pwd_hash = generate_password_hash(password)

    with closing(get_conn()) as conn:
        base_slug = username_to_folder_slug(clean_username)
        home_folder = f"users/{base_slug}"
        suffix = 1
        while (
            conn.execute("SELECT 1 FROM users WHERE home_folder=?", (home_folder,)).fetchone()
            is not None
        ):
            suffix += 1
            home_folder = f"users/{base_slug}-{suffix}"

        cur = conn.execute(
            "INSERT INTO users(username, password_hash, role, home_folder, created_at) VALUES(?,?,?,?,?)",
            (clean_username, pwd_hash, role_norm, home_folder, now_iso()),
        )
        conn.commit()
        user_id = int(cur.lastrowid)

    ensure_user_home_folder(user_id, clean_username, home_folder)
    return user_id


def fetch_user_by_username(username: str) -> Optional[User]:
    with closing(get_conn()) as conn:
        row = conn.execute(
            "SELECT id, username, role, home_folder FROM users WHERE username=?",
            (str(username or "").strip(),),
        ).fetchone()
    return row_to_user(row)


def get_user_by_id(user_id: int) -> Optional[User]:
    with closing(get_conn()) as conn:
        row = conn.execute(
            "SELECT id, username, role, home_folder FROM users WHERE id=?",
            (int(user_id),),
        ).fetchone()
    return row_to_user(row)


def user_acl_rows(user_id: int) -> list[sqlite3.Row]:
    with closing(get_conn()) as conn:
        return conn.execute(
            "SELECT folder_path, permission FROM user_folder_access WHERE user_id=?",
            (int(user_id),),
        ).fetchall()


def permission_for_user_folder(user: User, folder_path: str) -> str:
    if user.is_admin:
        return "manage"

    normalized = normalize_folder_path(folder_path)

    if not normalized:
        return "view"

    best = 0
    rows = user_acl_rows(user.id)
    for row in rows:
        acl_folder = normalize_folder_path(str(row["folder_path"] or ""))
        if not acl_folder:
            continue
        if normalized == acl_folder or normalized.startswith(acl_folder + "/"):
            perm = str(row["permission"] or "view")
            best = max(best, PERMISSION_RANK.get(perm, 0))

    return RANK_PERMISSION.get(best, "")


def user_can_access_file(user: User, file_row: sqlite3.Row, needed: str = "view") -> bool:
    folder = normalize_folder_path(str(file_row["folder_path"] or ""))
    return permission_allows(permission_for_user_folder(user, folder), needed)


def list_accessible_folders(user: User) -> list[dict]:
    candidates: set[str] = set()
    if user.is_admin:
        with closing(get_conn()) as conn:
            rows = conn.execute(
                "SELECT folder_path FROM folders UNION SELECT folder_path FROM files"
            ).fetchall()
        for row in rows:
            path = normalize_folder_path(str(row["folder_path"] or ""))
            if path:
                candidates.add(path)
    else:
        rows = user_acl_rows(user.id)
        for row in rows:
            path = normalize_folder_path(str(row["folder_path"] or ""))
            if path:
                candidates.add(path)

        with closing(get_conn()) as conn:
            folder_rows = conn.execute(
                "SELECT folder_path FROM folders UNION SELECT folder_path FROM files"
            ).fetchall()

        for row in folder_rows:
            path = normalize_folder_path(str(row["folder_path"] or ""))
            if not path:
                continue
            if permission_allows(permission_for_user_folder(user, path), "view"):
                candidates.add(path)

    expanded = set(candidates)
    for path in list(candidates):
        expanded.update(_ancestor_paths(path))

    items: list[dict] = []
    for path in sorted(expanded, key=lambda p: p.lower()):
        perm = permission_for_user_folder(user, path)
        if not permission_allows(perm, "view"):
            continue
        items.append(
            {
                "path": path,
                "permission": perm,
                "can_upload": permission_allows(perm, "upload"),
                "can_manage": permission_allows(perm, "manage"),
            }
        )

    return items


def allocate_unique_target(folder_abs: Path, filename: str) -> Path:
    target = folder_abs / filename
    stem = Path(filename).stem
    suffix = Path(filename).suffix
    counter = 1
    while target.exists():
        target = folder_abs / f"{stem}_{counter}{suffix}"
        counter += 1
    return target


def upsert_file_record(
    folder_path: str,
    filename: str,
    disk_path: Path,
    uploaded_by: str,
    upload_client_id: Optional[str],
) -> sqlite3.Row:
    folder = normalize_folder_path(folder_path)
    rel_path = upload_relative_path(folder, filename)
    ext = Path(filename).suffix.lower()
    mime_type = guess_mime(filename, ext)
    slice_status = "none"
    slice_error = ""
    slice_updated_at = now_iso()
    thumb_status = "queued" if _supports_thumbnail_for_ext(ext) else "none"
    thumb_rel = ""
    thumb_error = ""
    thumb_updated_at = now_iso()

    try:
        file_size = int(disk_path.stat().st_size)
    except Exception:
        file_size = 0

    with closing(get_conn()) as conn:
        conn.execute(
            """
            INSERT INTO files(
                folder_path, rel_path, filename, ext, mime_type, file_size,
                uploaded_by, uploaded_at, note, quantity,
                slice_status, slice_error, slice_updated_at, upload_client_id,
                thumb_rel, thumb_status, thumb_error, thumb_updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 1, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(rel_path) DO UPDATE SET
                filename=excluded.filename,
                ext=excluded.ext,
                mime_type=excluded.mime_type,
                file_size=excluded.file_size,
                uploaded_by=excluded.uploaded_by,
                uploaded_at=excluded.uploaded_at,
                printed=0,
                printed_at=NULL,
                printed_by=NULL,
                slice_status=excluded.slice_status,
                slice_error=excluded.slice_error,
                slice_updated_at=excluded.slice_updated_at,
                upload_client_id=excluded.upload_client_id,
                thumb_rel=excluded.thumb_rel,
                thumb_status=excluded.thumb_status,
                thumb_error=excluded.thumb_error,
                thumb_updated_at=excluded.thumb_updated_at
            """,
            (
                folder,
                rel_path,
                filename,
                ext,
                mime_type,
                file_size,
                str(uploaded_by or ""),
                now_iso(),
                slice_status,
                slice_error,
                slice_updated_at,
                str(upload_client_id or "") if upload_client_id else None,
                thumb_rel,
                thumb_status,
                thumb_error,
                thumb_updated_at,
            ),
        )
        row = conn.execute(
            "SELECT * FROM files WHERE rel_path=?",
            (rel_path,),
        ).fetchone()
        conn.commit()

    if row is None:
        raise RuntimeError("Kunne ikke oprette filpost")
    return row


def commit_uploaded_file(
    source_path: Path,
    folder_path: str,
    original_name: str,
    uploaded_by: str,
    upload_client_id: Optional[str],
    last_modified_ms: int = 0,
) -> sqlite3.Row:
    folder, abs_folder = folder_abs_path(folder_path)
    abs_folder.mkdir(parents=True, exist_ok=True)
    ensure_folder_record(folder)

    clean_name = sanitize_filename(original_name)
    target = allocate_unique_target(abs_folder, clean_name)

    shutil.move(str(source_path), str(target))
    if last_modified_ms > 0:
        try:
            ts = float(last_modified_ms) / 1000.0
            os.utime(target, (ts, ts))
        except Exception:
            pass

    row = upsert_file_record(
        folder_path=folder,
        filename=target.name,
        disk_path=target,
        uploaded_by=uploaded_by,
        upload_client_id=upload_client_id,
    )
    try:
        log_activity(
            kind="upload",
            action="completed",
            message=f"Fil uploadet ({int(row['file_size'] or 0)} bytes)",
            level="info",
            folder_path=str(row["folder_path"] or folder),
            target=str(row["filename"] or target.name),
            actor=str(uploaded_by or ""),
            file_id=int(row["id"]),
        )
    except Exception:
        pass
    try:
        ext = str(row["ext"] or "").lower()
        if _supports_thumbnail_for_ext(ext):
            enqueue_thumbnail(int(row["id"]))
    except Exception:
        pass
    return row


def file_disk_path(file_row: sqlite3.Row) -> Path:
    folder, abs_folder = folder_abs_path(str(file_row["folder_path"] or ""))
    _ = folder
    filename = str(file_row["filename"] or "")
    full_path = (abs_folder / filename).resolve()
    if not _is_relative_to(UPLOAD_ROOT, full_path):
        raise ValueError("Ugyldig filsti")
    return full_path


def file_thumb_path(file_row: sqlite3.Row) -> Optional[Path]:
    rel = str(file_row["thumb_rel"] or "").strip()
    if not rel:
        return None
    return _thumbnail_abs_path_from_rel(rel)


def _is_slice_output_ext(ext: str) -> bool:
    return str(ext or "").strip().lower() == ".gcode"


def _expected_slice_output_stem(source_filename: str) -> str:
    source_stem = str(Path(str(source_filename or "")).stem or "").strip()
    if not source_stem:
        return ""
    expected_name = sanitize_filename(f"{source_stem}.gcode")
    return str(Path(expected_name).stem or "").strip().lower()


def _slice_output_name_matches_source(source_filename: str, output_filename: str) -> bool:
    expected_stem = _expected_slice_output_stem(source_filename)
    if not expected_stem:
        return False

    output_stem = str(Path(str(output_filename or "")).stem or "").strip().lower()
    if not output_stem:
        return False

    if output_stem == expected_stem:
        return True

    if output_stem.startswith(f"{expected_stem}_"):
        suffix = output_stem[len(expected_stem) + 1:]
        return suffix.isdigit()

    return False


def _pick_slice_output_for_source_row(source_row: sqlite3.Row, candidate_rows: list[sqlite3.Row]) -> Optional[sqlite3.Row]:
    source_ext = str(source_row["ext"] or "").lower()
    if not _supports_slicing_for_ext(source_ext):
        return None

    source_filename = str(source_row["filename"] or "")
    matches: list[sqlite3.Row] = []
    for candidate in candidate_rows:
        candidate_ext = str(candidate["ext"] or "").lower()
        if not _is_slice_output_ext(candidate_ext):
            continue

        candidate_name = str(candidate["filename"] or "")
        if _slice_output_name_matches_source(source_filename, candidate_name):
            matches.append(candidate)

    if not matches:
        return None

    matches.sort(
        key=lambda r: (
            str(r["uploaded_at"] or ""),
            int(r["id"] or 0),
        ),
        reverse=True,
    )
    return matches[0]


def _pair_visible_file_rows_with_slice_output(rows: list[sqlite3.Row]) -> list[tuple[sqlite3.Row, Optional[sqlite3.Row]]]:
    gcode_by_folder: dict[str, list[sqlite3.Row]] = {}
    visible_rows: list[sqlite3.Row] = []

    for row in rows:
        folder_path = normalize_folder_path(str(row["folder_path"] or ""))
        ext = str(row["ext"] or "").lower()
        if _is_slice_output_ext(ext):
            gcode_by_folder.setdefault(folder_path, []).append(row)
            continue
        visible_rows.append(row)

    paired: list[tuple[sqlite3.Row, Optional[sqlite3.Row]]] = []
    for row in visible_rows:
        folder_path = normalize_folder_path(str(row["folder_path"] or ""))
        output_row = _pick_slice_output_for_source_row(row, gcode_by_folder.get(folder_path, []))
        paired.append((row, output_row))

    return paired


def _parse_first_float_from_text(value: str) -> Optional[float]:
    text = str(value or "")
    match = re.search(r"[-+]?\d+(?:[\.,]\d+)?", text)
    if not match:
        return None

    raw = str(match.group(0) or "").strip().replace(",", ".")
    if not raw:
        return None

    try:
        return float(raw)
    except Exception:
        return None


def _parse_gcode_summary_from_path(gcode_path: Path) -> dict[str, Any]:
    print_time_total = ""
    filament_grams: Optional[float] = None
    filament_cost_per_kg: Optional[float] = None
    filament_cost_total: Optional[float] = None

    try:
        with gcode_path.open("r", encoding="utf-8", errors="ignore") as fh:
            for line_no, raw_line in enumerate(fh):
                if line_no > 4000:
                    break

                line = str(raw_line or "").strip()
                if not line:
                    continue

                lowered = line.lower()
                if "executable_block_start" in lowered:
                    break

                if not print_time_total:
                    model_match = re.search(
                        r"^;\s*model printing time\s*:\s*([^;]+?)(?:\s*;\s*total estimated time\s*:\s*([^;]+))?\s*$",
                        line,
                        flags=re.IGNORECASE,
                    )
                    if model_match:
                        preferred = str(model_match.group(2) or "").strip()
                        fallback = str(model_match.group(1) or "").strip()
                        print_time_total = preferred or fallback

                if not print_time_total:
                    total_time_match = re.search(
                        r"^;\s*total estimated time\s*:\s*(.+)$",
                        line,
                        flags=re.IGNORECASE,
                    )
                    if total_time_match:
                        print_time_total = str(total_time_match.group(1) or "").strip()

                if filament_grams is None:
                    grams_match = re.search(
                        r"^;\s*total filament weight\s*\[g\]\s*:\s*(.+)$",
                        line,
                        flags=re.IGNORECASE,
                    )
                    if grams_match:
                        filament_grams = _parse_first_float_from_text(grams_match.group(1))

                if filament_cost_total is None:
                    total_cost_match = re.search(
                        r"^;\s*total filament cost(?:\s*\[[^\]]+\])?\s*:\s*(.+)$",
                        line,
                        flags=re.IGNORECASE,
                    )
                    if total_cost_match:
                        filament_cost_total = _parse_first_float_from_text(total_cost_match.group(1))

                if filament_cost_per_kg is None:
                    per_kg_match = re.search(
                        r"^;\s*filament_cost\s*=\s*(.+)$",
                        line,
                        flags=re.IGNORECASE,
                    )
                    if per_kg_match:
                        filament_cost_per_kg = _parse_first_float_from_text(per_kg_match.group(1))

                if print_time_total and filament_grams is not None and filament_cost_total is not None:
                    break
    except Exception:
        return {}

    if filament_cost_total is None and filament_grams is not None and filament_cost_per_kg is not None:
        try:
            filament_cost_total = (float(filament_grams) / 1000.0) * float(filament_cost_per_kg)
        except Exception:
            filament_cost_total = None

    summary: dict[str, Any] = {}
    if print_time_total:
        summary["print_time_total"] = print_time_total
    if filament_grams is not None:
        summary["filament_grams"] = round(float(filament_grams), 3)
    if filament_cost_total is not None:
        summary["filament_cost_kr"] = round(float(filament_cost_total), 2)

    return summary


def _extract_gcode_summary_from_row(row: sqlite3.Row) -> dict[str, Any]:
    ext = str(row["ext"] or "").lower()
    if not _is_slice_output_ext(ext):
        return {}

    try:
        path = file_disk_path(row)
    except Exception:
        return {}

    if not path.exists() or not path.is_file():
        return {}

    return _parse_gcode_summary_from_path(path)


def _serialize_slice_output_row(row: sqlite3.Row, share_token: Optional[str] = None) -> dict[str, Any]:
    if share_token:
        content_url = url_for("api_share_file_content", token=share_token, file_id=int(row["id"]))
        download_url = url_for("api_share_file_download", token=share_token, file_id=int(row["id"]))
    else:
        content_url = url_for("api_file_content", file_id=int(row["id"]))
        download_url = url_for("api_file_download", file_id=int(row["id"]))

    summary = _extract_gcode_summary_from_row(row)

    return {
        "id": int(row["id"]),
        "filename": str(row["filename"] or ""),
        "ext": str(row["ext"] or "").lower(),
        "file_size": int(row["file_size"] or 0),
        "uploaded_at": str(row["uploaded_at"] or ""),
        "content_url": content_url,
        "download_url": download_url,
        "summary": summary,
    }


def serialize_file_row(
    row: sqlite3.Row,
    share_token: Optional[str] = None,
    slice_output_row: Optional[sqlite3.Row] = None,
) -> dict:
    ext = str(row["ext"] or "").lower()
    is_3d = ext in THREE_D_EXTENSIONS
    is_3d_openable = ext in THREE_D_VIEWER_EXTENSIONS
    can_slice = _supports_slicing_for_ext(ext)
    slice_status = str(row["slice_status"] or "none").strip().lower() or "none"
    preview_3d_thumbnail = ext in THREE_D_THUMBNAIL_EXTENSIONS
    thumb_supported = _supports_thumbnail_for_ext(ext)
    thumb_status = str(row["thumb_status"] or "none").strip().lower() or "none"
    thumb_rel = str(row["thumb_rel"] or "").strip()
    has_thumb = bool(thumb_rel)

    if share_token:
        content_url = url_for("api_share_file_content", token=share_token, file_id=int(row["id"]))
        download_url = url_for("api_share_file_download", token=share_token, file_id=int(row["id"]))
        thumb_url = url_for("api_share_file_thumb", token=share_token, file_id=int(row["id"])) if has_thumb else ""
    else:
        content_url = url_for("api_file_content", file_id=int(row["id"]))
        download_url = url_for("api_file_download", file_id=int(row["id"]))
        thumb_url = url_for("api_file_thumb", file_id=int(row["id"])) if has_thumb else ""

    return {
        "id": int(row["id"]),
        "folder_path": str(row["folder_path"] or ""),
        "rel_path": str(row["rel_path"] or ""),
        "filename": str(row["filename"] or ""),
        "ext": ext,
        "mime_type": str(row["mime_type"] or "application/octet-stream"),
        "file_size": int(row["file_size"] or 0),
        "uploaded_by": str(row["uploaded_by"] or ""),
        "uploaded_at": str(row["uploaded_at"] or ""),
        "note": str(row["note"] or ""),
        "quantity": int(row["quantity"] or 1),
        "printed": bool(int(row["printed"] or 0)),
        "printed_at": str(row["printed_at"] or ""),
        "printed_by": str(row["printed_by"] or ""),
        "can_slice": bool(can_slice),
        "slice_status": slice_status,
        "slice_error": str(row["slice_error"] or ""),
        "slice_updated_at": str(row["slice_updated_at"] or ""),
        "upload_client_id": str(row["upload_client_id"] or ""),
        "thumb_status": thumb_status,
        "thumb_error": str(row["thumb_error"] or ""),
        "thumb_url": thumb_url,
        "is_3d": is_3d,
        "is_3d_openable": is_3d_openable,
        "preview_3d_thumbnail": preview_3d_thumbnail,
        "thumb_supported": bool(thumb_supported),
        "content_url": content_url,
        "download_url": download_url,
        "slice_output": _serialize_slice_output_row(slice_output_row, share_token=share_token) if slice_output_row is not None else None,
    }


def serialize_file_attachment_row(row: sqlite3.Row) -> dict:
    file_id = int(row["file_id"])
    attachment_id = int(row["id"])
    content_url = url_for("api_file_attachment_content", file_id=file_id, attachment_id=attachment_id)
    return {
        "id": attachment_id,
        "file_id": file_id,
        "original_name": str(row["original_name"] or ""),
        "mime_type": str(row["mime_type"] or "image/jpeg"),
        "file_size": int(row["file_size"] or 0),
        "uploaded_by": str(row["uploaded_by"] or ""),
        "uploaded_at": str(row["uploaded_at"] or ""),
        "content_url": content_url,
    }


def tus_headers(extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    headers: Dict[str, str] = {
        "Tus-Resumable": "1.0.0",
        "Tus-Version": "1.0.0",
        "Tus-Extension": "creation",
    }
    if extra:
        headers.update(extra)
    return headers


def tus_require_version() -> Optional[Tuple[dict, int]]:
    ver = str(request.headers.get("Tus-Resumable") or "").strip()
    if ver != "1.0.0":
        return ({"ok": False, "error": "Missing or invalid Tus-Resumable"}, 412)
    return None


def parse_tus_metadata(raw: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    if not raw:
        return out
    for pair in raw.split(","):
        part = str(pair or "").strip()
        if not part:
            continue
        chunks = part.split(" ", 1)
        if len(chunks) != 2:
            continue
        key = chunks[0].strip()
        if not key:
            continue
        encoded = chunks[1].strip()
        try:
            decoded = base64.b64decode(encoded).decode("utf-8") if encoded else ""
        except Exception:
            decoded = ""
        out[key] = decoded
    return out


def tus_upload_paths(upload_id: str) -> Tuple[Path, Path]:
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", str(upload_id or ""))
    if not safe_id:
        raise ValueError("Invalid upload id")
    return (TUS_TMP_DIR / f"{safe_id}.bin", TUS_TMP_DIR / f"{safe_id}.json")


def tus_load_meta(upload_id: str) -> Optional[Dict[str, Any]]:
    try:
        _, meta_path = tus_upload_paths(upload_id)
        if not meta_path.exists():
            return None
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return None


def tus_store_meta(upload_id: str, meta: Dict[str, Any]) -> None:
    _, meta_path = tus_upload_paths(upload_id)
    meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")


def share_folder_allowed(folder_path: str, allowed_folders: list[str]) -> bool:
    folder = normalize_folder_path(folder_path)
    if not folder:
        return False
    for base in allowed_folders:
        b = normalize_folder_path(base)
        if folder == b or folder.startswith(b + "/"):
            return True
    return False


def get_share_folders(conn: sqlite3.Connection, share_id: int, fallback_folder: str) -> list[str]:
    rows = conn.execute(
        "SELECT folder_path FROM share_link_folders WHERE share_id=? ORDER BY folder_path",
        (int(share_id),),
    ).fetchall()
    out: list[str] = []
    for row in rows:
        path = normalize_folder_path(str(row["folder_path"] or ""))
        if path and path not in out:
            out.append(path)
    fallback = normalize_folder_path(fallback_folder)
    if fallback and fallback not in out:
        out.append(fallback)
    return out


def resolve_share(token: str) -> Optional[sqlite3.Row]:
    digest = token_digest(token)
    with closing(get_conn()) as conn:
        row = conn.execute(
            "SELECT * FROM share_links WHERE token_hash=? OR token_plain=? LIMIT 1",
            (digest, str(token or "")),
        ).fetchone()
    return row


def share_session_key(share_id: int) -> str:
    return f"share_auth_{int(share_id)}"


def share_visitor_key(share_id: int) -> str:
    return f"share_visitor_{int(share_id)}"


def share_access(
    token: str,
    required: str = "view",
) -> Tuple[Optional[sqlite3.Row], Optional[dict], list[str]]:
    row = resolve_share(token)
    if row is None:
        return None, {"ok": False, "error": "Share-link er ugyldigt."}, []

    if int(row["revoked"] or 0):
        return None, {"ok": False, "error": "Share-link er deaktiveret."}, []

    if share_is_expired(row["expires_at"]):
        return None, {"ok": False, "error": "Share-link er udløbet."}, []

    permission = str(row["permission"] or "view")
    if not permission_allows(permission, required):
        return None, {"ok": False, "error": "Mangler rettighed til denne handling."}, []

    share_id = int(row["id"])
    with closing(get_conn()) as conn:
        folders = get_share_folders(conn, share_id, str(row["folder_path"] or ""))

    requires_password = bool(str(row["password_hash"] or "").strip())
    if requires_password:
        if not session.get(share_session_key(share_id), False):
            return None, {
                "ok": False,
                "error": "Kode er påkrævet for dette link.",
                "requires_auth": True,
                "require_visitor_name": bool(int(row["require_visitor_name"] or 0)),
            }, folders

    if int(row["require_visitor_name"] or 0):
        visitor_name = str(session.get(share_visitor_key(share_id)) or "").strip()
        if not visitor_name:
            return None, {
                "ok": False,
                "error": "Besøgernavn er påkrævet for dette link.",
                "requires_auth": True,
                "require_visitor_name": True,
            }, folders

    return row, None, folders


def touch_share_used(share_id: int) -> None:
    with closing(get_conn()) as conn:
        conn.execute(
            "UPDATE share_links SET last_used_at=? WHERE id=?",
            (now_iso(), int(share_id)),
        )
        conn.commit()


def build_share_url(token: str, use_external_base_url: bool = False) -> str:
    base = request.host_url.rstrip("/")
    if use_external_base_url:
        external = str(get_setting("external_base_url", "")).strip().rstrip("/")
        if external:
            base = external
    return f"{base}/s/{token}"


_ensure_storage_dirs()
init_db()
migrate_thumbnail_render_style_if_needed()

app = Flask(__name__)
app.secret_key = _load_or_create_secret()

login_manager = LoginManager(app)
login_manager.login_view = "login"


@app.context_processor
def inject_template_globals():
    return {"app_build": APP_BUILD, "ui_version_marker": UI_VERSION_MARKER}


@login_manager.user_loader
def load_user(user_id: str) -> Optional[User]:
    try:
        uid = int(user_id)
    except Exception:
        return None
    return get_user_by_id(uid)


@login_manager.unauthorized_handler
def unauthorized_handler():
    if request.path.startswith("/api/"):
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    return redirect(url_for("login"))


@app.before_request
def setup_guard():
    if request.endpoint == "static":
        return None

    if users_count() == 0 and request.endpoint not in {"setup", "api_health"}:
        if request.path.startswith("/api/"):
            return jsonify({"ok": False, "error": "Konto skal oprettes først."}), 503
        return redirect(url_for("setup"))

    return None


@app.route("/api/health")
def api_health():
    return jsonify(
        {
            "ok": True,
            "service": "fjordshare",
            "users": users_count(),
            "data_dir": str(DATA_DIR),
            "upload_root": str(UPLOAD_ROOT),
            "thumbs_dir": str(THUMBS_DIR),
        }
    )


@app.get("/api/slice/status")
def api_slice_status():
    return jsonify(
        {
            "ok": True,
            "data": {
                "stats": dict(SLICER_STATS),
                "processing_ids": sorted(list(SLICER_PROCESSING_IDS)),
            }
        }
    )


@app.post("/api/files/<int:file_id>/slice/cancel")
def api_slice_cancel(file_id: int):
    _slice_cancel_mark(int(file_id))
    _slice_stats_mark_error(int(file_id))
    _set_file_slice_state(int(file_id), "error", "Stoppet af bruger", actor="system")
    return jsonify({"canceled": True, "file_id": int(file_id)})


@app.route("/setup", methods=["GET", "POST"])
def setup():
    if users_count() > 0:
        return redirect(url_for("login"))

    error = ""
    if request.method == "POST":
        username = str(request.form.get("username") or "").strip()
        password = str(request.form.get("password") or "")
        password2 = str(request.form.get("password2") or "")
        if not username or not password:
            error = "Brugernavn og adgangskode er påkrævet."
        elif password != password2:
            error = "Adgangskoderne matcher ikke."
        else:
            try:
                create_user(username, password, role="admin")
                return redirect(url_for("login", created="1"))
            except sqlite3.IntegrityError:
                error = "Brugernavnet findes allerede."
            except ValueError as exc:
                error = str(exc)
            except Exception as exc:
                error = f"Kunne ikke oprette bruger: {exc}"

    return render_template("setup.html", error=error)


@app.route("/login", methods=["GET", "POST"])
def login():
    if users_count() == 0:
        return redirect(url_for("setup"))

    if current_user.is_authenticated:
        return redirect(url_for("index"))

    error = ""
    created = str(request.args.get("created") or "") == "1"

    if request.method == "POST":
        username = str(request.form.get("username") or "").strip()
        password = str(request.form.get("password") or "")
        user = fetch_user_by_username(username)
        if user is None:
            error = "Forkert brugernavn eller kode."
        else:
            with closing(get_conn()) as conn:
                row = conn.execute(
                    "SELECT password_hash FROM users WHERE id=?",
                    (int(user.id),),
                ).fetchone()
            if row and check_password_hash(str(row["password_hash"]), password):
                try:
                    ensure_user_storage_ready(user)
                except Exception:
                    pass
                login_user(user)
                return redirect(url_for("index"))
            error = "Forkert brugernavn eller kode."

    return render_template("login.html", error=error, created=created)


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))


@app.route("/")
@login_required
def index():
    default_folder = normalize_folder_path(str(current_user.home_folder or ""))
    try:
        default_folder = ensure_user_storage_ready(current_user)
    except Exception:
        pass
    return render_template(
        "index.html",
        username=current_user.username,
        role=current_user.role,
        home_folder=default_folder,
    )


@app.route("/api/me")
@login_required
def api_me():
    return jsonify(
        {
            "ok": True,
            "user": {
                "id": int(current_user.id),
                "username": str(current_user.username),
                "role": str(current_user.role),
                "home_folder": normalize_folder_path(str(current_user.home_folder or "")),
            },
        }
    )


@app.route("/api/folders", methods=["GET"])
@login_required
def api_folders_list():
    items = list_accessible_folders(current_user)
    return jsonify({"ok": True, "items": items})


@app.route("/api/folders", methods=["POST"])
@login_required
def api_folders_create():
    body = request.get_json(silent=True) or {}
    folder_raw = body.get("folder_path")
    parent_raw = body.get("parent")
    name_raw = body.get("name")

    try:
        if folder_raw:
            folder_path = normalize_folder_path(str(folder_raw))
        else:
            parent = normalize_folder_path(str(parent_raw or ""))
            name = normalize_folder_path(str(name_raw or ""))
            if not name:
                return jsonify({"ok": False, "error": "Mappenavn mangler"}), 400
            if "/" in name:
                return jsonify({"ok": False, "error": "Brug kun mappenavn i feltet 'name'"}), 400
            folder_path = f"{parent}/{name}" if parent else name

        if not folder_path:
            return jsonify({"ok": False, "error": "Ugyldig mappe"}), 400

        parent_path = normalize_folder_path(str(Path(folder_path).parent).replace("\\", "/"))
        if parent_path == ".":
            parent_path = ""

        if not permission_allows(permission_for_user_folder(current_user, parent_path), "manage"):
            return jsonify({"ok": False, "error": "Du har ikke rettighed til at oprette mappe her"}), 403

        _, abs_folder = folder_abs_path(folder_path)
        abs_folder.mkdir(parents=True, exist_ok=True)
        ensure_folder_record(folder_path, owner_user_id=int(current_user.id))
        log_activity(
            kind="folder",
            action="create",
            message="Mappe oprettet",
            level="info",
            folder_path=folder_path,
            target=folder_path,
            actor=str(current_user.username or ""),
        )

        return jsonify({"ok": True, "folder_path": folder_path})
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Kunne ikke oprette mappe: {exc}"}), 500


@app.route("/api/files", methods=["GET"])
@login_required
def api_files_list():
    folder = normalize_folder_path(str(request.args.get("folder") or ""))

    if folder and not permission_allows(permission_for_user_folder(current_user, folder), "view"):
        return jsonify({"ok": False, "error": "Ingen adgang til mappe"}), 403

    with closing(get_conn()) as conn:
        if folder:
            rows = conn.execute(
                "SELECT * FROM files WHERE folder_path=? ORDER BY uploaded_at DESC, id DESC",
                (folder,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM files ORDER BY uploaded_at DESC, id DESC LIMIT 1000"
            ).fetchall()

    accessible_rows: list[sqlite3.Row] = []
    for row in rows:
        if user_can_access_file(current_user, row, "view"):
            accessible_rows.append(row)

    items: list[dict] = []
    for row, slice_output_row in _pair_visible_file_rows_with_slice_output(accessible_rows):
        ext = str(row["ext"] or "").lower()
        thumb_status = str(row["thumb_status"] or "none").strip().lower()
        thumb_rel = str(row["thumb_rel"] or "").strip()
        if _supports_thumbnail_for_ext(ext) and (not thumb_rel or thumb_status in {"queued", "error"}):
            try:
                enqueue_thumbnail(int(row["id"]))
            except Exception:
                pass
        items.append(serialize_file_row(row, slice_output_row=slice_output_row))

    zip_jobs = list_zip_jobs_for_folder(folder)

    return jsonify({"ok": True, "folder": folder, "items": items, "zip_jobs": zip_jobs})


@app.route("/api/files/<int:file_id>/content", methods=["GET"])
@login_required
def api_file_content(file_id: int):
    with closing(get_conn()) as conn:
        row = conn.execute("SELECT * FROM files WHERE id=?", (int(file_id),)).fetchone()

    if row is None:
        return jsonify({"ok": False, "error": "Filen findes ikke"}), 404
    if not user_can_access_file(current_user, row, "view"):
        return jsonify({"ok": False, "error": "Ingen adgang"}), 403

    try:
        path = file_disk_path(row)
    except Exception:
        return jsonify({"ok": False, "error": "Ugyldig filsti"}), 400

    if not path.exists() or not path.is_file():
        return jsonify({"ok": False, "error": "Filen findes ikke på disk"}), 404

    mimetype = guess_mime(str(row["filename"] or ""), str(row["ext"] or ""))
    return send_file(path, mimetype=mimetype, as_attachment=False)


@app.route("/api/files/<int:file_id>/download", methods=["GET"])
@login_required
def api_file_download(file_id: int):
    with closing(get_conn()) as conn:
        row = conn.execute("SELECT * FROM files WHERE id=?", (int(file_id),)).fetchone()

    if row is None:
        return jsonify({"ok": False, "error": "Filen findes ikke"}), 404
    if not user_can_access_file(current_user, row, "view"):
        return jsonify({"ok": False, "error": "Ingen adgang"}), 403

    try:
        path = file_disk_path(row)
    except Exception:
        return jsonify({"ok": False, "error": "Ugyldig filsti"}), 400

    if not path.exists() or not path.is_file():
        return jsonify({"ok": False, "error": "Filen findes ikke på disk"}), 404

    return send_file(path, as_attachment=True, download_name=str(row["filename"] or path.name))


@app.route("/api/files/<int:file_id>/thumb", methods=["GET"])
@login_required
def api_file_thumb(file_id: int):
    with closing(get_conn()) as conn:
        row = conn.execute("SELECT * FROM files WHERE id=?", (int(file_id),)).fetchone()

    if row is None:
        return jsonify({"ok": False, "error": "Filen findes ikke"}), 404
    if not user_can_access_file(current_user, row, "view"):
        return jsonify({"ok": False, "error": "Ingen adgang"}), 403

    thumb_path = file_thumb_path(row)
    if thumb_path is None or not thumb_path.exists() or not thumb_path.is_file():
        return jsonify({"ok": False, "error": "Thumbnail ikke klar endnu"}), 404

    return send_file(thumb_path, mimetype="image/png", as_attachment=False)


@app.route("/api/files/<int:file_id>/metadata", methods=["PATCH"])
@login_required
def api_file_metadata(file_id: int):
    body = request.get_json(silent=True) or {}
    note = str(body.get("note") or "").strip()
    try:
        quantity = int(body.get("quantity") or 1)
    except Exception:
        quantity = 1
    quantity = max(1, min(quantity, 1_000_000))

    with closing(get_conn()) as conn:
        row = conn.execute("SELECT * FROM files WHERE id=?", (int(file_id),)).fetchone()
        if row is None:
            return jsonify({"ok": False, "error": "Filen findes ikke"}), 404
        if not user_can_access_file(current_user, row, "upload"):
            return jsonify({"ok": False, "error": "Ingen rettighed til at opdatere metadata"}), 403

        conn.execute(
            "UPDATE files SET note=?, quantity=? WHERE id=?",
            (note, quantity, int(file_id)),
        )
        conn.commit()

    return jsonify({"ok": True})


@app.route("/api/files/metadata-batch", methods=["POST"])
@login_required
def api_file_metadata_batch():
    body = request.get_json(silent=True) or {}
    raw_items = body.get("items")
    if not isinstance(raw_items, list):
        return jsonify({"ok": False, "error": "items skal være en liste"}), 400

    updated_ids: list[int] = []
    with closing(get_conn()) as conn:
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            try:
                file_id = int(item.get("file_id") or 0)
            except Exception:
                continue
            if file_id <= 0:
                continue

            row = conn.execute("SELECT * FROM files WHERE id=?", (file_id,)).fetchone()
            if row is None:
                continue
            if not user_can_access_file(current_user, row, "upload"):
                continue

            note = str(item.get("note") or "").strip()
            try:
                quantity = int(item.get("quantity") or 1)
            except Exception:
                quantity = 1
            quantity = max(1, min(quantity, 1_000_000))

            conn.execute(
                "UPDATE files SET note=?, quantity=? WHERE id=?",
                (note, quantity, file_id),
            )
            updated_ids.append(file_id)

        conn.commit()

    return jsonify({"ok": True, "updated": len(updated_ids), "ids": updated_ids})


@app.route("/api/slice/profiles", methods=["GET"])
@login_required
def api_slice_profiles():
    if not current_user.is_admin:
        return jsonify({"ok": False, "error": "Kun admin"}), 403

    data = _read_bambustudio_profiles()
    printer_bed_map = _load_slicer_printer_bed_map()
    return jsonify(
        {
            "ok": True,
            "profiles": {
                "printers": data.get("printers", []),
                "print_profiles": data.get("print_profiles", []),
                "filament_profiles": data.get("filament_profiles", []),
                "printer_beds": data.get("printer_beds", {}),
                "printer_bed_map": printer_bed_map,
            },
            "source": str(data.get("source") or ""),
            "config_path": str(data.get("config_path") or ""),
            "profile_root": str(data.get("profile_root") or ""),
            "parse_error": str(data.get("parse_error") or ""),
        }
    )


@app.route("/api/slice/process-settings", methods=["GET"])
@login_required
def api_slice_process_settings():
    if not current_user.is_admin:
        return jsonify({"ok": False, "error": "Kun admin"}), 403

    printer_profile = str(request.args.get("printer_profile") or "").strip()[:200]
    print_profile = str(request.args.get("print_profile") or "").strip()[:200]
    filament_profile = str(request.args.get("filament_profile") or "").strip()[:200]

    try:
        executable = _resolve_bambustudio_executable()
        catalog_settings, catalog_options = _collect_process_settings_catalog(executable)
        machine_json, process_json, _filament_json = _resolve_selected_profile_jsons(
            executable,
            printer_profile,
            print_profile,
            filament_profile,
            prefer_uploaded=False,
        )
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Kunne ikke finde process-profil: {exc}"}), 500

    if not process_json:
        compact_catalog_options: dict[str, list[Any]] = {}
        for key, options in catalog_options.items():
            if key not in catalog_settings:
                continue
            if not isinstance(options, list):
                continue
            deduped = _dedupe_process_setting_scalars(options, max_items=64)
            if len(deduped) > 1:
                compact_catalog_options[key] = deduped

        return jsonify({
            "ok": True,
            "settings": catalog_settings,
            "setting_options": compact_catalog_options,
            "process_profile": "",
            "process_path": "",
            "inherits_chain": [],
            "catalog_settings_count": len(catalog_settings),
            "resolved_settings_count": 0,
        })

    settings, setting_options, inherits_chain = _resolve_effective_process_profile_settings(
        executable,
        process_json,
        machine_json=machine_json,
    )

    # Some machine-compatibility filters can resolve to a tiny variant profile
    # with only a couple of keys. If that happens, retry with explicit process
    # profile lookup without strict machine filtering.
    if len(settings) <= 2 and print_profile:
        fallback_process_json = ""
        for profile_dir in _candidate_process_profile_dirs(executable):
            candidate = _pick_profile_json(
                profile_dir,
                print_profile,
                fallback_first=False,
                machine_profile_json="",
            )
            if candidate:
                fallback_process_json = candidate
                break

        if fallback_process_json:
            try:
                same_profile = Path(fallback_process_json).resolve() == Path(process_json).resolve()
            except Exception:
                same_profile = str(fallback_process_json) == str(process_json)

            if not same_profile:
                fb_settings, fb_options, fb_chain = _resolve_effective_process_profile_settings(
                    executable,
                    fallback_process_json,
                    machine_json="",
                )
                if len(fb_settings) > len(settings):
                    process_json = fallback_process_json
                    settings = fb_settings
                    setting_options = fb_options
                    inherits_chain = fb_chain

    merged_settings: dict[str, Any] = {}
    merged_settings.update(catalog_settings)
    merged_settings.update(settings)

    merged_options_raw: dict[str, list[Any]] = {}
    for key, options in catalog_options.items():
        if not isinstance(options, list):
            continue
        merged_options_raw[key] = _dedupe_process_setting_scalars(options, max_items=64)

    for key, options in setting_options.items():
        if not isinstance(options, list):
            continue
        existing = merged_options_raw.get(key, [])
        merged_options_raw[key] = _dedupe_process_setting_scalars([*existing, *options], max_items=64)

    for key, value in merged_settings.items():
        existing = merged_options_raw.get(key, [])
        merged_options_raw[key] = _dedupe_process_setting_scalars([value, *existing], max_items=64)

    # Keep dropdown payload compact while preserving meaningful options.
    compact_options: dict[str, list[Any]] = {}
    for key, options in merged_options_raw.items():
        if key not in merged_settings:
            continue
        if not isinstance(options, list):
            continue
        deduped = _dedupe_process_setting_scalars(options, max_items=64)
        if len(deduped) > 1:
            compact_options[key] = deduped

    return jsonify(
        {
            "ok": True,
            "settings": merged_settings,
            "setting_options": compact_options,
            "process_profile": Path(process_json).stem,
            "process_path": process_json,
            "inherits_chain": inherits_chain,
            "catalog_settings_count": len(catalog_settings),
            "resolved_settings_count": len(settings),
        }
    )


@app.route("/api/slicer/plates", methods=["GET"])
@login_required
def api_slicer_plates():
    if not current_user.is_admin:
        return jsonify({"ok": False, "error": "Kun admin"}), 403

    items: list[dict[str, Any]] = []
    try:
        if SLICER_PLATE_ASSET_DIR.exists():
            for path in sorted(SLICER_PLATE_ASSET_DIR.iterdir(), key=lambda p: p.name.lower()):
                if not path.is_file():
                    continue
                name = path.name
                ext = path.suffix.lower()
                if ext not in SLICER_PLATE_ASSET_ALLOWED_EXTS:
                    continue
                rel = f"slicer-plates/{name}"
                items.append(
                    {
                        "name": name,
                        "stem": path.stem,
                        "ext": ext,
                        "size": int(path.stat().st_size),
                        "updated_at": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
                        "url": url_for("static", filename=rel),
                    }
                )
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Kunne ikke læse slicer plate assets: {exc}"}), 500

    return jsonify({"ok": True, "items": items})


@app.route("/api/files/<int:file_id>/slice", methods=["POST"])
@login_required
def api_file_slice(file_id: int):
    if not current_user.is_admin:
        return jsonify({"ok": False, "error": "Kun admin kan starte slicing"}), 403

    body = request.get_json(silent=True) or {}
    printer_profile = str(body.get("printer_profile") or "").strip()[:200]
    print_profile = str(body.get("print_profile") or "").strip()[:200]
    filament_profile = str(body.get("filament_profile") or "").strip()[:200]
    support_mode = _normalize_slice_support_mode(body.get("support_mode"))
    support_type = _normalize_slice_support_type(body.get("support_type"))
    support_style = _normalize_slice_support_style(body.get("support_style"))
    nozzle_left_diameter = _normalize_slice_nozzle_diameter(body.get("nozzle_left_diameter"))
    nozzle_right_diameter = _normalize_slice_nozzle_diameter(body.get("nozzle_right_diameter"))
    nozzle_left_flow = _normalize_slice_nozzle_flow(body.get("nozzle_left_flow"))
    nozzle_right_flow = _normalize_slice_nozzle_flow(body.get("nozzle_right_flow"))
    print_nozzle = _normalize_slice_print_nozzle(body.get("print_nozzle"))
    if support_mode == "off":
        support_type = ""
        support_style = ""
    rotation_x_degrees = _normalize_rotation_degrees(body.get("rotation_x_degrees"))
    rotation_y_degrees = _normalize_rotation_degrees(body.get("rotation_y_degrees"))
    rotation_z_degrees = _normalize_rotation_degrees(body.get("rotation_z_degrees"))
    # Lift in Z is disabled to ensure rotated models stay valid for slicing.
    lift_z_mm = 0.0
    bed_width_mm = _normalize_bed_size_mm(body.get("bed_width_mm"))
    bed_depth_mm = _normalize_bed_size_mm(body.get("bed_depth_mm"))
    process_overrides = _normalize_slice_process_overrides(body.get("process_overrides"))
    if print_nozzle:
        process_overrides = dict(process_overrides)
        process_overrides["print_extruder_id"] = 2 if print_nozzle == "right" else 1

    with closing(get_conn()) as conn:
        row = conn.execute("SELECT * FROM files WHERE id=?", (int(file_id),)).fetchone()

    if row is None:
        return jsonify({"ok": False, "error": "Filen findes ikke"}), 404
    if not user_can_access_file(current_user, row, "upload"):
        return jsonify({"ok": False, "error": "Ingen rettighed til at slice filen"}), 403

    ext = str(row["ext"] or "").lower()
    if not _supports_slicing_for_ext(ext):
        return jsonify({"ok": False, "error": "Kun STL filer kan slices"}), 400

    status_now = str(row["slice_status"] or "none").strip().lower() or "none"
    if status_now in {"queued", "processing"}:
        return jsonify({"ok": True, "queued": True, "already_running": True})

    validation_error = ""
    try:
        validation_error = _validate_selected_slice_profiles(
            _resolve_bambustudio_executable(),
            printer_profile,
            print_profile,
            filament_profile,
        )
    except Exception as exc:
        validation_error = f"Kunne ikke validere slicer-profiler: {exc}"

    if validation_error:
        return jsonify({"ok": False, "error": validation_error}), 400

    profile_details = []
    if printer_profile:
        profile_details.append(f"printer={printer_profile}")
    if print_profile:
        profile_details.append(f"print={print_profile}")
    if filament_profile:
        profile_details.append(f"filament={filament_profile}")
    if abs(rotation_x_degrees) >= 1e-6 or abs(rotation_y_degrees) >= 1e-6 or abs(rotation_z_degrees) >= 1e-6:
        profile_details.append(
            f"rotation=({rotation_x_degrees},{rotation_y_degrees},{rotation_z_degrees})deg"
        )
    profile_details.append("snap_to_plate=on")
    if support_mode != "auto" or support_type or support_style:
        support_txt = [f"support={support_mode}"]
        if support_type:
            support_txt.append(f"type={support_type}")
        if support_style:
            support_txt.append(f"style={support_style}")
        profile_details.append("/".join(support_txt))
    if nozzle_left_diameter or nozzle_right_diameter or nozzle_left_flow or nozzle_right_flow:
        nozzle_txt = [
            f"L={nozzle_left_diameter or 'auto'}/{nozzle_left_flow or 'auto'}",
            f"R={nozzle_right_diameter or 'auto'}/{nozzle_right_flow or 'auto'}",
        ]
        profile_details.append(f"nozzle({' '.join(nozzle_txt)})")
    if print_nozzle:
        profile_details.append(f"print_nozzle={print_nozzle}")
    if bed_width_mm > 0.0 and bed_depth_mm > 0.0:
        profile_details.append(f"bed={bed_width_mm}x{bed_depth_mm}mm")
    if process_overrides:
        profile_details.append(f"process_overrides={len(process_overrides)}")
    profile_txt = ", ".join(profile_details) if profile_details else "default profiler"
    log_activity(
        kind="slice",
        action="requested",
        message=f"Slice bestilt ({profile_txt})",
        level="info",
        folder_path=str(row["folder_path"] or ""),
        target=str(row["filename"] or ""),
        actor=str(current_user.username or ""),
        file_id=int(file_id),
    )

    _set_file_slice_state(int(file_id), "queued", "", actor=str(current_user.username or ""))
    enqueue_slice_job(
        int(file_id),
        str(current_user.username or ""),
        printer_profile=printer_profile,
        print_profile=print_profile,
        filament_profile=filament_profile,
        support_mode=support_mode,
        support_type=support_type,
        support_style=support_style,
        nozzle_left_diameter=nozzle_left_diameter,
        nozzle_right_diameter=nozzle_right_diameter,
        nozzle_left_flow=nozzle_left_flow,
        nozzle_right_flow=nozzle_right_flow,
        rotation_x_degrees=rotation_x_degrees,
        rotation_y_degrees=rotation_y_degrees,
        rotation_z_degrees=rotation_z_degrees,
        lift_z_mm=lift_z_mm,
        bed_width_mm=bed_width_mm,
        bed_depth_mm=bed_depth_mm,
        process_overrides=process_overrides,
    )
    return jsonify(
        {
            "ok": True,
            "queued": True,
            "profiles": {
                "printer_profile": printer_profile,
                "print_profile": print_profile,
                "filament_profile": filament_profile,
                "support_mode": support_mode,
                "support_type": support_type,
                "support_style": support_style,
                "nozzle_left_diameter": nozzle_left_diameter,
                "nozzle_right_diameter": nozzle_right_diameter,
                "nozzle_left_flow": nozzle_left_flow,
                "nozzle_right_flow": nozzle_right_flow,
                "print_nozzle": print_nozzle,
                "rotation_x_degrees": rotation_x_degrees,
                "rotation_y_degrees": rotation_y_degrees,
                "rotation_z_degrees": rotation_z_degrees,
                "lift_z_mm": lift_z_mm,
                "bed_width_mm": bed_width_mm,
                "bed_depth_mm": bed_depth_mm,
                "process_overrides": process_overrides,
            },
        }
    )


@app.route("/api/files/printed-batch", methods=["POST"])
@login_required
def api_files_printed_batch():
    if not current_user.is_admin:
        return jsonify({"ok": False, "error": "Kun admin kan markere filer som printet"}), 403

    body = request.get_json(silent=True) or {}
    raw_ids = body.get("file_ids")
    printed = bool(parse_bool(body.get("printed", True)))

    if not isinstance(raw_ids, list):
        return jsonify({"ok": False, "error": "file_ids skal være en liste"}), 400

    file_ids: list[int] = []
    seen: set[int] = set()
    for raw in raw_ids:
        try:
            fid = int(raw)
        except Exception:
            continue
        if fid <= 0 or fid in seen:
            continue
        seen.add(fid)
        file_ids.append(fid)

    if not file_ids:
        return jsonify({"ok": False, "error": "Ingen gyldige filer valgt"}), 400

    placeholders = ",".join("?" for _ in file_ids)
    now = now_iso() if printed else None
    by_user = str(current_user.username or "") if printed else None
    updated_ids: list[int] = []

    with closing(get_conn()) as conn:
        rows = conn.execute(
            f"SELECT * FROM files WHERE id IN ({placeholders})",
            tuple(file_ids),
        ).fetchall()

        for row in rows:
            if not user_can_access_file(current_user, row, "manage"):
                return jsonify({"ok": False, "error": "Ingen rettighed til en eller flere filer"}), 403
            updated_ids.append(int(row["id"]))

        if not updated_ids:
            return jsonify({"ok": False, "error": "Ingen filer fundet"}), 404

        update_placeholders = ",".join("?" for _ in updated_ids)
        conn.execute(
            f"""
            UPDATE files
            SET printed=?, printed_at=?, printed_by=?
            WHERE id IN ({update_placeholders})
            """,
            (
                1 if printed else 0,
                now,
                by_user,
                *tuple(updated_ids),
            ),
        )
        conn.commit()

    return jsonify({"ok": True, "updated": len(updated_ids), "ids": sorted(updated_ids), "printed": printed})


@app.route("/api/files/by-upload-client/<client_id>", methods=["GET"])
@login_required
def api_file_by_upload_client(client_id: str):
    key = str(client_id or "").strip()
    if not key:
        return jsonify({"ok": False, "error": "client_id mangler"}), 400

    with closing(get_conn()) as conn:
        row = conn.execute(
            "SELECT * FROM files WHERE upload_client_id=? ORDER BY id DESC LIMIT 1",
            (key,),
        ).fetchone()

    if row is None:
        return jsonify({"ok": False, "error": "Fil ikke fundet"}), 404

    if not user_can_access_file(current_user, row, "view"):
        return jsonify({"ok": False, "error": "Ingen adgang"}), 403

    return jsonify({"ok": True, "item": serialize_file_row(row)})


@app.route("/api/files/batch-delete", methods=["POST"])
@login_required
def api_files_batch_delete():
    body = request.get_json(silent=True) or {}
    raw_file_ids = body.get("file_ids")
    raw_folder_paths = body.get("folder_paths")

    file_ids: list[int] = []
    if isinstance(raw_file_ids, list):
        seen_file_ids: set[int] = set()
        for value in raw_file_ids:
            try:
                fid = int(value)
            except Exception:
                continue
            if fid <= 0 or fid in seen_file_ids:
                continue
            seen_file_ids.add(fid)
            file_ids.append(fid)

    folder_paths = _collapse_folder_prefixes(raw_folder_paths if isinstance(raw_folder_paths, list) else [])

    if not file_ids and not folder_paths:
        return jsonify({"ok": False, "error": "Ingen filer eller mapper valgt"}), 400

    for folder in folder_paths:
        if not permission_allows(permission_for_user_folder(current_user, folder), "manage"):
            return jsonify({"ok": False, "error": f"Ingen rettighed til mappe: {folder}"}), 403

    selected_rows: list[sqlite3.Row] = []
    with closing(get_conn()) as conn:
        if file_ids:
            placeholders = ",".join("?" for _ in file_ids)
            selected_rows.extend(
                conn.execute(
                    f"SELECT * FROM files WHERE id IN ({placeholders})",
                    tuple(file_ids),
                ).fetchall()
            )
        if folder_paths:
            folder_where, folder_params = _folder_clauses(folder_paths)
            selected_rows.extend(
                conn.execute(
                    f"SELECT * FROM files WHERE {folder_where}",
                    tuple(folder_params),
                ).fetchall()
            )

    rows_by_id: dict[int, sqlite3.Row] = {}
    for row in selected_rows:
        fid = int(row["id"])
        if fid in rows_by_id:
            continue
        if not user_can_access_file(current_user, row, "manage"):
            return jsonify({"ok": False, "error": "Ingen rettighed til at slette en eller flere filer"}), 403
        rows_by_id[fid] = row

    rows_to_delete = list(rows_by_id.values())
    file_ids_to_delete = sorted(rows_by_id.keys())

    removed_file_count = 0
    for row in rows_to_delete:
        try:
            path = file_disk_path(row)
            if path.exists() and path.is_file():
                path.unlink(missing_ok=True)
        except Exception:
            pass
        try:
            _safe_remove_thumbnail(str(row["thumb_rel"] or ""))
        except Exception:
            pass
        removed_file_count += 1

    removed_folder_count = 0
    for folder in folder_paths:
        try:
            _, abs_folder = folder_abs_path(folder)
            if abs_folder.exists() and abs_folder.is_dir():
                shutil.rmtree(abs_folder, ignore_errors=True)
        except Exception:
            pass
        removed_folder_count += 1

    with closing(get_conn()) as conn:
        if file_ids_to_delete:
            placeholders = ",".join("?" for _ in file_ids_to_delete)
            attachment_rows = conn.execute(
                f"SELECT rel_name FROM file_attachments WHERE file_id IN ({placeholders})",
                tuple(file_ids_to_delete),
            ).fetchall()
            for arow in attachment_rows:
                _safe_remove_attachment(str(arow["rel_name"] or ""))

            conn.execute(
                f"DELETE FROM files WHERE id IN ({placeholders})",
                tuple(file_ids_to_delete),
            )

        for folder in folder_paths:
            conn.execute(
                "DELETE FROM folders WHERE folder_path=? OR folder_path LIKE ?",
                (folder, f"{folder}/%"),
            )

        conn.commit()

    try:
        file_preview = ", ".join(str(r["filename"] or "") for r in rows_to_delete[:8] if str(r["filename"] or "").strip())
        folder_preview = ", ".join(folder_paths[:5])
        details = f"Slettede {removed_file_count} filer og {removed_folder_count} mapper."
        if file_preview:
            details += f" Filer: {file_preview}"
        if folder_preview:
            details += f" Mapper: {folder_preview}"
        log_activity(
            kind="delete",
            action="batch",
            message=details,
            level="info",
            folder_path=folder_paths[0] if folder_paths else "",
            target=f"{removed_file_count} filer / {removed_folder_count} mapper",
            actor=str(current_user.username or ""),
        )
    except Exception:
        pass

    return jsonify(
        {
            "ok": True,
            "removed_files": int(removed_file_count),
            "removed_folders": int(removed_folder_count),
        }
    )


@app.route("/api/files/<int:file_id>/attachments", methods=["GET", "POST"])
@login_required
def api_file_attachments(file_id: int):
    file_id_i = int(file_id)
    with closing(get_conn()) as conn:
        file_row = conn.execute("SELECT * FROM files WHERE id=?", (file_id_i,)).fetchone()
    if file_row is None:
        return jsonify({"ok": False, "error": "Filen findes ikke"}), 404

    if request.method == "GET":
        if not user_can_access_file(current_user, file_row, "view"):
            return jsonify({"ok": False, "error": "Ingen adgang"}), 403
        with closing(get_conn()) as conn:
            rows = conn.execute(
                """
                SELECT id, file_id, rel_name, original_name, mime_type, file_size, uploaded_by, uploaded_at
                FROM file_attachments
                WHERE file_id=?
                ORDER BY uploaded_at DESC, id DESC
                """,
                (file_id_i,),
            ).fetchall()
        items = [serialize_file_attachment_row(r) for r in rows]
        return jsonify({"ok": True, "items": items})

    if not user_can_access_file(current_user, file_row, "upload"):
        return jsonify({"ok": False, "error": "Ingen rettighed til at uploade billeder"}), 403

    uploads = request.files.getlist("images")
    if not uploads:
        uploads = [v for v in request.files.values() if v is not None]

    valid_uploads = [u for u in uploads if u and str(getattr(u, "filename", "") or "").strip()]
    if not valid_uploads:
        return jsonify({"ok": False, "error": "Ingen billeder modtaget"}), 400

    created_items: list[dict] = []
    skipped: list[str] = []
    with closing(get_conn()) as conn:
        for upload in valid_uploads:
            original_name = sanitize_filename(str(upload.filename or "billede"))
            mime_type = str(getattr(upload, "mimetype", "") or "").strip().lower()
            is_heic = _attachment_is_heic_upload(original_name, mime_type)
            if not mime_type.startswith("image/") and not is_heic:
                skipped.append(f"{original_name}: ikke et billede")
                continue

            ext = ".jpg" if is_heic else _attachment_ext_from_upload(original_name, mime_type)
            if not ext:
                skipped.append(f"{original_name}: filtype ikke understøttet")
                continue

            stored_name = original_name
            stored_mime_type = mime_type
            if is_heic:
                if not HEIC_CONVERSION_AVAILABLE:
                    skipped.append(f"{original_name}: HEIC-konvertering ikke tilgængelig på serveren")
                    continue
                stored_name = sanitize_filename(f"{Path(original_name).stem}.jpg")
                stored_mime_type = "image/jpeg"

            size_guess = _attachment_size_from_filestorage(upload)
            if size_guess > FILE_ATTACHMENT_MAX_BYTES:
                skipped.append(f"{original_name}: for stor fil")
                continue

            rel_name = f"{file_id_i}/{secrets.token_hex(16)}{ext}"
            try:
                abs_path = _attachment_abs_path_from_rel(rel_name)
            except Exception:
                skipped.append(f"{original_name}: ugyldig filsti")
                continue
            abs_path.parent.mkdir(parents=True, exist_ok=True)

            try:
                upload.stream.seek(0)
            except Exception:
                pass

            if is_heic:
                if not _attachment_save_heic_as_jpg(upload, abs_path):
                    skipped.append(f"{original_name}: kunne ikke konverteres fra HEIC")
                    try:
                        abs_path.unlink(missing_ok=True)
                    except Exception:
                        pass
                    continue
            else:
                upload.save(abs_path)

            try:
                file_size = int(abs_path.stat().st_size)
            except Exception:
                file_size = max(0, size_guess)

            if file_size > FILE_ATTACHMENT_MAX_BYTES:
                try:
                    abs_path.unlink(missing_ok=True)
                except Exception:
                    pass
                skipped.append(f"{original_name}: for stor fil")
                continue

            uploaded_at = now_iso()
            uploaded_by = str(current_user.username or "")
            cur = conn.execute(
                """
                INSERT INTO file_attachments(file_id, rel_name, original_name, mime_type, file_size, uploaded_by, uploaded_at)
                VALUES(?,?,?,?,?,?,?)
                """,
                (file_id_i, rel_name, stored_name, stored_mime_type, file_size, uploaded_by, uploaded_at),
            )
            row = conn.execute(
                """
                SELECT id, file_id, rel_name, original_name, mime_type, file_size, uploaded_by, uploaded_at
                FROM file_attachments WHERE id=?
                """,
                (int(cur.lastrowid),),
            ).fetchone()
            if row is not None:
                created_items.append(serialize_file_attachment_row(row))
        conn.commit()

    if not created_items:
        err = skipped[0] if skipped else "Ingen billeder blev uploadet"
        return jsonify({"ok": False, "error": err, "skipped": skipped}), 400

    return jsonify(
        {
            "ok": True,
            "created": len(created_items),
            "items": created_items,
            "skipped": skipped,
        }
    )


@app.route("/api/files/<int:file_id>/attachments/<int:attachment_id>/content", methods=["GET"])
@login_required
def api_file_attachment_content(file_id: int, attachment_id: int):
    file_id_i = int(file_id)
    attachment_id_i = int(attachment_id)
    with closing(get_conn()) as conn:
        file_row = conn.execute("SELECT * FROM files WHERE id=?", (file_id_i,)).fetchone()
        if file_row is None:
            return jsonify({"ok": False, "error": "Filen findes ikke"}), 404
        if not user_can_access_file(current_user, file_row, "view"):
            return jsonify({"ok": False, "error": "Ingen adgang"}), 403

        row = conn.execute(
            """
            SELECT id, file_id, rel_name, original_name, mime_type, file_size, uploaded_by, uploaded_at
            FROM file_attachments
            WHERE id=? AND file_id=?
            """,
            (attachment_id_i, file_id_i),
        ).fetchone()

    if row is None:
        return jsonify({"ok": False, "error": "Billedet findes ikke"}), 404

    rel_name = str(row["rel_name"] or "").strip()
    if not rel_name:
        return jsonify({"ok": False, "error": "Billedet mangler sti"}), 404
    try:
        path = _attachment_abs_path_from_rel(rel_name)
    except Exception:
        return jsonify({"ok": False, "error": "Ugyldig billedsti"}), 400
    if not path.exists() or not path.is_file():
        return jsonify({"ok": False, "error": "Billedet findes ikke på disk"}), 404

    as_download = parse_bool(request.args.get("download"))
    return send_file(
        path,
        mimetype=str(row["mime_type"] or "image/jpeg"),
        as_attachment=as_download,
        download_name=str(row["original_name"] or path.name),
    )


@app.route("/api/settings/dns", methods=["GET", "POST"])
@login_required
def api_settings_dns():
    if request.method == "GET":
        value = get_setting("external_base_url", "")
        return jsonify({"ok": True, "external_base_url": value})

    if not current_user.is_admin:
        return jsonify({"ok": False, "error": "Kun admin kan ændre DNS indstillinger"}), 403

    body = request.get_json(silent=True) or {}
    raw_value = str(body.get("external_base_url") or "").strip()
    if raw_value and not (
        raw_value.startswith("http://") or raw_value.startswith("https://")
    ):
        return jsonify({"ok": False, "error": "URL skal starte med http:// eller https://"}), 400
    value = raw_value.rstrip("/")
    set_setting("external_base_url", value)
    return jsonify({"ok": True, "external_base_url": value})


@app.route("/api/settings/dns/effective", methods=["GET"])
@login_required
def api_settings_dns_effective():
    value = str(get_setting("external_base_url", "")).strip().rstrip("/")
    return jsonify(
        {
            "ok": True,
            "external_base_url": value,
            "configured": bool(value),
        }
    )


@app.route("/api/settings/slicer-profiles", methods=["GET", "POST", "DELETE"])
@login_required
def api_settings_slicer_profiles():
    if not current_user.is_admin:
        return jsonify({"ok": False, "error": "Kun admin"}), 403

    dirs = _slicer_profile_dirs()

    def _payload(extra: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        profiles_data = _read_bambustudio_profiles()
        printer_bed_map = _load_slicer_printer_bed_map()
        printer_bed_hidden = _load_slicer_printer_bed_hidden()
        effective_profile_root = str(BAMBUSTUDIO_PROFILE_ROOT or "").strip()
        if not effective_profile_root:
            has_uploaded_profiles = bool(
                _list_slicer_profile_files(SLICER_PROFILE_PRINTER_DIR, _slicer_profile_allowed_exts("machine"))
                or _list_slicer_profile_files(SLICER_PROFILE_PRINT_SETTINGS_DIR, _slicer_profile_allowed_exts("process"))
                or _list_slicer_profile_files(SLICER_PROFILE_FILAMENT_DIR, _slicer_profile_allowed_exts("filament"))
            )
            if has_uploaded_profiles:
                effective_profile_root = str(SLICER_PROFILE_DIR)

        data: dict[str, Any] = {
            "ok": True,
            "items": {
                kind: _slicer_profile_meta(profile_dir, _slicer_profile_allowed_exts(kind))
                for kind, profile_dir in dirs.items()
            },
            "effective": {
                "config_path": _effective_bambustudio_config_path(),
                "load_settings": _effective_bambustudio_load_settings(),
                "load_filaments": _effective_bambustudio_load_filaments(),
                "profile_root": effective_profile_root,
            },
            "profiles": {
                "printers": profiles_data.get("printers", []),
                "printer_beds": profiles_data.get("printer_beds", {}),
            },
            "printer_bed_map": printer_bed_map,
            "printer_bed_hidden": printer_bed_hidden,
            "max_bytes": int(SLICER_PROFILE_MAX_BYTES),
        }
        if extra:
            data.update(extra)
        return data

    if request.method == "GET":
        return jsonify(_payload())

    if request.method == "DELETE":
        kind = str(request.args.get("kind") or "").strip().lower()
        if kind not in dirs:
            return jsonify({"ok": False, "error": "Ugyldig profiltype"}), 400

        target_dir = dirs[kind]
        allowed_exts = _slicer_profile_allowed_exts(kind)
        requested_name = str(request.args.get("filename") or "").strip()
        deleted_count = 0
        deleted_files: list[str] = []
        delete_mode = "all"

        try:
            if requested_name:
                delete_mode = "single"
                safe_name = sanitize_filename(requested_name)
                basename = Path(requested_name).name
                if not safe_name or safe_name != requested_name or basename != requested_name:
                    return jsonify({"ok": False, "error": "Ugyldigt filnavn"}), 400

                ext = Path(safe_name).suffix.lower()
                if allowed_exts and ext not in allowed_exts:
                    return jsonify({"ok": False, "error": "Filtype er ikke tilladt for denne profiltype"}), 400

                target_root = target_dir.resolve()
                target_file = (target_root / safe_name).resolve()
                if target_file.parent != target_root:
                    return jsonify({"ok": False, "error": "Ugyldig filsti"}), 400

                if target_file.exists() and target_file.is_file():
                    target_file.unlink(missing_ok=True)
                    deleted_count = 1
                    deleted_files.append(safe_name)
            else:
                for file_path in _list_slicer_profile_files(target_dir, allowed_exts):
                    file_path.unlink(missing_ok=True)
                    deleted_count += 1
                    if len(deleted_files) < 25:
                        deleted_files.append(file_path.name)
        except Exception as exc:
            return jsonify({"ok": False, "error": f"Kunne ikke slette profilfiler: {exc}"}), 500

        if deleted_count > 0:
            log_activity(
                kind="slice",
                action="config-delete",
                message=(
                    f"Slicer profil slettet ({kind}, {deleted_files[0]})"
                    if delete_mode == "single"
                    else f"Slicer profiler slettet ({kind}, {deleted_count} filer)"
                ),
                level="info",
                target=kind,
                actor=str(current_user.username or ""),
            )

        return jsonify(
            _payload(
                {
                    "deleted": deleted_count > 0,
                    "deleted_count": deleted_count,
                    "deleted_files": deleted_files,
                    "kind": kind,
                    "delete_mode": delete_mode,
                    "filename": requested_name,
                }
            )
        )

    json_body = request.get_json(silent=True) or {}
    if isinstance(json_body, dict) and (("printer_bed_map" in json_body) or ("printer_bed_hidden" in json_body)):
        try:
            if "printer_bed_map" in json_body:
                normalized_map = _save_slicer_printer_bed_map(json_body.get("printer_bed_map", {}))
            else:
                normalized_map = _load_slicer_printer_bed_map()
            if "printer_bed_hidden" in json_body:
                normalized_hidden = _save_slicer_printer_bed_hidden(json_body.get("printer_bed_hidden", []))
            else:
                normalized_hidden = _load_slicer_printer_bed_hidden()
        except Exception as exc:
            return jsonify({"ok": False, "error": f"Kunne ikke gemme printer-plade mapping: {exc}"}), 500

        log_activity(
            kind="slice",
            action="config-update",
            message=f"Printer-plade mapping opdateret ({len(normalized_map)} profiler, skjult {len(normalized_hidden)})",
            level="info",
            actor=str(current_user.username or ""),
        )
        return jsonify(
            _payload(
                {
                    "updated_printer_bed_map": True,
                    "mapping_count": len(normalized_map),
                    "hidden_count": len(normalized_hidden),
                }
            )
        )

    kind = str(request.form.get("kind") or "").strip().lower()
    if kind not in dirs:
        return jsonify({"ok": False, "error": "Ugyldig profiltype"}), 400

    uploads = [
        upload
        for upload in request.files.getlist("file")
        if str(getattr(upload, "filename", "") or "").strip()
    ]
    if not uploads:
        single_upload = request.files.get("file")
        if single_upload is not None and str(getattr(single_upload, "filename", "") or "").strip():
            uploads = [single_upload]

    if not uploads:
        return jsonify({"ok": False, "error": "Vælg en fil først"}), 400

    allowed_exts = _slicer_profile_allowed_exts(kind)
    validated: list[tuple[Any, str, str, Optional[bytes]]] = []
    used_target_names: set[str] = set()

    for upload in uploads:
        original_name = sanitize_filename(str(upload.filename or "profil"))
        if not original_name:
            return jsonify({"ok": False, "error": "Ugyldigt filnavn"}), 400

        ext = Path(original_name).suffix.lower()
        if allowed_exts and ext not in allowed_exts:
            if kind in {"machine", "process", "filament"}:
                return jsonify({"ok": False, "error": "Denne profiltype skal uploades som JSON"}), 400
            return jsonify({"ok": False, "error": "Config-fil skal være .ini/.cfg/.conf/.txt"}), 400

        size_guess = _attachment_size_from_filestorage(upload)
        if size_guess > SLICER_PROFILE_MAX_BYTES:
            return jsonify({"ok": False, "error": f"Filen '{original_name}' er for stor (maks {SLICER_PROFILE_MAX_BYTES} bytes)"}), 400

        target_name = original_name
        normalized_bytes: Optional[bytes] = None
        if kind in {"machine", "process", "filament"}:
            payload = _read_upload_json_payload(upload)
            if payload is None:
                return jsonify({"ok": False, "error": f"Ugyldig JSON profil: {original_name}"}), 400

            extracted_name = _extract_slicer_profile_name_from_payload(payload, kind)
            parsed_name = _json_profile_filename_from_payload_name(extracted_name)
            if parsed_name:
                target_name = parsed_name

            normalized_bytes = _normalize_uploaded_profile_json_bytes(payload, kind)
            if len(normalized_bytes) > SLICER_PROFILE_MAX_BYTES:
                return jsonify({"ok": False, "error": f"Filen '{original_name}' er for stor (maks {SLICER_PROFILE_MAX_BYTES} bytes)"}), 400

        target_name = _dedupe_filename_for_request(target_name, used_target_names)
        validated.append((upload, original_name, target_name, normalized_bytes))

    target_dir = dirs[kind]
    target_dir.mkdir(parents=True, exist_ok=True)
    saved_names: list[str] = []

    for upload, original_name, target_name, normalized_bytes in validated:
        target = target_dir / target_name
        temp_target = target.with_suffix(f"{target.suffix}.tmp")

        try:
            if normalized_bytes is not None:
                with temp_target.open("wb") as fh:
                    fh.write(normalized_bytes)
            else:
                upload.save(temp_target)
            file_size = max(0, int(temp_target.stat().st_size)) if temp_target.exists() else 0
            if file_size <= 0:
                try:
                    temp_target.unlink(missing_ok=True)
                except Exception:
                    pass
                return jsonify({"ok": False, "error": f"Uploadet fil er tom: {original_name}"}), 400
            if file_size > SLICER_PROFILE_MAX_BYTES:
                try:
                    temp_target.unlink(missing_ok=True)
                except Exception:
                    pass
                return jsonify({"ok": False, "error": f"Filen '{original_name}' er for stor (maks {SLICER_PROFILE_MAX_BYTES} bytes)"}), 400
            temp_target.replace(target)
            saved_names.append(target_name)
        except Exception as exc:
            try:
                temp_target.unlink(missing_ok=True)
            except Exception:
                pass
            return jsonify({"ok": False, "error": f"Kunne ikke gemme profil '{original_name}': {exc}"}), 500

    log_activity(
        kind="slice",
        action="config-upload",
        message=f"Slicer profiler uploadet ({kind}, {len(saved_names)} filer)",
        level="info",
        target=kind,
        actor=str(current_user.username or ""),
    )

    return jsonify(
        _payload(
            {
                "uploaded": True,
                "uploaded_count": len(saved_names),
                "uploaded_files": saved_names[:25],
                "kind": kind,
            }
        )
    )


@app.route("/api/admin/users", methods=["GET", "POST"])
@login_required
def api_admin_users():
    if not current_user.is_admin:
        return jsonify({"ok": False, "error": "Kun admin"}), 403

    if request.method == "GET":
        with closing(get_conn()) as conn:
            rows = conn.execute(
                "SELECT id, username, role, home_folder, created_at FROM users ORDER BY id"
            ).fetchall()
        return jsonify(
            {
                "ok": True,
                "items": [
                    {
                        "id": int(r["id"]),
                        "username": str(r["username"]),
                        "role": str(r["role"] or "user"),
                        "home_folder": str(r["home_folder"] or ""),
                        "created_at": str(r["created_at"] or ""),
                    }
                    for r in rows
                ],
            }
        )

    body = request.get_json(silent=True) or {}
    username = str(body.get("username") or "").strip()
    password = str(body.get("password") or "")
    role = str(body.get("role") or "user").strip().lower()

    try:
        user_id = create_user(username, password, role)
        user = get_user_by_id(user_id)
        return jsonify(
            {
                "ok": True,
                "item": {
                    "id": int(user_id),
                    "username": str(user.username if user else username),
                    "role": str(user.role if user else role),
                    "home_folder": str(user.home_folder if user else ""),
                },
            }
        )
    except sqlite3.IntegrityError:
        return jsonify({"ok": False, "error": "Brugernavn findes allerede"}), 409
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Kunne ikke oprette bruger: {exc}"}), 500


@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
@login_required
def api_admin_users_delete(user_id: int):
    if not current_user.is_admin:
        return jsonify({"ok": False, "error": "Kun admin"}), 403
    if int(user_id) == int(current_user.id):
        return jsonify({"ok": False, "error": "Du kan ikke slette dig selv"}), 400

    with closing(get_conn()) as conn:
        row = conn.execute("SELECT id FROM users WHERE id=?", (int(user_id),)).fetchone()
        if row is None:
            return jsonify({"ok": False, "error": "Bruger findes ikke"}), 404

        conn.execute("DELETE FROM user_folder_access WHERE user_id=?", (int(user_id),))
        conn.execute("DELETE FROM users WHERE id=?", (int(user_id),))
        conn.commit()

    return jsonify({"ok": True})


@app.route("/api/admin/logs", methods=["GET", "DELETE"])
@login_required
def api_admin_logs():
    if not current_user.is_admin:
        return jsonify({"ok": False, "error": "Kun admin"}), 403

    if request.method == "DELETE":
        with closing(get_conn()) as conn:
            row = conn.execute("SELECT COUNT(*) AS c FROM activity_logs").fetchone()
            deleted = int(row["c"] or 0) if row else 0
            conn.execute("DELETE FROM activity_logs")
            conn.commit()
        return jsonify({"ok": True, "deleted": deleted})

    try:
        limit = int(str(request.args.get("limit") or str(ACTIVITY_LOG_LIMIT_DEFAULT)))
    except Exception:
        limit = ACTIVITY_LOG_LIMIT_DEFAULT
    limit = max(20, min(limit, ACTIVITY_LOG_LIMIT_MAX))

    with closing(get_conn()) as conn:
        rows = conn.execute(
            """
            SELECT id, level, kind, action, target, folder_path, message, actor, file_id, job_id, created_at
            FROM activity_logs
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    items: list[dict] = []
    for row in rows:
        level = str(row["level"] or "info").strip().lower() or "info"
        kind = str(row["kind"] or "system").strip().lower() or "system"
        action = str(row["action"] or "event").strip().lower() or "event"
        items.append(
            {
                "id": int(row["id"]),
                "level": level,
                "level_label": level.upper(),
                "kind": kind,
                "kind_label": ACTIVITY_KIND_LABELS.get(kind, kind.capitalize()),
                "action": action,
                "action_label": action.replace("-", " "),
                "timestamp": str(row["created_at"] or ""),
                "folder_path": str(row["folder_path"] or ""),
                "target": str(row["target"] or ""),
                "message": str(row["message"] or ""),
                "actor": str(row["actor"] or ""),
                "file_id": int(row["file_id"] or 0),
                "job_id": int(row["job_id"] or 0),
            }
        )

    return jsonify({"ok": True, "items": items, "count": len(items)})


@app.route("/api/shares", methods=["GET", "POST"])
@login_required
def api_shares():
    if request.method == "GET":
        with closing(get_conn()) as conn:
            if current_user.is_admin:
                rows = conn.execute(
                    """
                    SELECT s.*, u.username AS created_by_username
                    FROM share_links s
                    LEFT JOIN users u ON u.id = s.created_by_user_id
                    ORDER BY s.id DESC
                    """
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT s.*, u.username AS created_by_username
                    FROM share_links s
                    LEFT JOIN users u ON u.id = s.created_by_user_id
                    WHERE s.created_by_user_id=?
                    ORDER BY s.id DESC
                    """,
                    (int(current_user.id),),
                ).fetchall()

            items: list[dict] = []
            for row in rows:
                share_id = int(row["id"])
                folder_paths = get_share_folders(conn, share_id, str(row["folder_path"] or ""))
                token_plain = str(row["token_plain"] or "")
                link = build_share_url(token_plain, bool(int(row["use_external_base_url"] or 0))) if token_plain else ""
                items.append(
                    {
                        "id": share_id,
                        "share_name": str(row["share_name"] or ""),
                        "permission": str(row["permission"] or "view"),
                        "folder_path": str(row["folder_path"] or ""),
                        "folder_paths": folder_paths,
                        "expires_at": str(row["expires_at"] or ""),
                        "revoked": bool(int(row["revoked"] or 0)),
                        "use_external_base_url": bool(int(row["use_external_base_url"] or 0)),
                        "require_visitor_name": bool(int(row["require_visitor_name"] or 0)),
                        "password_enabled": bool(str(row["password_hash"] or "").strip()),
                        "created_by_user_id": int(row["created_by_user_id"] or 0),
                        "created_by_username": str(row["created_by_username"] or ""),
                        "created_at": str(row["created_at"] or ""),
                        "last_used_at": str(row["last_used_at"] or ""),
                        "link": link,
                    }
                )

        return jsonify({"ok": True, "items": items})

    body = request.get_json(silent=True) or {}
    raw_folders = body.get("folder_paths")
    folder_paths_raw: list[str]
    if isinstance(raw_folders, list):
        folder_paths_raw = [str(v or "") for v in raw_folders]
    else:
        folder_paths_raw = [str(body.get("folder_path") or "")]

    folder_paths: list[str] = []
    for raw in folder_paths_raw:
        try:
            folder = normalize_folder_path(raw)
        except ValueError:
            continue
        if not folder:
            continue
        if folder not in folder_paths:
            folder_paths.append(folder)

    if not folder_paths:
        return jsonify({"ok": False, "error": "Vælg mindst en mappe"}), 400

    for folder in folder_paths:
        if not permission_allows(permission_for_user_folder(current_user, folder), "manage"):
            return jsonify({"ok": False, "error": f"Ingen delingsrettighed til mappe: {folder}"}), 403
        _, abs_folder = folder_abs_path(folder)
        if not abs_folder.exists() or not abs_folder.is_dir():
            return jsonify({"ok": False, "error": f"Mappe findes ikke: {folder}"}), 404

    permission = str(body.get("permission") or "view").strip().lower()
    if permission not in {"view", "upload", "manage"}:
        permission = "view"

    share_name = str(body.get("share_name") or "").strip()
    if not share_name:
        share_name = folder_paths[0] if len(folder_paths) == 1 else f"{len(folder_paths)} mapper"
    if len(share_name) > 120:
        share_name = share_name[:120]

    expires_at = expiry_from_payload(body)
    use_external_base_url = 1 if parse_bool(body.get("use_external_base_url")) else 0

    password_raw = str(body.get("password") or "")
    password_hash = ""
    if password_raw:
        if len(password_raw) < 4:
            return jsonify({"ok": False, "error": "Password skal være mindst 4 tegn"}), 400
        password_hash = generate_password_hash(password_raw)

    require_visitor_name = 1 if parse_bool(body.get("require_visitor_name")) else 0

    token_plain = secrets.token_urlsafe(18)
    token_hash = token_digest(token_plain)

    with closing(get_conn()) as conn:
        cur = conn.execute(
            """
            INSERT INTO share_links(
                token_hash, token_plain, share_name, folder_path,
                permission, expires_at, revoked, use_external_base_url,
                password_hash, require_visitor_name, created_by_user_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
            """,
            (
                token_hash,
                token_plain,
                share_name,
                folder_paths[0],
                permission,
                expires_at,
                int(use_external_base_url),
                password_hash or None,
                int(require_visitor_name),
                int(current_user.id),
                now_iso(),
            ),
        )
        share_id = int(cur.lastrowid)
        for folder in folder_paths:
            conn.execute(
                "INSERT OR IGNORE INTO share_link_folders(share_id, folder_path, created_at) VALUES(?,?,?)",
                (share_id, folder, now_iso()),
            )
        conn.commit()

    link = build_share_url(token_plain, bool(use_external_base_url))

    return jsonify(
        {
            "ok": True,
            "id": share_id,
            "share_name": share_name,
            "permission": permission,
            "folder_paths": folder_paths,
            "expires_at": expires_at,
            "link": link,
            "token": token_plain,
        }
    )


@app.route("/api/shares/<int:share_id>/revoke", methods=["POST"])
@login_required
def api_share_revoke(share_id: int):
    with closing(get_conn()) as conn:
        row = conn.execute(
            "SELECT id, created_by_user_id FROM share_links WHERE id=?",
            (int(share_id),),
        ).fetchone()
        if row is None:
            return jsonify({"ok": False, "error": "Share findes ikke"}), 404
        if not current_user.is_admin and int(row["created_by_user_id"] or 0) != int(current_user.id):
            return jsonify({"ok": False, "error": "Ingen adgang"}), 403

        conn.execute("UPDATE share_links SET revoked=1 WHERE id=?", (int(share_id),))
        conn.commit()

    return jsonify({"ok": True})


@app.route("/api/shares/<int:share_id>", methods=["DELETE"])
@login_required
def api_share_delete(share_id: int):
    with closing(get_conn()) as conn:
        row = conn.execute(
            "SELECT id, created_by_user_id FROM share_links WHERE id=?",
            (int(share_id),),
        ).fetchone()
        if row is None:
            return jsonify({"ok": False, "error": "Share findes ikke"}), 404
        if not current_user.is_admin and int(row["created_by_user_id"] or 0) != int(current_user.id):
            return jsonify({"ok": False, "error": "Ingen adgang"}), 403

        conn.execute("DELETE FROM share_link_folders WHERE share_id=?", (int(share_id),))
        conn.execute("DELETE FROM share_links WHERE id=?", (int(share_id),))
        conn.commit()

    return jsonify({"ok": True})


@app.route("/s/<token>", methods=["GET"])
def shared_page(token: str):
    return render_template("shared_folder.html", token=token)


@app.route("/api/share/<token>/auth", methods=["POST"])
def api_share_auth(token: str):
    row = resolve_share(token)
    if row is None:
        return jsonify({"ok": False, "error": "Share-link er ugyldigt"}), 404

    if int(row["revoked"] or 0) or share_is_expired(row["expires_at"]):
        return jsonify({"ok": False, "error": "Share-link er ikke aktivt"}), 403

    body = request.get_json(silent=True) or {}
    password = str(body.get("password") or "")
    visitor_name = str(body.get("visitor_name") or "").strip()
    require_visitor_name = bool(int(row["require_visitor_name"] or 0))

    stored_hash = str(row["password_hash"] or "")
    if stored_hash:
        if not password or not check_password_hash(stored_hash, password):
            return jsonify({"ok": False, "error": "Forkert password"}), 401

    if require_visitor_name and len(visitor_name) < 2:
        return jsonify({"ok": False, "error": "Besøgernavn er påkrævet"}), 400

    share_id = int(row["id"])
    session[share_session_key(share_id)] = True
    if visitor_name:
        session[share_visitor_key(share_id)] = visitor_name

    return jsonify({"ok": True})


@app.route("/api/share/<token>/info", methods=["GET"])
def api_share_info(token: str):
    row, err, folders = share_access(token, required="view")
    if err is not None:
        status = 401 if err.get("requires_auth") else 403
        return jsonify(err), status

    share_id = int(row["id"])
    permission = str(row["permission"] or "view")
    touch_share_used(share_id)

    return jsonify(
        {
            "ok": True,
            "share": {
                "id": share_id,
                "share_name": str(row["share_name"] or ""),
                "permission": permission,
                "can_upload": permission_allows(permission, "upload"),
                "can_delete": permission_allows(permission, "manage"),
                "folder_paths": folders,
                "require_visitor_name": bool(int(row["require_visitor_name"] or 0)),
                "expires_at": str(row["expires_at"] or ""),
            },
        }
    )


@app.route("/api/share/<token>/files", methods=["GET"])
def api_share_files(token: str):
    row, err, folders = share_access(token, required="view")
    if err is not None:
        status = 401 if err.get("requires_auth") else 403
        return jsonify(err), status

    if not folders:
        return jsonify({"ok": True, "items": []})

    where_sql, params = _folder_clauses(folders)
    query = f"SELECT * FROM files WHERE {where_sql} ORDER BY uploaded_at DESC, id DESC"
    with closing(get_conn()) as conn:
        rows = conn.execute(query, params).fetchall()

    touch_share_used(int(row["id"]))

    paired_rows = _pair_visible_file_rows_with_slice_output(rows)
    items = [serialize_file_row(r, share_token=token, slice_output_row=slice_output_row) for r, slice_output_row in paired_rows]
    return jsonify({"ok": True, "items": items})


def _share_file_row(token: str, file_id: int, needed: str) -> Tuple[Optional[sqlite3.Row], Optional[dict], Optional[sqlite3.Row], list[str]]:
    share_row, err, folders = share_access(token, required=needed)
    if err is not None:
        return None, err, None, folders

    with closing(get_conn()) as conn:
        file_row = conn.execute(
            "SELECT * FROM files WHERE id=?",
            (int(file_id),),
        ).fetchone()

    if file_row is None:
        return None, {"ok": False, "error": "Filen findes ikke"}, share_row, folders

    file_folder = normalize_folder_path(str(file_row["folder_path"] or ""))
    if not share_folder_allowed(file_folder, folders):
        return None, {"ok": False, "error": "Filen tilhører ikke denne deling"}, share_row, folders

    return file_row, None, share_row, folders


@app.route("/api/share/<token>/file/<int:file_id>/content", methods=["GET"])
def api_share_file_content(token: str, file_id: int):
    file_row, err, share_row, _ = _share_file_row(token, file_id, "view")
    if err is not None:
        status = 401 if err.get("requires_auth") else 403
        return jsonify(err), status

    try:
        path = file_disk_path(file_row)
    except Exception:
        return jsonify({"ok": False, "error": "Ugyldig filsti"}), 400

    if not path.exists() or not path.is_file():
        return jsonify({"ok": False, "error": "Filen findes ikke på disk"}), 404

    touch_share_used(int(share_row["id"]))
    mimetype = guess_mime(str(file_row["filename"] or ""), str(file_row["ext"] or ""))
    return send_file(path, mimetype=mimetype, as_attachment=False)


@app.route("/api/share/<token>/file/<int:file_id>/download", methods=["GET"])
def api_share_file_download(token: str, file_id: int):
    file_row, err, share_row, _ = _share_file_row(token, file_id, "view")
    if err is not None:
        status = 401 if err.get("requires_auth") else 403
        return jsonify(err), status

    try:
        path = file_disk_path(file_row)
    except Exception:
        return jsonify({"ok": False, "error": "Ugyldig filsti"}), 400

    if not path.exists() or not path.is_file():
        return jsonify({"ok": False, "error": "Filen findes ikke på disk"}), 404

    touch_share_used(int(share_row["id"]))
    return send_file(path, as_attachment=True, download_name=str(file_row["filename"] or path.name))


@app.route("/api/share/<token>/file/<int:file_id>/thumb", methods=["GET"])
def api_share_file_thumb(token: str, file_id: int):
    file_row, err, share_row, _ = _share_file_row(token, file_id, "view")
    if err is not None:
        status = 401 if err.get("requires_auth") else 403
        return jsonify(err), status

    thumb_path = file_thumb_path(file_row)
    if thumb_path is None or not thumb_path.exists() or not thumb_path.is_file():
        return jsonify({"ok": False, "error": "Thumbnail ikke klar endnu"}), 404

    touch_share_used(int(share_row["id"]))
    return send_file(thumb_path, mimetype="image/png", as_attachment=False)


@app.route("/api/share/<token>/file/<int:file_id>", methods=["DELETE"])
def api_share_file_delete(token: str, file_id: int):
    file_row, err, share_row, _ = _share_file_row(token, file_id, "manage")
    if err is not None:
        status = 401 if err.get("requires_auth") else 403
        return jsonify(err), status

    try:
        path = file_disk_path(file_row)
        if path.exists() and path.is_file():
            path.unlink(missing_ok=True)
    except Exception:
        pass
    try:
        _safe_remove_thumbnail(str(file_row["thumb_rel"] or ""))
    except Exception:
        pass
    try:
        _cleanup_file_attachments_for_file(int(file_row["id"]))
    except Exception:
        pass

    with closing(get_conn()) as conn:
        conn.execute("DELETE FROM files WHERE id=?", (int(file_id),))
        conn.commit()

    touch_share_used(int(share_row["id"]))
    try:
        log_activity(
            kind="delete",
            action="share-file",
            message="Fil slettet via delingslink",
            level="info",
            folder_path=str(file_row["folder_path"] or ""),
            target=str(file_row["filename"] or f"file-{int(file_id)}"),
            actor="share-link",
            file_id=int(file_id),
        )
    except Exception:
        pass
    return jsonify({"ok": True})


def _tus_options_response() -> Any:
    resp = make_response("", 204)
    for key, value in tus_headers().items():
        resp.headers[key] = value
    resp.headers["Access-Control-Allow-Methods"] = "OPTIONS, POST, HEAD, PATCH"
    resp.headers[
        "Access-Control-Allow-Headers"
    ] = "Tus-Resumable, Upload-Length, Upload-Offset, Upload-Metadata, Content-Type, X-HTTP-Method-Override"
    resp.headers["Cache-Control"] = "no-store"
    return resp


def _finalize_tus_upload(upload_id: str, meta: Dict[str, Any], data_path: Path) -> Tuple[bool, Optional[sqlite3.Row], str]:
    folder = normalize_folder_path(str(meta.get("folder") or ""))
    filename = str(meta.get("filename") or "")
    uploaded_by = str(meta.get("uploaded_by") or "")
    upload_client_id = str(meta.get("upload_client_id") or "").strip() or None
    try:
        last_modified_ms = int(meta.get("last_modified_ms") or 0)
    except Exception:
        last_modified_ms = 0

    try:
        ext = str(Path(filename).suffix or "").lower()
        if ext == ".zip":
            owner_user_id: Optional[int] = None
            share_id: Optional[int] = None
            try:
                owner_user_id = int(meta.get("owner_user_id") or 0) or None
            except Exception:
                owner_user_id = None
            try:
                share_id = int(meta.get("share_id") or 0) or None
            except Exception:
                share_id = None

            job_id = _create_zip_job(
                folder_path=folder,
                zip_name=filename,
                created_by=uploaded_by,
                owner_user_id=owner_user_id,
                share_id=share_id,
            )

            queued_zip_path = (TUS_TMP_DIR / f"zipjob-{job_id}-{secrets.token_hex(6)}.zip").resolve()
            if not _is_relative_to(TUS_TMP_DIR, queued_zip_path):
                _set_zip_job_state(job_id, "error", "Ugyldig intern ZIP-sti")
                log_activity(
                    kind="upload",
                    action="error",
                    message="Upload finalize fejlede: Ugyldig intern ZIP-sti",
                    level="error",
                    folder_path=folder,
                    target=filename,
                    actor=uploaded_by,
                    job_id=job_id,
                )
                return False, None, "Upload finalize fejlede: Ugyldig intern ZIP-sti"

            try:
                data_path.replace(queued_zip_path)
            except Exception as exc:
                _set_zip_job_state(job_id, "error", f"Kunne ikke klargøre ZIP-job: {exc}")
                try:
                    data_path.unlink(missing_ok=True)
                except Exception:
                    pass
                log_activity(
                    kind="upload",
                    action="error",
                    message=f"Upload finalize fejlede: {exc}",
                    level="error",
                    folder_path=folder,
                    target=filename,
                    actor=uploaded_by,
                    job_id=job_id,
                )
                return False, None, f"Upload finalize fejlede: {exc}"

            try:
                enqueue_zip_extract_job(
                    {
                        "job_id": job_id,
                        "zip_path": str(queued_zip_path),
                        "base_folder": folder,
                        "uploaded_by": uploaded_by,
                        "upload_client_id": upload_client_id,
                        "last_modified_ms": last_modified_ms,
                        "zip_name": filename,
                    }
                )
            except Exception as exc:
                _set_zip_job_state(job_id, "error", f"Kunne ikke starte ZIP-job: {exc}")
                try:
                    queued_zip_path.unlink(missing_ok=True)
                except Exception:
                    pass
                log_activity(
                    kind="upload",
                    action="error",
                    message=f"Upload finalize fejlede: {exc}",
                    level="error",
                    folder_path=folder,
                    target=filename,
                    actor=uploaded_by,
                    job_id=job_id,
                )
                return False, None, f"Upload finalize fejlede: {exc}"

            row = None
        else:
            row = commit_uploaded_file(
                source_path=data_path,
                folder_path=folder,
                original_name=filename,
                uploaded_by=uploaded_by,
                upload_client_id=upload_client_id,
                last_modified_ms=last_modified_ms,
            )
    except Exception as exc:
        log_activity(
            kind="upload",
            action="error",
            message=f"Upload finalize fejlede: {exc}",
            level="error",
            folder_path=folder,
            target=filename,
            actor=uploaded_by,
        )
        return False, None, f"Upload finalize fejlede: {exc}"

    try:
        _, meta_path = tus_upload_paths(upload_id)
        meta_path.unlink(missing_ok=True)
    except Exception:
        pass

    return True, row, ""


@app.route("/api/upload/tus", methods=["OPTIONS"])
@app.route("/api/upload/tus/<upload_id>", methods=["OPTIONS"])
@login_required
def api_upload_tus_options(upload_id: Optional[str] = None):
    _ = upload_id
    return _tus_options_response()


@app.route("/api/upload/tus", methods=["POST"])
@login_required
def api_upload_tus_create():
    fb = tus_require_version()
    if fb:
        return jsonify(fb[0]), fb[1], tus_headers()

    try:
        upload_length = int(str(request.headers.get("Upload-Length") or "0").strip())
    except Exception:
        upload_length = -1
    if upload_length < 0:
        return jsonify({"ok": False, "error": "Invalid Upload-Length"}), 400, tus_headers()

    meta = parse_tus_metadata(str(request.headers.get("Upload-Metadata") or ""))
    filename = str(meta.get("filename") or "").strip()
    if not filename:
        return jsonify({"ok": False, "error": "Missing filename"}), 400, tus_headers()

    if current_user.is_admin:
        folder = normalize_folder_path(str(meta.get("folder") or ""))
        if not folder:
            try:
                folder = ensure_user_storage_ready(current_user)
            except Exception as exc:
                return jsonify({"ok": False, "error": f"Kunne ikke klargøre hjemmemappe: {exc}"}), 500, tus_headers()
    else:
        try:
            folder = ensure_user_daily_upload_folder(current_user)
        except Exception as exc:
            return jsonify({"ok": False, "error": f"Kunne ikke klargøre dagsmappe: {exc}"}), 500, tus_headers()

    folder_perm = permission_for_user_folder(current_user, folder)
    if not permission_allows(folder_perm, "upload"):
        return jsonify({"ok": False, "error": "Ingen upload-adgang til valgt mappe"}), 403, tus_headers()

    try:
        _, abs_folder = folder_abs_path(folder)
        abs_folder.mkdir(parents=True, exist_ok=True)
        ensure_folder_record(folder)
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Kan ikke oprette mappe: {exc}"}), 500, tus_headers()

    upload_id = secrets.token_urlsafe(18)
    data_path, _ = tus_upload_paths(upload_id)
    try:
        with data_path.open("wb"):
            pass
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Unable to create upload: {exc}"}), 500, tus_headers()

    try:
        last_modified_ms = int(str(meta.get("lastModified") or "0").strip() or "0")
    except Exception:
        last_modified_ms = 0

    upload_meta: Dict[str, Any] = {
        "id": upload_id,
        "filename": filename,
        "folder": folder,
        "upload_length": upload_length,
        "upload_offset": 0,
        "last_modified_ms": last_modified_ms,
        "uploaded_by": str(current_user.username),
        "upload_client_id": str(meta.get("clientUploadId") or "").strip(),
        "created_at": now_iso(),
        "kind": "user",
        "owner_user_id": int(current_user.id),
    }
    tus_store_meta(upload_id, upload_meta)
    log_activity(
        kind="upload",
        action="started",
        message=f"Upload startet (forventet størrelse: {max(0, upload_length)} bytes)",
        level="info",
        folder_path=folder,
        target=filename,
        actor=str(current_user.username or ""),
    )

    resp = make_response("", 201)
    for key, value in tus_headers().items():
        resp.headers[key] = value
    resp.headers["Location"] = url_for("api_upload_tus_patch", upload_id=upload_id)
    resp.headers["Upload-Offset"] = "0"
    return resp


@app.route("/api/upload/tus/<upload_id>", methods=["HEAD"])
@login_required
def api_upload_tus_head(upload_id: str):
    fb = tus_require_version()
    if fb:
        return jsonify(fb[0]), fb[1], tus_headers()

    meta = tus_load_meta(upload_id)
    if not meta:
        return jsonify({"ok": False, "error": "Upload not found"}), 404, tus_headers()

    if int(meta.get("owner_user_id") or 0) != int(current_user.id):
        return jsonify({"ok": False, "error": "Ingen adgang"}), 403, tus_headers()

    data_path, _ = tus_upload_paths(upload_id)
    offset = int(meta.get("upload_offset") or 0)
    if data_path.exists():
        try:
            offset = int(data_path.stat().st_size)
        except Exception:
            pass

    resp = make_response("", 204)
    for key, value in tus_headers().items():
        resp.headers[key] = value
    resp.headers["Upload-Offset"] = str(max(0, offset))
    resp.headers["Upload-Length"] = str(int(meta.get("upload_length") or 0))
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.route("/api/upload/tus/<upload_id>", methods=["PATCH"])
@login_required
def api_upload_tus_patch(upload_id: str):
    fb = tus_require_version()
    if fb:
        return jsonify(fb[0]), fb[1], tus_headers()

    ctype = str(request.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
    if ctype != "application/offset+octet-stream":
        return jsonify({"ok": False, "error": "Invalid Content-Type"}), 415, tus_headers()

    meta = tus_load_meta(upload_id)
    if not meta:
        return jsonify({"ok": False, "error": "Upload not found"}), 404, tus_headers()

    if int(meta.get("owner_user_id") or 0) != int(current_user.id):
        return jsonify({"ok": False, "error": "Ingen adgang"}), 403, tus_headers()

    data_path, _ = tus_upload_paths(upload_id)
    if not data_path.exists():
        return jsonify({"ok": False, "error": "Upload data missing"}), 410, tus_headers()

    try:
        req_offset = int(str(request.headers.get("Upload-Offset") or "0").strip())
    except Exception:
        return jsonify({"ok": False, "error": "Invalid Upload-Offset"}), 400, tus_headers()

    current_size = int(data_path.stat().st_size)
    if req_offset != current_size:
        resp = make_response("", 409)
        for key, value in tus_headers().items():
            resp.headers[key] = value
        resp.headers["Upload-Offset"] = str(current_size)
        return resp

    body = request.get_data(cache=False, as_text=False) or b""
    try:
        with data_path.open("ab") as fh:
            if body:
                fh.write(body)
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Unable to write upload chunk: {exc}"}), 500, tus_headers()

    new_offset = int(data_path.stat().st_size)
    total_length = int(meta.get("upload_length") or 0)
    meta["upload_offset"] = new_offset
    tus_store_meta(upload_id, meta)

    file_row: Optional[sqlite3.Row] = None
    if total_length > 0 and new_offset >= total_length:
        ok, file_row, err = _finalize_tus_upload(upload_id, meta, data_path)
        if not ok:
            return jsonify({"ok": False, "error": err}), 500, tus_headers({"Upload-Offset": str(new_offset)})

    resp = make_response("", 204)
    for key, value in tus_headers().items():
        resp.headers[key] = value
    resp.headers["Upload-Offset"] = str(new_offset)
    resp.headers["Cache-Control"] = "no-store"
    if file_row is not None:
        resp.headers["Upload-File-Id"] = str(int(file_row["id"]))
    return resp


@app.route("/api/upload/tus/<upload_id>", methods=["POST"])
@login_required
def api_upload_tus_override(upload_id: str):
    method_override = str(request.headers.get("X-HTTP-Method-Override") or "").strip().upper()
    if method_override == "PATCH":
        return api_upload_tus_patch(upload_id)
    return jsonify({"ok": False, "error": "Unsupported method"}), 405, tus_headers()


@app.route("/api/share/<token>/upload/tus", methods=["OPTIONS"])
@app.route("/api/share/<token>/upload/tus/<upload_id>", methods=["OPTIONS"])
def api_share_upload_tus_options(token: str, upload_id: Optional[str] = None):
    _ = token
    _ = upload_id
    return _tus_options_response()


@app.route("/api/share/<token>/upload/tus", methods=["POST"])
def api_share_upload_tus_create(token: str):
    fb = tus_require_version()
    if fb:
        return jsonify(fb[0]), fb[1], tus_headers()

    share_row, err, folders = share_access(token, required="upload")
    if err is not None:
        status = 401 if err.get("requires_auth") else 403
        return jsonify(err), status, tus_headers()

    try:
        upload_length = int(str(request.headers.get("Upload-Length") or "0").strip())
    except Exception:
        upload_length = -1
    if upload_length < 0:
        return jsonify({"ok": False, "error": "Invalid Upload-Length"}), 400, tus_headers()

    meta = parse_tus_metadata(str(request.headers.get("Upload-Metadata") or ""))
    filename = str(meta.get("filename") or "").strip()
    if not filename:
        return jsonify({"ok": False, "error": "Missing filename"}), 400, tus_headers()

    folder = normalize_folder_path(str(meta.get("folder") or ""))
    if not folder:
        folder = folders[0] if folders else ""

    if not share_folder_allowed(folder, folders):
        return jsonify({"ok": False, "error": "Mappen er ikke en del af delingen"}), 403, tus_headers()

    try:
        _, abs_folder = folder_abs_path(folder)
        abs_folder.mkdir(parents=True, exist_ok=True)
        ensure_folder_record(folder)
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Kan ikke oprette mappe: {exc}"}), 500, tus_headers()

    upload_id = secrets.token_urlsafe(18)
    data_path, _ = tus_upload_paths(upload_id)
    try:
        with data_path.open("wb"):
            pass
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Unable to create upload: {exc}"}), 500, tus_headers()

    try:
        last_modified_ms = int(str(meta.get("lastModified") or "0").strip() or "0")
    except Exception:
        last_modified_ms = 0

    visitor_name = str(session.get(share_visitor_key(int(share_row["id"]))) or "").strip()
    uploaded_by = visitor_name or "share-visitor"

    upload_meta: Dict[str, Any] = {
        "id": upload_id,
        "filename": filename,
        "folder": folder,
        "upload_length": upload_length,
        "upload_offset": 0,
        "last_modified_ms": last_modified_ms,
        "uploaded_by": uploaded_by,
        "upload_client_id": str(meta.get("clientUploadId") or "").strip(),
        "created_at": now_iso(),
        "kind": "share",
        "share_id": int(share_row["id"]),
        "share_token": str(token),
    }
    tus_store_meta(upload_id, upload_meta)

    resp = make_response("", 201)
    for key, value in tus_headers().items():
        resp.headers[key] = value
    resp.headers["Location"] = url_for("api_share_upload_tus_patch", token=token, upload_id=upload_id)
    resp.headers["Upload-Offset"] = "0"
    return resp


@app.route("/api/share/<token>/upload/tus/<upload_id>", methods=["HEAD"])
def api_share_upload_tus_head(token: str, upload_id: str):
    fb = tus_require_version()
    if fb:
        return jsonify(fb[0]), fb[1], tus_headers()

    meta = tus_load_meta(upload_id)
    if not meta:
        return jsonify({"ok": False, "error": "Upload not found"}), 404, tus_headers()

    if str(meta.get("kind") or "") != "share" or str(meta.get("share_token") or "") != str(token):
        return jsonify({"ok": False, "error": "Upload does not belong to this share"}), 403, tus_headers()

    _, err, _ = share_access(token, required="upload")
    if err is not None:
        status = 401 if err.get("requires_auth") else 403
        return jsonify(err), status, tus_headers()

    data_path, _ = tus_upload_paths(upload_id)
    offset = int(meta.get("upload_offset") or 0)
    if data_path.exists():
        try:
            offset = int(data_path.stat().st_size)
        except Exception:
            pass

    resp = make_response("", 204)
    for key, value in tus_headers().items():
        resp.headers[key] = value
    resp.headers["Upload-Offset"] = str(max(0, offset))
    resp.headers["Upload-Length"] = str(int(meta.get("upload_length") or 0))
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.route("/api/share/<token>/upload/tus/<upload_id>", methods=["PATCH"])
def api_share_upload_tus_patch(token: str, upload_id: str):
    fb = tus_require_version()
    if fb:
        return jsonify(fb[0]), fb[1], tus_headers()

    ctype = str(request.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
    if ctype != "application/offset+octet-stream":
        return jsonify({"ok": False, "error": "Invalid Content-Type"}), 415, tus_headers()

    meta = tus_load_meta(upload_id)
    if not meta:
        return jsonify({"ok": False, "error": "Upload not found"}), 404, tus_headers()

    if str(meta.get("kind") or "") != "share" or str(meta.get("share_token") or "") != str(token):
        return jsonify({"ok": False, "error": "Upload does not belong to this share"}), 403, tus_headers()

    _, err, folders = share_access(token, required="upload")
    if err is not None:
        status = 401 if err.get("requires_auth") else 403
        return jsonify(err), status, tus_headers()

    folder = normalize_folder_path(str(meta.get("folder") or ""))
    if not share_folder_allowed(folder, folders):
        return jsonify({"ok": False, "error": "Mappen er ikke en del af delingen"}), 403, tus_headers()

    data_path, _ = tus_upload_paths(upload_id)
    if not data_path.exists():
        return jsonify({"ok": False, "error": "Upload data missing"}), 410, tus_headers()

    try:
        req_offset = int(str(request.headers.get("Upload-Offset") or "0").strip())
    except Exception:
        return jsonify({"ok": False, "error": "Invalid Upload-Offset"}), 400, tus_headers()

    current_size = int(data_path.stat().st_size)
    if req_offset != current_size:
        resp = make_response("", 409)
        for key, value in tus_headers().items():
            resp.headers[key] = value
        resp.headers["Upload-Offset"] = str(current_size)
        return resp

    body = request.get_data(cache=False, as_text=False) or b""
    try:
        with data_path.open("ab") as fh:
            if body:
                fh.write(body)
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Unable to write upload chunk: {exc}"}), 500, tus_headers()

    new_offset = int(data_path.stat().st_size)
    total_length = int(meta.get("upload_length") or 0)
    meta["upload_offset"] = new_offset
    tus_store_meta(upload_id, meta)

    file_row: Optional[sqlite3.Row] = None
    if total_length > 0 and new_offset >= total_length:
        ok, file_row, err_msg = _finalize_tus_upload(upload_id, meta, data_path)
        if not ok:
            return jsonify({"ok": False, "error": err_msg}), 500, tus_headers({"Upload-Offset": str(new_offset)})

    resp = make_response("", 204)
    for key, value in tus_headers().items():
        resp.headers[key] = value
    resp.headers["Upload-Offset"] = str(new_offset)
    resp.headers["Cache-Control"] = "no-store"
    if file_row is not None:
        resp.headers["Upload-File-Id"] = str(int(file_row["id"]))
    return resp


@app.route("/api/share/<token>/upload/tus/<upload_id>", methods=["POST"])
def api_share_upload_tus_override(token: str, upload_id: str):
    method_override = str(request.headers.get("X-HTTP-Method-Override") or "").strip().upper()
    if method_override == "PATCH":
        return api_share_upload_tus_patch(token, upload_id)
    return jsonify({"ok": False, "error": "Unsupported method"}), 405, tus_headers()


_bootstrap_thumbnail_queue()


if __name__ == "__main__":
    port = int(str(os.getenv("APP_PORT", "8080")) or "8080")
    app.run(host="0.0.0.0", port=port, debug=False)
