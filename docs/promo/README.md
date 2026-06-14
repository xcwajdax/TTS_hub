# Film promocyjny TTS Hub — pakiet produkcyjny

Trzy persony użytkowników przekazują pałeczkę narracji. Social cut ≤60 s + pełna wersja na landing/YouTube.

## Szybki pipeline

```powershell
# 1. Profile głosów + projekt Roleplay (TTS Hub zamknięty)
pwsh -File docs/promo/scripts/setup-roleplay-promo.ps1

# 2. Uruchom TTS Hub, generuj audio
pwsh -File docs/promo/scripts/generate-promo-audio.ps1
pwsh -File docs/promo/scripts/master-promo-audio.ps1

# 3. Placeholdery storyboard (npm run dev w osobnym terminalu)
node docs/promo/capture/capture-promo-assets.mjs

# 4. Montaż wideo (ffmpeg)
pwsh -File docs/promo/scripts/assemble-promo-social.ps1 -WithSquare
pwsh -File docs/promo/scripts/assemble-promo-full.ps1
```

## Struktura

| Katalog | Zawartość |
|---------|-----------|
| [scripts/](scripts/) | Scenariusz, generacja audio, montaż, setup Roleplay |
| [roleplay/](roleplay/) | Profile głosów, projekt TipTap, README importu |
| [audio/](audio/) | Manifest segmentów + wygenerowane WAV |
| [storyboard/](storyboard/) | PNG do montażu (podmień nagraniami OBS) |
| [capture/](capture/) | Playwright capture, checklist, demo API |
| [video/](video/) | Eksport MP4, rozdziały YouTube, publish-config |

## Scenariusz

Pełny scenariusz z cue obrazu: [scripts/promo-narration.md](scripts/promo-narration.md)

## Persony

| Persona | Głos | Kolor |
|---------|------|-------|
| Lektor | Google Kore | `#facc15` |
| Twórca | MiniMax kobieta PL | `#f472b6` |
| Developer | Google Charon | `#38bdf8` |
| Cursor | MiniMax mężczyzna PL | `#4ade80` |

## Landing page

Po wgraniu na YouTube ustaw ID w [video/publish-config.json](video/publish-config.json). Embed w `TTS_hub_site/index.html` sekcja `#film`.

## Deliverables

| Plik | Spec |
|------|------|
| `video/readme-demo.mp4` | ~0:24, 720×720 — demo narracji na README (robert_maklowicz, karaoke) |
| `video/promo-social-9x16.mp4` | ≤60 s, 1080×1920 |
| `video/promo-social-1x1.mp4` | ≤60 s, 1080×1080 |
| `video/promo-full-16x9.mp4` | ~2:30–3:30, 1920×1080 |
| `video/chapters-youtube.txt` | Rozdziały (auto po montażu) |
