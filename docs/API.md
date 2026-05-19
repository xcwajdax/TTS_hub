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
| `GET` | `/history?scope=session\|archive` | Lista generacji. |
| `POST` | `/history/{id}/archive` | Przeniesienie do archiwum (opcjonalny format w body). |
| `DELETE` | `/history/{id}` | Usunięcie generacji (plik + wpis w SQLite). |
| `GET` | `/audio/{id}` | Strumień audio (WAV/MP3/OGG wg zapisu). |

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

## Integracje

API nadaje się do skryptów Python, n8n, Node.js lub dowolnego klienta HTTP — o ile proces TTS Hub działa w tle na tej samej maszynie.
