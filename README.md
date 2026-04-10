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

Slicing-funktionen bruger et eksternt program (BambuStudio) via kommandolinje. Der skal derfor ikke installeres ekstra Python-pakker for slicing, men BambuStudio-binæren skal være tilgængelig i containeren.

Miljøvariabler i `.env`:

- `BAMBUSTUDIO_BIN` (default: `bambu-studio`)
- `BAMBUSTUDIO_CONFIG_PATH` (valgfri sti til preset/config-fil)
- `BAMBUSTUDIO_TIMEOUT_SEC` (default: `1800`)

Hvis binæren ikke findes i containerens PATH, vil slicing fejle med en tydelig fejlbesked.

## Data

Data gemmes i volumen mappet til `DATA_DIR`:

- database: `/data/fjordshare.db`
- uploadede filer: `/data/uploads`
- genererede thumbnails (inkl. 3D): `/data/thumbs`
- midlertidige TUS-filer: `/data/tus_uploads`

## Bemærk

- Dette er en stærk første version af kerneflowet.
- Næste naturlige trin er finere rettighedsstyring pr. bruger/mappe i UI samt flere preview-formater.



