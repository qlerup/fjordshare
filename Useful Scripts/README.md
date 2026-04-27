# Useful Scripts

These scripts are helper scripts for operating and maintaining FjordShare on NAS with Docker Compose.

## Scripts

- `fjordshare-start.sh`: starts/builds FjordShare (`--fresh` for no-cache rebuild).
- `fjordshare-update.sh`: normal update path. Backs up `.env` and the SQLite DB when possible, pulls the current Git branch, rebuilds, starts, and waits for health.
- `fjordshare-force-update.sh`: forces git sync and deployment update.
- `fjordshare-cleanup.sh`: removes containers/images/volumes/networks for FjordShare (destructive).

## Usage

Run these scripts on the machine where the FjordShare Docker deployment is located.
Always review script contents before running.

Typical update:

```sh
cd /opt/fjordshare
sh "Useful Scripts/fjordshare-update.sh"
```

Useful options:

```sh
sh "Useful Scripts/fjordshare-update.sh" --no-cache
sh "Useful Scripts/fjordshare-update.sh" --no-build
sh "Useful Scripts/fjordshare-update.sh" --branch main
```

Use `fjordshare-force-update.sh` only when the local checkout needs to be reset to GitHub.

## Bambu Studio presets (BBL)

If you want to fetch default profiles directly from Bambu Studio, you can find them here:

`C:\Program Files\Bambu Studio\resources\profiles\BBL`

In that folder, presets are typically split into these subfolders:

- `filament`
- `machine`
- `process`

### Quick guide

1. Open the path above in Windows Explorer.
2. Go into `filament`, `machine`, or `process` depending on profile type.
3. Copy the profiles you want to use.
4. Upload them in FjordShare under the matching profile box:
   - `machine` -> Printer profile
   - `process` -> Print settings
   - `filament` -> Filament profile

Tip: You can use both the `Upload files` button and drag-and-drop directly on each profile card in FjordShare.
