# Useful Scripts

Disse scripts er helper-scripts til drift/vedligehold af FjordShare pa NAS med Docker Compose.

## Scripts

- `fjordshare-start.sh`: starter/build'er FjordShare (`--fresh` for no-cache rebuild).
- `fjordshare-force-update.sh`: tvinger git sync + opdatering af deployment.
- `fjordshare-cleanup.sh`: rydder containere/images/volumes/netvaerk for FjordShare (destruktiv).

## Brug

Koer scripts paa den maskine hvor Docker deployment af FjordShare ligger.
Gennemgaa altid script-indholdet foer koersel.

## Bambu Studio presets (BBL)

Hvis du vil hente standard-profilerne direkte fra Bambu Studio, kan du finde dem her:

`C:\Program Files\Bambu Studio\resources\profiles\BBL`

I den mappe ligger presets typisk fordelt i disse undermapper:

- `filament`
- `machine`
- `process`

### Hurtig guide

1. Aabn stien ovenfor i Windows Stifinder.
2. Gaa ind i `filament`, `machine` eller `process` alt efter profiltype.
3. Kopier de profiler du vil bruge.
4. Upload dem i FjordShare under den matchende profilboks:
   - `machine` -> Printer profil
   - `process` -> Print settings
   - `filament` -> Filament profil

Tip: Du kan nu baade bruge `Upload filer` knappen og drag-and-drop direkte paa hvert profilkort i FjordShare.
