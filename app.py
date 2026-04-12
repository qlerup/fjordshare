from __future__ import annotations

import base64
import configparser
import hashlib
import json
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
from typing import Any, Dict, Iterable, Optional, Tuple

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
UPLOAD_ROOT = DATA_DIR / "uploads"
TUS_TMP_DIR = DATA_DIR / "tus_uploads"
THUMBS_DIR = DATA_DIR / "thumbs"
FILE_ATTACHMENTS_DIR = DATA_DIR / "file_attachments"
DB_PATH = DATA_DIR / "fjordshare.db"

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
BAMBUSTUDIO_PRINTER_PROFILES = str(os.getenv("BAMBUSTUDIO_PRINTER_PROFILES", "")).strip()
BAMBUSTUDIO_PRINT_PROFILES = str(os.getenv("BAMBUSTUDIO_PRINT_PROFILES", "")).strip()
BAMBUSTUDIO_FILAMENT_PROFILES = str(os.getenv("BAMBUSTUDIO_FILAMENT_PROFILES", "")).strip()
try:
    BAMBUSTUDIO_TIMEOUT_SEC = max(60, int(str(os.getenv("BAMBUSTUDIO_TIMEOUT_SEC", "1800")) or "1800"))
except Exception:
    BAMBUSTUDIO_TIMEOUT_SEC = 1800
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


def _ensure_storage_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    TUS_TMP_DIR.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    FILE_ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)


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


def _read_bambustudio_profiles() -> dict:
    printers: list[str] = []
    print_profiles: list[str] = []
    filament_profiles: list[str] = []

    parse_error = ""
    source = "env"
    config_path_raw = str(BAMBUSTUDIO_CONFIG_PATH or "").strip()

    if config_path_raw:
        source = "config"
        config_path = Path(config_path_raw)
        if not config_path.exists() or not config_path.is_file():
            parse_error = f"Config-fil findes ikke: {config_path}"
        else:
            parser = configparser.ConfigParser(interpolation=None, strict=False)
            parser.optionxform = str
            try:
                text = config_path.read_text(encoding="utf-8", errors="ignore")
                parser.read_string(text)
                for section in parser.sections():
                    printer_name = _extract_profile_name_from_section(section, ("printer:", "printer "))
                    if printer_name:
                        printers.append(printer_name)

                    process_name = _extract_profile_name_from_section(section, ("print:", "process:", "process "))
                    if process_name:
                        print_profiles.append(process_name)

                    filament_name = _extract_profile_name_from_section(section, ("filament:", "filament "))
                    if filament_name:
                        filament_profiles.append(filament_name)
            except Exception as exc:
                parse_error = f"Kunne ikke læse config-profiler: {exc}"

    printers.extend(_split_profile_env_list(BAMBUSTUDIO_PRINTER_PROFILES))
    print_profiles.extend(_split_profile_env_list(BAMBUSTUDIO_PRINT_PROFILES))
    filament_profiles.extend(_split_profile_env_list(BAMBUSTUDIO_FILAMENT_PROFILES))

    return {
        "source": source,
        "config_path": config_path_raw,
        "parse_error": parse_error,
        "printers": _dedupe_preserve_order(printers),
        "print_profiles": _dedupe_preserve_order(print_profiles),
        "filament_profiles": _dedupe_preserve_order(filament_profiles),
    }


def _resolve_bambustudio_executable() -> str:
    def _prefer_apprun(path_str: str) -> str:
        p = Path(path_str)
        try:
            parts_lower = [part.lower() for part in p.parts]
        except Exception:
            return path_str
        if len(parts_lower) >= 3 and parts_lower[-3:] == ["appdir", "bin", "bambu-studio"]:
            app_run = p.parent.parent / "AppRun"
            if app_run.is_file():
                return str(app_run)
        return path_str

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


def _slice_stl_to_gcode(
    input_stl: Path,
    output_gcode: Path,
    printer_profile: str = "",
    print_profile: str = "",
    filament_profile: str = "",
) -> None:
    if not input_stl.exists() or not input_stl.is_file():
        raise RuntimeError("STL filen findes ikke på disk")

    executable = _resolve_bambustudio_executable()
    cmd = [executable]

    if BAMBUSTUDIO_CONFIG_PATH:
        config_path = Path(BAMBUSTUDIO_CONFIG_PATH)
        if not config_path.exists() or not config_path.is_file():
            raise RuntimeError(f"BAMBUSTUDIO_CONFIG_PATH findes ikke: {config_path}")
        cmd.extend(["--load", str(config_path)])

    printer_profile_value = str(printer_profile or "").strip()
    print_profile_value = str(print_profile or "").strip()
    filament_profile_value = str(filament_profile or "").strip()

    if printer_profile_value:
        cmd.extend(["--printer-profile", printer_profile_value])
    if print_profile_value:
        cmd.extend(["--print-profile", print_profile_value])
    if filament_profile_value:
        cmd.extend(["--filament-profile", filament_profile_value])

    cmd.extend(["--export-gcode", "--output", str(output_gcode), str(input_stl)])

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=BAMBUSTUDIO_TIMEOUT_SEC,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("BambuStudio timeout")
    except FileNotFoundError:
        raise RuntimeError(f"BambuStudio blev ikke fundet: {executable}")
    except Exception as exc:
        raise RuntimeError(f"Kunne ikke starte BambuStudio: {exc}")

    if proc.returncode != 0:
        details = (proc.stderr or proc.stdout or "Ukendt fejl").strip()
        raise RuntimeError(f"BambuStudio fejl: {details[:1000]}")

    if not output_gcode.exists() or not output_gcode.is_file() or output_gcode.stat().st_size <= 0:
        raise RuntimeError("BambuStudio lavede ingen output-fil")


def _process_slice_job_payload(payload: Dict[str, Any]) -> None:
    file_id = int(payload.get("file_id") or 0)
    requested_by = str(payload.get("requested_by") or "").strip()
    printer_profile = str(payload.get("printer_profile") or "").strip()
    print_profile = str(payload.get("print_profile") or "").strip()
    filament_profile = str(payload.get("filament_profile") or "").strip()
    if file_id <= 0:
        return

    with closing(get_conn()) as conn:
        row = conn.execute("SELECT * FROM files WHERE id=?", (file_id,)).fetchone()

    if row is None:
        return

    ext = str(row["ext"] or "").lower()
    if not _supports_slicing_for_ext(ext):
        _set_file_slice_state(file_id, "error", "Slicing understøtter kun STL", actor=requested_by or "system")
        return

    _set_file_slice_state(file_id, "processing", "", actor=requested_by or "system")

    output_path: Optional[Path] = None
    try:
        source_path = file_disk_path(row)
        folder_path = normalize_folder_path(str(row["folder_path"] or ""))
        _, folder_abs = folder_abs_path(folder_path)
        base_name = Path(str(row["filename"] or "model.stl")).stem
        gcode_name = sanitize_filename(f"{base_name}.gcode")
        output_path = allocate_unique_target(folder_abs, gcode_name)

        _slice_stl_to_gcode(
            source_path,
            output_path,
            printer_profile=printer_profile,
            print_profile=print_profile,
            filament_profile=filament_profile,
        )

        creator = requested_by or str(row["uploaded_by"] or "slicer")
        upsert_file_record(
            folder_path=folder_path,
            filename=output_path.name,
            disk_path=output_path,
            uploaded_by=creator,
            upload_client_id=None,
        )

        _set_file_slice_state(file_id, "ready", "", actor=requested_by or "system")
    except Exception as exc:
        try:
            if output_path and output_path.exists() and output_path.is_file():
                output_path.unlink(missing_ok=True)
        except Exception:
            pass
        _set_file_slice_state(file_id, "error", str(exc), actor=requested_by or "system")


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
                    _set_file_slice_state(fid, "error", f"slice worker error: {exc}", actor="system")
            except Exception:
                pass
        finally:
            with SLICE_QUEUE_LOCK:
                if file_id_for_cleanup > 0:
                    SLICE_QUEUED_IDS.discard(file_id_for_cleanup)
            SLICE_QUEUE.task_done()


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
) -> bool:
    fid = int(file_id)
    with SLICE_QUEUE_LOCK:
        if fid in SLICE_QUEUED_IDS:
            return False
        SLICE_QUEUED_IDS.add(fid)
    _start_slice_worker_if_needed()
    SLICE_QUEUE.put(
        {
            "file_id": fid,
            "requested_by": str(requested_by or ""),
            "printer_profile": str(printer_profile or "").strip(),
            "print_profile": str(print_profile or "").strip(),
            "filament_profile": str(filament_profile or "").strip(),
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


def serialize_file_row(row: sqlite3.Row, share_token: Optional[str] = None) -> dict:
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
    return {"app_build": APP_BUILD}


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
        }
    )


@app.route("/setup", methods=["GET", "POST"])
def setup():
    if users_count() > 0:
        return redirect(url_for("login"))

    error = ""
    if request.method == "POST":
        username = str(request.form.get("username") or "").strip()
        password = str(request.form.get("password") or "")
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

    items: list[dict] = []
    for row in rows:
        if user_can_access_file(current_user, row, "view"):
            ext = str(row["ext"] or "").lower()
            thumb_status = str(row["thumb_status"] or "none").strip().lower()
            thumb_rel = str(row["thumb_rel"] or "").strip()
            if _supports_thumbnail_for_ext(ext) and (not thumb_rel or thumb_status in {"queued", "error"}):
                try:
                    enqueue_thumbnail(int(row["id"]))
                except Exception:
                    pass
            items.append(serialize_file_row(row))

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
    return jsonify(
        {
            "ok": True,
            "profiles": {
                "printers": data.get("printers", []),
                "print_profiles": data.get("print_profiles", []),
                "filament_profiles": data.get("filament_profiles", []),
            },
            "source": str(data.get("source") or ""),
            "config_path": str(data.get("config_path") or ""),
            "parse_error": str(data.get("parse_error") or ""),
        }
    )


@app.route("/api/files/<int:file_id>/slice", methods=["POST"])
@login_required
def api_file_slice(file_id: int):
    if not current_user.is_admin:
        return jsonify({"ok": False, "error": "Kun admin kan starte slicing"}), 403

    body = request.get_json(silent=True) or {}
    printer_profile = str(body.get("printer_profile") or "").strip()[:200]
    print_profile = str(body.get("print_profile") or "").strip()[:200]
    filament_profile = str(body.get("filament_profile") or "").strip()[:200]

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

    profile_details = []
    if printer_profile:
        profile_details.append(f"printer={printer_profile}")
    if print_profile:
        profile_details.append(f"print={print_profile}")
    if filament_profile:
        profile_details.append(f"filament={filament_profile}")
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
    )
    return jsonify(
        {
            "ok": True,
            "queued": True,
            "profiles": {
                "printer_profile": printer_profile,
                "print_profile": print_profile,
                "filament_profile": filament_profile,
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


@app.route("/api/admin/logs", methods=["GET"])
@login_required
def api_admin_logs():
    if not current_user.is_admin:
        return jsonify({"ok": False, "error": "Kun admin"}), 403

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
    items = [serialize_file_row(r, share_token=token) for r in rows]
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


