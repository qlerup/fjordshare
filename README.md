# FjordShare

FjordShare er en letvægts fil- og slicer-webapp til NAS/Docker workflows.
Projektet er bygget til hurtig deling af filer, metadata pr. printfil og Bambu Studio-baseret slicing direkte fra web-UI.

## Hvad der er implementeret nu

### Kernefunktioner

- Login + første opsætning (første bruger bliver admin)
- Mapper/filer i web-UI med sidepanel
- TUS resumable upload (store filer / ustabilt net)
- Opret mappe, omdøb, slet, metadata på filer
- Deling af en eller flere mapper med rettigheder:
  - `view`
  - `upload`
  - `manage`
- Delingsmuligheder:
  - Udløb (dage/timer)
  - Kodebeskyttelse
  - Kræv besøgsnavn
  - Ekstern DNS base-url

### 3D/preview

- 3D thumbnails i fil-grid for `.glb`, `.gltf`, `.stl`, `.obj`, `.step`, `.stp`
- 3D visning i browser for `.glb`, `.gltf`, `.stl`, `.obj`

### Slicer-integration (Bambu Studio)

- Slicing via Bambu Studio CLI fra backend
- Ny “studio”-inspireret **Slice STL** modal med stor preview-scene
- Rotation (X/Y/Z) med live preview og footprint/højde-info
- Profilvalg i modal:
  - Printer
  - Printprofil
  - Filamentprofil
  - Support mode/type/style

### Slicer-profiler i Indstillinger

- Profilkort for:
  - Printer profil (`machine.json`)
  - Print settings (`process.json`)
  - Filament profil (`filament.json`)
  - Konfigurationsbundle (`ini/cfg/conf/txt`)
- Upload kan ske på to måder:
  - `Upload filer` knappen (modal)
  - Drag-and-drop **direkte på profilkortet**

### Printer pladestørrelser (bed mapping)

- Tabel med:
  - Printerprofil
  - Producent
  - Model
  - X/Y (auto fra model)
  - Kilde
  - Handlinger
- `Tilføj printer`, `Edit` (modal til manuel X/Y), `Slet`
- Gem/Nulstil mapping
- Slettede rækker gemmes som “skjulte”, så de ikke automatisk kommer igen ved refresh

## Bambu presets i kode (bed sizes)

Følgende Bambu presets er lagt ind til auto X/Y:

- H2D / H2D Pro: `350 x 320`
- A1 mini: `180 x 180`
- A1: `256 x 256`
- P1S / P1P: `256 x 256`
- X1 / X1 Carbon / X1E: `256 x 256`

## Kør lokalt med Docker

```bash
cd fjordshare
cp .env.example .env
docker compose up -d --build
```

Åbn derefter:

- `http://localhost:9090` (eller den port du sætter i `.env`)

## Vigtige miljøvariabler (.env)

- `DATA_DIR`
- `BAMBUSTUDIO_BIN` (default: `bambu-studio`)
- `BAMBUSTUDIO_TIMEOUT_SEC` (default: `1800`)
- `BAMBUSTUDIO_CONFIG_PATH` (valgfri)
- `BAMBUSTUDIO_PROFILE_ROOT` (valgfri)
- `BAMBUSTUDIO_PRINTER_PROFILES` (valgfri fallback-liste)
- `BAMBUSTUDIO_PRINT_PROFILES` (valgfri fallback-liste)
- `BAMBUSTUDIO_FILAMENT_PROFILES` (valgfri fallback-liste)
- `BAMBUSTUDIO_LOAD_SETTINGS` (valgfri direkte load)
- `BAMBUSTUDIO_LOAD_FILAMENTS` (valgfri direkte load)
- `BAMBUSTUDIO_ALLOW_PROFILE_FALLBACK` (`1`/`0`)
- `SLICER_PROFILE_MAX_BYTES`

## Bambu Studio presets fra lokal installation

Hvis du vil hente standardprofiler direkte fra Bambu Studio på Windows, kan de typisk findes her:

`C:\Program Files\Bambu Studio\resources\profiles\BBL`

Herunder ligger de normalt i:

- `filament`
- `machine`
- `process`

Disse filer kan uploades i de tilsvarende profilbokse i FjordShare under Indstillinger -> Slicer.

## Plate assets til slicer-view

Der er oprettet en versioneret mappe til model/pladefiler, så de kan følge med i repo/deploy:

- `static/slicer-plates/`

Læg pladefiler her, så de er en del af installationen for andre.
Når model->fil mapping er klar, kan UI skifte plade automatisk efter valgt printermodel.

## Useful Scripts

Der ligger hjælpescripts i repoet her:

- `Useful Scripts/fjordshare-start.sh`
- `Useful Scripts/fjordshare-force-update.sh`
- `Useful Scripts/fjordshare-cleanup.sh`
- `Useful Scripts/README.md`

Formålet er drift/opdatering/cleanup af FjordShare deployment på NAS med Docker Compose.

## Data paths

Data gemmes i volumen mappet til `DATA_DIR`:

- database: `/data/fjordshare.db`
- uploadede filer: `/data/uploads`
- thumbnails: `/data/thumbs`
- TUS temp: `/data/tus_uploads`
- slicer profiler: `/data/bambu/profiles`
- sliced output: `/data/bambu/sliced`

## Bemærk

- Hvis Bambu Studio release auto-detektion fejler ved build, pin AppImage URL i `.env` og rebuild.
- `fjordshare-cleanup.sh` er destruktiv og bør bruges med omtanke.
