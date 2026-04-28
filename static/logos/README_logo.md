# fjord3D logo package

Klar logo-/ikonpakke til webapp, favicon, PWA og iPhone “Føj til hjemmeskærm”.

## Mapper

- `logos/` — primære logoer, dark mode, stacked logo og transparente versioner
- `icons/` — favicon-størrelser, app-icon master og ikon-varianter
- `web/` — filer der kan kopieres direkte til din public/static mappe
- `source/` — originale genererede PNG-kilder

## Web tags

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#002B4C">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="fjord3D">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

## Hurtig brug

Kopiér alt fra `web/` til din apps `public/` eller `static/` mappe. Brug `logos/fjord3D-logo-horizontal-transparent.png` i din app-header.
