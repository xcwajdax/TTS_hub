# TTS Hub — lokalne HTTP API

Serwer startuje automatycznie z aplikacją desktopową.

| Parametr | Wartość |
|----------|---------|
| **Base URL** | `http://127.0.0.1:8765` |
| **Autoryzacja** | brak (tylko localhost) |
| **CORS** | dozwolone dla wszystkich originów |

## Endpointy

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/health` | Sprawdzenie żywotności serwisu. |
| `GET` | `/voices` | Lista ~30 głosów Gemini TTS. |
| `GET` | `/voice-samples?model={id}` | Status próbek głosów dla modelu. |
| `GET` | `/voice-samples/{model}/{voice}` | Pobranie pliku WAV próbki (jeśli wygenerowana w aplikacji). |
| `POST` | `/generate` | Generacja mowy (JSON). |
| `POST` | `/text/filter` | Podgląd filtrów tekstu (preset + tekst wejściowy). |
| `GET` | `/cursor/config` | Konfiguracja integracji Cursor (w tym `text_filters`). |
| `GET` | `/history?scope=session\|archive&folder_id=…` | Lista generacji. `folder_id`: `__none__` (bez folderu), `__all__` lub ID folderu (tylko archiwum). |
| `POST` | `/history/{id}/archive` | Przeniesienie do archiwum (opcjonalny format w body). |
| `POST` | `/history/{id}/folder` | Przeniesienie do folderu (`{ "folder_id": "…" \| null }`). |
| `DELETE` | `/history/{id}` | Usunięcie generacji (plik + wpis w SQLite). |
| `GET` | `/folders` | Lista folderów archiwum. |
| `POST` | `/folders` | Utworzenie folderu (`{ "name", "color"? }`). |
| `PATCH` | `/folders/{id}` | Zmiana nazwy folderu. |
| `DELETE` | `/folders/{id}` | Usunięcie folderu (`{ "mode": "unassign" \| "delete_items" }`). |
| `GET` | `/folder-rules` | Lista reguł auto-segregacji (źródło → folder). |
| `POST` | `/folder-rules` | Dodanie/aktualizacja reguły. |
| `DELETE` | `/folder-rules/{id}` | Usunięcie reguły. |
| `GET` | `/audio/{id}` | Strumień audio (WAV/MP3/OGG wg zapisu). |
| `GET` | `/plugins` | Lista wbudowanych rozszerzeń (`installed`, `enabled`). |
| `POST` | `/plugins/{id}/install` | Zainstaluj rozszerzenie (np. `soundboard`). |
| `DELETE` | `/plugins/{id}/install` | Odinstaluj rozszerzenie. |
| `PATCH` | `/plugins/{id}` | Włącz/wyłącz: body `{ "enabled": true \| false }`. |
| `GET` | `/plugins/soundboard` | Stan 8 slotów soundboarda. |
| `PUT` | `/plugins/soundboard/slots/{index}` | Przypisanie audio (`generation_id` **lub** `file_path`). |
| `PATCH` | `/plugins/soundboard/slots/{index}` | Metadane slotu (`label`, `shortcut`, `enabled`). |
| `DELETE` | `/plugins/soundboard/slots/{index}` | Wyczyść slot. |
| `POST` | `/plugins/soundboard/slots/{index}/play` | Odtwórz slot (emituje zdarzenie w aplikacji). |
| `GET` | `/plugins/soundboard/slots/{index}/audio` | Strumień pliku przypisanego do slotu. |

## Soundboard (agent)

Indeksy slotów: `0`–`7`. Domyślne skróty globalne: `Ctrl+Shift+1` … `Ctrl+Shift+8`.
Stan, pliki i typowe błędy: [VOICE_WORKFLOWS.md](VOICE_WORKFLOWS.md#soundboard).

```powershell
# Przypisz generację do slotu 0
Invoke-RestMethod -Uri "http://127.0.0.1:8765/plugins/soundboard/slots/0" -Method Put `
  -ContentType "application/json" -Body '{"generation_id":"<uuid>"}'

# Przypisz plik z dysku (kopiowany do %APPDATA%\TTS_hub\plugins\soundboard\)
Invoke-RestMethod -Uri "http://127.0.0.1:8765/plugins/soundboard/slots/1" -Method Put `
  -ContentType "application/json" -Body '{"file_path":"C:\\path\\clip.mp3"}'

# Odtwórz
Invoke-RestMethod -Uri "http://127.0.0.1:8765/plugins/soundboard/slots/0/play" -Method Post
```

## `GET /health`

**Odpowiedź 200:**

```json
{ "ok": true, "service": "tts-hub" }
```

## `POST /generate`

### Body (single-speaker)

```json
{
  "text": "Witaj świecie",
  "model": "gemini-2.5-flash-preview-tts",
  "voice": "Kore",
  "style": "Powiedz to radośnie:",
  "format": "wav",
  "multi_speaker": null
}
```

| Pole | Typ | Wymagane | Opis |
|------|-----|----------|------|
| `text` | string | tak | Tekst do syntezy. |
| `model` | string | tak | Id modelu TTS (np. `gemini-3.1-flash-tts-preview`). |
| `voice` | string | tak | Głos (np. `Kore`). |
| `style` | string \| null | nie | Prompt sterujący stylem wypowiedzi. |
| `format` | `"wav"` \| `"mp3"` \| `"ogg"` | tak | MP3/OGG wymagają `ffmpeg` w PATH. |
| `multi_speaker` | array \| null | nie | Dialog wielogłosowy (patrz niżej). |
| `filtered_text` | string \| null | nie | Tekst po filtrach — używany do syntezy zamiast `text`, gdy ustawiony. |
| `filter_config` | object \| null | nie | Snapshot presetu filtrów (do wznowienia joba / ponownego zastosowania). |
| `summary_text` | string \| null | nie | Skrót (np. z hooka Cursor); ma pierwszeństwo nad `filtered_text`. |
| `source` | string \| null | nie | Źródło: `manual`, `http`, `cursor`, `cursor-skill`, `quick_hotkey`. |
| `autoplay` | bool | nie | Po zakończeniu joba emituje zdarzenie `generation:ready` w aplikacji (domyślnie false w API). |
| `provider` | string \| null | nie | `google` (domyślnie), `voicebox`, `minimax`. |
| `profile_id` | string \| null | nie | Voice Box — id profilu (alternatywa: `voice`). |
| `language` | string \| null | nie | Voice Box — np. `pl`. Minimax — kod hub (`pl`, `en`) mapowany na API `language_boost` (`Polish`, `English`). Domyślnie `pl`. |
| `engine` | string \| null | nie | Voice Box — silnik z prefiksu modelu. |
| `minimax_speed` | number \| null | nie | MiniMax — 0.5–2.0 (domyślnie 1.0). Legacy; nadpisywane przez `minimax_options.voice`. |
| `minimax_vol` | number \| null | nie | MiniMax — 0–10 (domyślnie 1.0). |
| `minimax_pitch` | number \| null | nie | MiniMax — -12–12 (domyślnie 0). |
| `voice_profile_id` | string \| null | nie | Id zapisanego profilu głosu (badge w historii). |
| `context_label` | string \| null | nie | Etykieta projektu/sesji — badge w historii; tytuł nadal z tekstu. |

### Multi-speaker

```json
{
  "text": "Mówca1: Cześć!\nMówca2: Hej, jak leci?",
  "model": "gemini-2.5-flash-preview-tts",
  "voice": "Kore",
  "format": "wav",
  "multi_speaker": [
    { "speaker": "Mówca1", "voice": "Kore" },
    { "speaker": "Mówca2", "voice": "Puck" }
  ]
}
```

**Odpowiedź 200:** obiekt `Generation` (jak w UI).

**Błędy:** `500` z `{ "error": "..." }`.

## `POST /history/{id}/archive`

Opcjonalne body:

```json
{ "format": "mp3" }
```

Domyślnie: `wav`.

## Przykłady (PowerShell)

```powershell
curl http://127.0.0.1:8765/health

curl -X POST http://127.0.0.1:8765/generate `
  -H "Content-Type: application/json" `
  -d '{"text":"Witaj","model":"gemini-2.5-flash-preview-tts","voice":"Kore","format":"wav"}'

curl "http://127.0.0.1:8765/history?scope=archive"

curl http://127.0.0.1:8765/audio/<id> --output speech.wav
```

### MiniMax — klon głosu / synchronizacja

```powershell
# Klon (plik audio na dysku; TTS Hub musi działać)
curl -X POST http://127.0.0.1:8765/minimax/clone-voice `
  -H "Content-Type: application/json" `
  -d '{"source_path":"C:/path/sample-voice.mp3","voice_id":"my_custom_voice","name":"Mój głos","model":"minimax:speech-2.8-hd"}'

curl -X POST http://127.0.0.1:8765/minimax/sync-voices

curl http://127.0.0.1:8765/minimax/languages

curl -X POST http://127.0.0.1:8765/minimax/voice-design `
  -H "Content-Type: application/json" `
  -d '{"prompt":"Calm Polish narrator","preview_text":"Podgląd głosu."}'

curl -X DELETE http://127.0.0.1:8765/minimax/voices/my_custom_voice

curl -X POST http://127.0.0.1:8765/minimax/upload-text `
  -H "Content-Type: application/json" `
  -d '{"file_path":"C:/path/long-text.txt"}'
```

### MiniMax (skill / Cursor)

```powershell
curl -X POST http://127.0.0.1:8765/generate `
  -H "Content-Type: application/json" `
  -d '{"provider":"minimax","text":"Test.","summary_text":"Test.","model":"speech-2.8-hd","voice":"Polish_female_1_sample1","language":"pl","format":"mp3","autoplay":true,"source":"cursor-skill"}'
```

### Voice Box

```powershell
curl http://127.0.0.1:8765/voicebox/profiles
curl -X POST http://127.0.0.1:8765/generate `
  -H "Content-Type: application/json" `
  -d '{"provider":"voicebox","text":"Test.","model":"voicebox:chatterbox","voice":"<profile-id>","language":"pl","format":"wav","source":"cursor-skill"}'
```

### `GET /cursor/config`

Zwraca ustawienia integracji Cursor (pola spłaszczone) oraz `text_filters`. Używane przez hook i skill `tts-hub-speak` (`prefer_app_config`). Pola m.in.: `enabled`, `provider`, `model`, `voice`, `format`, `minimax_speed`, `dnd_until_ts`.

## `POST /text/filter`

Podgląd wyniku filtrów bez kolejkowania generacji.

**Body:**

```json
{
  "text": "Tekst z ```kodem```",
  "preset": {
    "id": "...",
    "name": "Domyślny",
    "builtins": {
      "strip_fenced_code": true,
      "strip_inline_code": true,
      "strip_blockquotes": false
    },
    "custom": []
  }
}
```

**Odpowiedź 200:** `{ "output": "...", "removed_chars": 12, "warnings": [] }`

## `GET /cursor/config`

Zwraca pola integracji Cursor (`enabled`, `model`, `voice`, …) oraz `text_filters` (presety filtrów tekstu).

## Integracje

API nadaje się do skryptów Python, n8n, Node.js lub dowolnego klienta HTTP — o ile proces TTS Hub działa w tle na tej samej maszynie.
