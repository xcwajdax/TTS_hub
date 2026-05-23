# Zrzuty ekranu

Zrzuty z **okna Tauri** (`npm run tauri dev`), ~1400×900.

| Plik | Opis |
|------|------|
| `main-window.png` | Główny widok — Light / Zen, Minimax, historia, waveform |
| `main-generating.png` | Generacja w toku + aktywne zadania |
| `settings-general.png` | Ustawienia zaawansowane → Ogólne (ścieżki, profile API) |
| `settings-usage.png` | Ustawienia → Zużycie (tokeny, koszty) |
| `settings-cursor.png` | Ustawienia → Cursor (skill, hooki, głos klon) |
| `quick-hotkey-demo.gif` | Szybki skrót z Notatnika (demo) |

## Starsze / pomocnicze

| Plik | Opis |
|------|------|
| `skin-vibelife.png`, `skin-matrix.png`, `skin-light-zen.png` | Podgląd Vite (wąski viewport) — do zastąpienia zrzutami Tauri per skórka |
| [capture-skins.mjs](capture-skins.mjs) | Regeneracja podglądu przeglądarki (Playwright) |

## Jak zaktualizować (zalecane)

1. `npm run tauri dev` — pełne okno, pasek skórek.
2. Win+Shift+S — zapisz jako pliki powyżej w tym folderze.
3. Dla trzech skórek: ten sam układ, przełącz **VIBELIFE** / **Matrix** / **Light** w pasku tytułu.

Źródła robocze mogą leżeć w `GITHUBSCREENS/` (lokalnie, opcjonalnie niecommitowane).
