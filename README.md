# FjordShare

Ny Docker-app til fil-deling bygget som en letvægts søster til `fjordlens`.

## Implementeret i denne første store version

- Login og første opsætning (første bruger bliver admin)
- Side-menu og web-UI med faner:
  - Filer
  - Indstillinger
    Delinger, DNS og Brugere som underfaner
- Oprettelse af brugere med kun:
  - Brugernavn
  - Kode
- Automatisk oprettelse af hjemmemappe pr. bruger ved oprettelse
- TUS resumable upload til alle filtyper
- Manuel mappe-oprettelse i UI
- Deling af en eller flere mapper med rettigheder:
  - `view`
  - `upload`
  - `manage`
- Delingsmuligheder:
  - Udløb (dage/timer)
  - Kodebeskyttelse
  - Kræv besøgsnavn
  - Brug ekstern DNS-base-url
- Offentlig delingsside med:
  - Filvisning
  - Download
  - Upload (hvis tilladt)
  - Slet (hvis `manage`)
- Metadata-flow efter multi-upload:
  - Bemærkning pr. fil
  - Antal pr. fil
- 3D-understøttelse i browser:
  - Baggrundsgenererede thumbnails i grid for `.glb`, `.gltf`, `.stl`, `.obj`, `.step`, `.stp`
  - Åbning/rotation/zoom for `.glb`, `.gltf`, `.stl`, `.obj`

## Kør lokalt med Docker

```bash
cd fjordshare
cp .env.example .env
docker compose up -d --build
```

Åbn derefter:

- `http://localhost:9090` (eller den port du sætter i `.env`)

## STL slicing med BambuStudio

Slicing-funktionen bruger et eksternt program (BambuStudio) via kommandolinje. Der skal derfor ikke installeres ekstra Python-pakker for slicing.

Docker-image build forsøger automatisk at hente en BambuStudio AppImage fra officielle releases og installerer en `bambu-studio` CLI-wrapper i containeren.

Miljøvariabler i `.env`:

- `BAMBUSTUDIO_APPIMAGE_URL` (valgfri build override, bruges hvis du vil pinne en bestemt AppImage)
- `BAMBUSTUDIO_BIN` (default: `bambu-studio`)
- `BAMBUSTUDIO_CONFIG_PATH` (valgfri sti til preset/config-fil)
- `BAMBUSTUDIO_TIMEOUT_SEC` (default: `1800`)
- `BAMBUSTUDIO_PRINTER_PROFILES` (valgfri komma-separeret fallback-liste)
- `BAMBUSTUDIO_PRINT_PROFILES` (valgfri komma-separeret fallback-liste)
- `BAMBUSTUDIO_FILAMENT_PROFILES` (valgfri komma-separeret fallback-liste)

Hvis auto-detektion af release-asset fejler i build, så sæt `BAMBUSTUDIO_APPIMAGE_URL` i `.env` til en konkret AppImage URL og byg igen.

Når du klikker **Slice STL** i appen, åbnes nu en modal hvor du kan vælge:

- Printer
- Printprofil
- Filamentprofil

Profiler læses primært fra `BAMBUSTUDIO_CONFIG_PATH`; hvis ingen kan læses, bruges fallback-listerne fra env-variablerne ovenfor.

### Egne printer-, print- og filamentprofiler

Appen kan kun slice med de profiler, som BambuStudio får via en konfigurationsfil (`BAMBUSTUDIO_CONFIG_PATH`). Den læser ikke profiler direkte fra din Bambu-konto/cloud.

Bemærk om plate-size i UI:

- Plate/bed størrelse vises ud fra machine-profilens JSON felter.
- Nogle profiler gemmer størrelsen i nested felter (fx shape/area/dimensions) i stedet for simple `bed_width`/`bed_depth`.
- FjordShare forsøger derfor nu at auto-detektere både simple og nested varianter, men hvis en profil ikke indeholder en brugbar størrelse, falder UI tilbage til standard 256x256 mm.

Sådan får du dine egne profiler ind:

1. Åbn BambuStudio på din PC.
2. Vælg de presets du vil bruge (printer, process/print, filament).
3. Eksportér en config-bundle/config-fil fra BambuStudio.
4. Læg filen i din data-mappe på NAS, fx:
  - host: `${DATA_DIR}/bambu/profiles/my-profile.ini`
  - container: `/data/bambu/profiles/my-profile.ini`
5. Sæt i `.env`:
  - `BAMBUSTUDIO_CONFIG_PATH=/data/bambu/profiles/my-profile.ini`
6. Rebuild/start:
  - `docker compose up -d --build`

Hvis du vil have flere valg direkte i appen, kan du lave flere config-filer (én pr. setup), og vi kan udvide UI'et til at vælge mellem dem i en modal.

## Data

Data gemmes i volumen mappet til `DATA_DIR`:

- database: `/data/fjordshare.db`
- uploadede filer: `/data/uploads`
- genererede thumbnails (inkl. 3D): `/data/thumbs`
- midlertidige TUS-filer: `/data/tus_uploads`

## Bemærk

- Dette er en stærk første version af kerneflowet.
- Næste naturlige trin er finere rettighedsstyring pr. bruger/mappe i UI samt flere preview-formater.



