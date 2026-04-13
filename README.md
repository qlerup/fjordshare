# FjordShare

FjordShare is a lightweight file sharing and slicer web app for NAS and Docker workflows.
It is built for fast file sharing, per-print-file metadata, and Bambu Studio based slicing directly from the web UI.

## What Is Implemented

### Core features

- Login and first-run setup (first user becomes admin)
- Folder/file browser in the web UI with side panel
- TUS resumable upload (large files / unstable networks)
- Create folder, rename, delete, and file metadata editing
- Share one or more folders with permissions:
  - `view`
  - `upload`
  - `manage`
- Share options:
  - Expiry (days/hours)
  - Password protection
  - Require visitor name
  - External DNS base URL

### 3D and preview

- 3D thumbnails in the file grid for `.glb`, `.gltf`, `.stl`, `.obj`, `.step`, `.stp`
- In-browser 3D viewer for `.glb`, `.gltf`, `.stl`, `.obj`

### Slicer integration (Bambu Studio)

- Slicing through the Bambu Studio CLI from backend jobs
- Studio-inspired **Slice STL** modal with a large preview scene
- Rotation (X/Y/Z) with live preview and footprint/height info
- Profile selection in the modal:
  - Printer
  - Print profile
  - Filament profile
  - Support mode/type/style

### Slicer profiles in Settings

- Profile cards for:
  - Printer profile (`machine.json`)
  - Print settings (`process.json`)
  - Filament profile (`filament.json`)
  - Config bundles (`ini/cfg/conf/txt`)
- Upload methods:
  - `Upload files` button (modal)
  - Drag and drop directly on each profile card

### Printer bed sizes (bed mapping)

- Table includes:
  - Printer profile
  - Vendor
  - Model
  - X/Y (auto-detected from model)
  - Source
  - Actions
- `Add printer`, `Edit` (modal for manual X/Y), `Delete`
- Save/reset mapping
- Deleted rows are persisted as hidden so they do not auto-return on refresh

## Built-in Bambu Presets (Bed Sizes)

The following Bambu presets are included for automatic X/Y defaults:

- H2D / H2D Pro: `350 x 320`
- A1 mini: `180 x 180`
- A1: `256 x 256`
- P1S / P1P: `256 x 256`
- X1 / X1 Carbon / X1E: `256 x 256`

## Run Locally With Docker

```bash
cd fjordshare
cp .env.example .env
docker compose up -d --build
```

Then open:

- `http://localhost:9090` (or the port configured in `.env`)

## Important Environment Variables (.env)

- `DATA_DIR`
- `BAMBUSTUDIO_BIN` (default: `bambu-studio`)
- `BAMBUSTUDIO_TIMEOUT_SEC` (default: `1800`)
- `BAMBUSTUDIO_CONFIG_PATH` (optional)
- `BAMBUSTUDIO_PROFILE_ROOT` (optional)
- `BAMBUSTUDIO_PRINTER_PROFILES` (optional fallback list)
- `BAMBUSTUDIO_PRINT_PROFILES` (optional fallback list)
- `BAMBUSTUDIO_FILAMENT_PROFILES` (optional fallback list)
- `BAMBUSTUDIO_LOAD_SETTINGS` (optional direct load)
- `BAMBUSTUDIO_LOAD_FILAMENTS` (optional direct load)
- `BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK` (`1`/`0`)
- `SLICER_PROFILE_MAX_BYTES`

## Bambu Studio Presets From Local Installation

If you want to pull default profiles directly from Bambu Studio on Windows, they are typically here:

`C:\Program Files\Bambu Studio\resources\profiles\BBL`

Usually split into:

- `filament`
- `machine`
- `process`

You can upload these files into the matching profile boxes in FjordShare under Settings -> Slicer.

## Plate Assets For Slicer View

A versioned folder is provided for model/plate files so assets can travel with repo/deploy:

- `static/slicer-plates/`

Place plate files there to include them in installs for other users.
When model-to-file mapping is configured, the UI can switch plate assets automatically based on selected printer model.

## Useful Scripts

Helper scripts are included here:

- `Useful Scripts/fjordshare-start.sh`
- `Useful Scripts/fjordshare-force-update.sh`
- `Useful Scripts/fjordshare-cleanup.sh`
- `Useful Scripts/README.md`

These scripts support operations, updates, and cleanup for FjordShare NAS deployments using Docker Compose.

## Data Paths

Data is stored in the volume mapped to `DATA_DIR`:

- database: `/data/fjordshare.db`
- uploaded files: `/data/uploads`
- thumbnails: `/data/thumbs`
- TUS temp files: `/data/tus_uploads`
- slicer profiles: `/data/bambu/profiles`
- sliced output: `/data/bambu/sliced`

## Notes

- If Bambu Studio release auto-detection fails during build, pin an AppImage URL in `.env` and rebuild.
- `fjordshare-cleanup.sh` is destructive and should be used with care.
