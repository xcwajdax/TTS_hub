# Checklist — materiał ekranu do filmu promo

Zastąp placeholdery z `capture-promo-assets.mjs` prawdziwymi nagraniami OBS (1080p60, skórka VIBELIFE domyślnie).

## Wymagania nagrania

| Parametr | Social | Pełna wersja |
|----------|--------|--------------|
| Rozdzielczość | 1080×1920 (9:16) lub 1920×1080 crop | 1920×1080 |
| FPS | 30–60 | 60 (zalecane) |
| Format | MP4 (H.264) lub MKV (montaż) | MP4 / MKV |
| UI | Bez kluczy API, bez wrażliwych danych | j.w. |

## Ujęcia obowiązkowe

### Social (≤60 s)

| Plik storyboard | Ujęcie | Czas docelowy |
|-----------------|--------|---------------|
| `storyboard/social/00-hook.png` | Logo / splash VIBELIFE | 5 s |
| `storyboard/social/01-tworca.png` | Notepad → hotkey → waveform | 15 s |
| `storyboard/social/02-developer.png` | Terminal curl + soundboard | 15 s |
| `storyboard/social/03-cursor.png` | Cursor chat + autoplay TTS Hub | 15 s |
| `storyboard/social/04-cta.png` | Hero / mockup + Pobierz | 10 s |

### Pełna wersja

| Plik | Ujęcie |
|------|--------|
| `storyboard/full/00-intro.png` | Główne okno aplikacji |
| `storyboard/full/01-tworca.png` | Edytor, filtry, waveform, historia, Roleplay teaser |
| `storyboard/full/02-developer.png` | API terminal, skróty, soundboard, Szybka konfiguracja |
| `storyboard/full/03-cursor.png` | Ustawienia Cursor, skill, live demo |
| `storyboard/full/04-cta.png` | Pobierz + montaż 3 skórek |

## Regeneracja placeholderów (dev preview)

Tryb **mockup** wypełnia UI przykładowymi danymi bez backendu Tauri:

```text
http://127.0.0.1:1420?mock=1
```

lub `npm run dev:mock` (zmienna `VITE_MOCK_UI=1`).

```powershell
npm run dev
node docs/promo/capture/capture-promo-assets.mjs
```

Skrypt capture domyślnie otwiera `?mock=1`. Baner mockup jest usuwany przed screenshotem.

## GIF hotkey (README)

1. `npm run tauri dev`
2. Notepad → zaznacz tekst → globalny hotkey
3. Nagraj ekran (Win+G) → skonwertuj do GIF
4. Zapisz: `docs/screenshots/quick-hotkey-demo.gif`

## Demo API (terminal)

```powershell
# Nagraj terminal z:
curl http://127.0.0.1:8765/health
curl -X POST http://127.0.0.1:8765/generate -H "Content-Type: application/json" -d "{\"text\":\"Witaj\",\"model\":\"gemini-2.5-flash-preview-tts\",\"voice\":\"Kore\",\"format\":\"wav\"}"
```

Skrypt pomocniczy: `docs/promo/capture/demo-api-commands.ps1`

## Skórki (zamknięcie pełnej wersji)

```powershell
node docs/screenshots/capture-skins.mjs
# lub po npm run dev:
node docs/promo/capture/capture-promo-assets.mjs
```

Pliki: `docs/screenshots/skin-vibelife.png`, `skin-matrix.png`, `skin-light-zen.png`
