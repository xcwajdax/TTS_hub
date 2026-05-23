# Cursor hooks for TTS Hub

This folder contains the source files installed into `~/.cursor/` by the **Cursor Integration** panel inside TTS Hub.

> Świadomie używamy `.cursor-hooks/` (nie `.cursor/hooks/`), żeby Cursor nie ładował tych skryptów w workspace developera TTS Huba.

## Files

| Plik | Cel |
|------|-----|
| `cursor-tts.ps1`         | Główny skrypt: tryb `capture` (zapis odpowiedzi) i `speak` (ekstrakcja + POST do `/generate`). |
| `hooks.json.template`    | Wzorzec `version` + `hooks.{afterAgentResponse,stop}` do scalenia z `~/.cursor/hooks.json`. |
| `tts-hub.json.example`   | Przykładowy `tts-hub.json` (config integracji eksportowany z UI). |

## Wymagania

- **PowerShell 7+ (`pwsh.exe`)** na PATH — `Windows PowerShell 5.1` psuje UTF-8 na stdin (polskie znaki).
- TTS Hub uruchomiony (`npm run tauri dev` lub zbudowana paczka), HTTP API na `http://127.0.0.1:8765`.

## Instalacja

1. Otwórz TTS Hub.
2. **Ustawienia zaawansowane → Cursor**.
3. Kliknij **Zainstaluj / odśwież hooki Cursor**.

Instalator:

- skopiuje `cursor-tts.ps1` do `~/.cursor/hooks/`,
- scali `~/.cursor/hooks.json` (z backupem `hooks.json.<unix_ts>.bak`, nie nadpisuje cudzych wpisów),
- zapisze atomicznie `~/.cursor/tts-hub.json` z aktualnymi ustawieniami.

## Tryb pracy

```
Cursor Agent → afterAgentResponse (capture) → %TEMP%\cursor-tts\<conv>.txt
            → stop {completed} (speak)     → GET /cursor/config
                                            → Extract-Summary
                                            → POST /generate (autoplay=true)
                                            → emit "generation:ready"
                                            → UI autoplay w PlaybackBar
```

## Markery podsumowania

Hook preferuje sekcję owiniętą markerami:

```html
<!-- tts-summary -->
Krótkie podsumowanie po polsku, maksymalnie 10 zdań.
<!-- /tts-summary -->
```

Bez markerów: hook usuwa bloki kodu i bierze ostatni paragraf (max N zdań z `cursor_integration.max_sentences`).

## Log

`%TEMP%\cursor-tts\cursor-tts.log` — rotacja przy 1 MB. Pola: `ts | phase | conv_id | status | ms | reason`.

Możliwe `status` / `reason`:

- `ok` — wysłano do TTS Hub.
- `skip empty_text` / `skip empty_summary` — nic do powiedzenia.
- `skip api_down` — TTS Hub nie odpowiada (fail-open).
- `skip disabled` — `cursor_integration.enabled == false`.
- `skip dnd` — aktywny tryb „nie przeszkadzać" (`dnd_until_ts > now`).
- `skip duplicate` — to samo podsumowanie co poprzednie (SHA1).
- `error <msg>` — wyjątek PowerShella.
