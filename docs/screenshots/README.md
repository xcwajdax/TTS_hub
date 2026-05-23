# Zrzuty ekranu

| Plik | Skórka | Opis |
|------|--------|------|
| `skin-vibelife.png` | **VIBELIFE** (domyślna) | Ciemny motyw fioletowo-cyan |
| `skin-matrix.png` | **Matrix** | Zielony terminal |
| `skin-light-zen.png` | **Light / Zen** | Jasny, spokojny |
| `main-window.png` | — | Kopia `skin-vibelife` (kompatybilność wsteczna linków) |

## Regeneracja (podgląd Vite)

```powershell
# Terminal 1
npm run dev

# Terminal 2 (Playwright — 1400×900, bez banera podglądu)
npm install --no-save playwright
npx playwright install chromium
node docs/screenshots/capture-skins.mjs
```

Skrypt: [capture-skins.mjs](capture-skins.mjs) — ustawia `localStorage` (`tts-hub-active-skin`) i robi PNG.

## Zrzuty z okna Tauri (zalecane do README)

1. `npm run tauri dev` — okno **1400×900**, pasek tytułu ze **skórkami** (VIBELIFE / Matrix / Light).
2. Win+Shift+S lub Snipping Tool — trzy zrzuty, zapisz jako pliki powyżej.

W podglądzie przeglądarki (`localhost:1420`) **nie ma** paska skórek (tylko w Tauri); skórę można wymusić przez `localStorage` + odświeżenie, jak w skrypcie.

**Sugerowane dodatkowe zrzuty (ręcznie):**

- Modal „Ustawienia zaawansowane”
- Archiwum z kilkoma wpisami + waveform
- Integracja Cursor / szybkie skróty
