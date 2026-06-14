# Voice Pack — jak dodać preset

Voice Pack to plik `.ttshub-voice` (ZIP) z `manifest.json` i opcjonalną próbką audio.

## Szybki start

1. Utwórz folder `docs/voice-packs/<twoj-id>/manifest.json` (wzór: `google-kore-cieply/manifest.json`).
2. Dodaj wpis do `docs/voice-packs/catalog.json` (`id`, `download_path`, `folder`, `preview_url`).
3. Opcjonalnie dodaj mapowanie próbki w `build-voice-packs.ps1` (`$PreviewMap`).
4. Zbuduj archiwa:

```powershell
pwsh docs/voice-packs/build-voice-packs.ps1
```

5. Sprawdź import w TTS Hub: **Profile głosu → Importuj pack**.

## Zasady publikacji

- **Google / MiniMax preset** (oficjalny głos + styl): OK bez surowego audio osoby.
- **Klon osoby trzeciej**: tylko z udokumentowaną zgodą — nie publikuj w publicznym katalogu bez licencji.
- Każdy manifest: pola `license`, `author`, sensowny `description`.
- `format`: `ttshub-voicepack`, `format_version`: `1`.

## Import ze strony / API

- Katalog: `GET http://127.0.0.1:8765/voice-packs/catalog`
- Import: `POST http://127.0.0.1:8765/voice-packs/import` z body `{ "url": "https://…" }`

Strona `TTS_hub_site` używa tych endpointów, gdy Hub jest uruchomiony.
