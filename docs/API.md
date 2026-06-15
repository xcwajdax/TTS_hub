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
| `GET` | `/voicebox/health` | Status lokalnego serwera Voice Box. |
| `GET` | `/voicebox/profiles` | Profile głosów z Voice Box. |
| `GET` | `/voicebox/models` | Modele TTS dostępne w Voice Box. |
| `POST` | `/generate` | Kolejkowanie generacji mowy; opcjonalne `?wait=true` czeka na status terminalny. |
| `POST` | `/text/filter` | Podgląd filtrów tekstu (preset + tekst wejściowy). |
| `GET` | `/cursor/config` | Konfiguracja integracji Cursor (w tym `text_filters`). |
| `GET` | `/integration/status` | Stan instalacji integracji Cursor/MCP i czas ostatniej generacji z Cursora. |
| `GET` | `/history?scope=session\|archive\|bots&folder_id=…` | Lista generacji. `folder_id`: `__none__` (bez folderu), `__all__` lub ID folderu (tylko archiwum). |
| `POST` | `/history/{id}/archive` | Przeniesienie do archiwum (opcjonalny format w body). |
| `POST` | `/history/{id}/folder` | Przeniesienie do folderu (`{ "folder_id": "…" \| null }`). |
| `DELETE` | `/history/{id}` | Usunięcie generacji (plik + wpis w SQLite). |
| `GET` | `/generations/by-origin?kind={kind}&limit=100` | Ostatnie generacje oznaczone `origin.kind` danego klienta zewnętrznego. |
| `GET` | `/folders` | Lista folderów archiwum. |
| `POST` | `/folders` | Utworzenie folderu (`{ "name", "color"? }`). |
| `PATCH` | `/folders/{id}` | Zmiana nazwy folderu. |
| `DELETE` | `/folders/{id}` | Usunięcie folderu (`{ "mode": "unassign" \| "delete_items" }`). |
| `GET` | `/folder-rules` | Lista reguł auto-segregacji (źródło → folder). |
| `POST` | `/folder-rules` | Dodanie/aktualizacja reguły. |
| `DELETE` | `/folder-rules/{id}` | Usunięcie reguły. |
| `GET` | `/audio/{id}` | Strumień audio (WAV/MP3/OGG wg zapisu). |
| `GET` | `/jobs?scope=active` | Lista jobów wg statusów: `active`, `interrupted`, `failed`, `pending_approval`, `all`. |
| `GET` | `/jobs/{id}` | Szczegóły joba/generacji. |
| `POST` | `/jobs/{id}/cancel` | Anulowanie joba `queued`/`running`. |
| `POST` | `/jobs/{id}/resume` | Wznowienie joba `interrupted`, `failed` lub `cancelled`. |
| `DELETE` | `/jobs/{id}` | Usunięcie wpisu joba; usuwa niedokończony plik audio, jeśli istnieje. |
| `POST` | `/jobs/approve` | Safe Mode: zatwierdź joby `pending_approval` (`{ "ids": [...] }`). |
| `POST` | `/jobs/reject` | Safe Mode: odrzuć joby `pending_approval` (`{ "ids": [...] }`). |
| `GET` | `/usage?provider=minimax&window=24h` | Lokalny licznik znaków/generacji per provider; `window` obsługuje dziś tylko `24h`. |
| `POST` | `/minimax/sync-voices` | Synchronizacja katalogu głosów MiniMax. |
| `POST` | `/minimax/clone-voice` | Klon głosu MiniMax z pliku lokalnego. |
| `POST` | `/minimax/voice-design` | Projekt głosu MiniMax z promptu i tekstu podglądu. |
| `DELETE` | `/minimax/voices/{voice_id}` | Usunięcie sklonowanego głosu MiniMax. |
| `GET` | `/minimax/languages` | Lista języków MiniMax mapowanych przez Hub. |
| `POST` | `/minimax/upload-text` | Upload lokalnego pliku tekstowego do async T2A MiniMax. |
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
| `GET` | `/chat/sessions?source=cursor&saved_only=true` | Lista sesji czatu, najnowsze aktywne jako pierwsze. |
| `POST` | `/chat/sessions` | Utworzenie sesji czatu (`source`, opcjonalnie `title`, `metadata`). |
| `GET` | `/chat/sessions/{id}` | Szczegóły sesji czatu. |
| `PATCH` | `/chat/sessions/{id}` | Zmiana `title` lub flagi `is_saved`. |
| `DELETE` | `/chat/sessions/{id}` | Usunięcie sesji czatu i jej wiadomości. |
| `GET` | `/chat/sessions/{id}/messages` | Wiadomości sesji w kolejności `order_index`. |
| `POST` | `/chat/sessions/{id}/messages` | Dodanie wiadomości (`role`, `content`, opcjonalnie `generation_id`, `voice_profile_id`). |
| `POST` | `/chat/sessions/{id}/replay/{message_id}` | Zwraca `generation_id` powiązany z wiadomością audio. |
| `GET` | `/chat/sources` | Źródła sesji aktywne w ostatnich 30 dniach. |

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
| `minimax_options` | object \| null | nie | Pełne opcje T2A MiniMax (voice, audio, voice_modify, pronunciation_dict, timbre_weights, language, subtitles, transport HTTP/WS, async `text_file_id`). Tekst >10 000 znaków → async T2A. |
| `personality` | bool \| null | nie | Voice Box: przekazywane do lokalnego backendu jako przełącznik personality. |
| `conversation_id` | string \| null | nie | Id rozmowy/źródła klienta; zachowane w historii. |
| `original_prompt` | string \| null | nie | Prompt użytkownika, który doprowadził do odpowiedzi; zapisywany dla kontekstu czatu, nie wpływa na TTS. |
| `chat_session_id` | string \| null | nie | Id sesji czatu (`sess_…`). Gdy ustawione, Hub dopisuje wiadomości czatu i linkuje audio do odpowiedzi. |
| `chat_role` | `"assistant"` \| `"user"` \| `"system"` | nie | Pole przyjmowane w payloadzie; auto-linkowanie `/generate` zapisuje dziś `original_prompt` jako `user` i tekst TTS jako `assistant`. |
| `origin` | object \| null | nie | Atrybucja klienta zewnętrznego: `kind`, `platform_id`, `user_id`, `user_name`, `thread_id`. |
| `voice_profile_id` | string \| null | nie | Snapshot profilu głosu użytego przy generacji; UI historii/czatu pokazuje badge profilu. |

### Odpowiedź i kolejka

Domyślnie `POST /generate` tylko zapisuje job w SQLite i zwraca obiekt `Generation` ze statusem `queued` albo `pending_approval` (gdy włączony jest Safe Mode). Aplikacja desktopowa wykonuje job w tle przez `job_queue`; klient HTTP powinien potem odpytywać `GET /jobs/{id}` albo listy z `GET /jobs`.

Parametr `?wait=true` zachowuje starszy kontrakt synchroniczny: endpoint czeka, aż job dojdzie do `done`, `failed` albo `cancelled`. Nie używaj `wait=true` w automatyzacjach, które mogą działać przy Safe Mode bez zewnętrznego zatwierdzania, bo job `pending_approval` nie przejdzie dalej, dopóki ktoś nie wywoła `POST /jobs/approve` lub nie zatwierdzi go w UI.

Statusy jobów widoczne w odpowiedziach `Generation.status`:

| Status | Znaczenie |
|--------|-----------|
| `queued` | Job czeka na worker. |
| `running` | Worker generuje audio. |
| `done` | Audio zapisane; `file_path` i `/audio/{id}` powinny być dostępne. |
| `failed` | Generacja zakończona błędem; szczegóły w `error`. |
| `interrupted` | Job przerwany, zwykle po restarcie aplikacji; można wznowić. |
| `cancelled` | Job anulowany. |
| `pending_approval` | Safe Mode zatrzymał job przed wysłaniem do providera. |
| `rejected` | Użytkownik lub klient HTTP odrzucił job z Safe Mode. |

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

## `GET /jobs`

Kolejka jobów jest wspólna dla UI, Tauri IPC i HTTP API. `scope` wybiera zestaw statusów:

| Scope | Statusy |
|-------|---------|
| `active` | `queued`, `running` |
| `interrupted` | `interrupted` |
| `failed` | `failed` |
| `pending_approval` | `pending_approval` |
| `all` | `queued`, `running`, `interrupted`, `failed`, `cancelled`, `pending_approval`, `rejected` |

```powershell
# Aktywne joby
curl "http://127.0.0.1:8765/jobs?scope=active"

# Szczegóły jednego joba
curl "http://127.0.0.1:8765/jobs/<id>"

# Wznowienie po restarcie aplikacji lub błędzie providera
curl -X POST "http://127.0.0.1:8765/jobs/<id>/resume"
```

### Safe Mode

Safe Mode włącza się w UI aplikacji. Gdy jest aktywny, nowe generacje trafiają do statusu `pending_approval` i nie wysyłają tekstu do providera, dopóki nie zostaną zatwierdzone. HTTP API nie ma osobnego endpointu do przełączania Safe Mode; automatyzacje powinny traktować `pending_approval` jako normalny stan pośredni.

```powershell
# Lista oczekujących zatwierdzeń
curl "http://127.0.0.1:8765/jobs?scope=pending_approval"

# Zatwierdź wybrane joby; wynik ma pola approved/rejected/skipped
curl -X POST "http://127.0.0.1:8765/jobs/approve" `
  -H "Content-Type: application/json" `
  -d '{"ids":["<id-1>","<id-2>"]}'

# Odrzuć joby bez wysyłania do providera
curl -X POST "http://127.0.0.1:8765/jobs/reject" `
  -H "Content-Type: application/json" `
  -d '{"ids":["<id-1>"]}'
```

## Czat i źródła zewnętrzne

TTS Hub rozróżnia dwie warstwy kontekstu:

- `chat_session_id` i endpointy `/chat/*` opisują sesje w zakładce **Czat**. Sesje mają id `sess_…`, wiadomości `msg_…`, źródło (`source`), tytuł, flagę `is_saved` i metadane JSON.
- `origin` w `POST /generate` opisuje zewnętrzny klient, np. Telegram, Discord, webhook albo CLI. `origin.kind` jest wolnym krótkim stringiem; nowe integracje nie wymagają zmian w kodzie Hub.

Przykład generacji, która jednocześnie zapisuje wiadomości czatu i pozwala później filtrować historię bota:

```powershell
curl -X POST "http://127.0.0.1:8765/generate" `
  -H "Content-Type: application/json" `
  -d '{
    "text":"Odpowiedź asystenta do przeczytania głosem.",
    "original_prompt":"Co mam teraz zrobić?",
    "chat_session_id":"sess_...",
    "provider":"minimax",
    "model":"speech-2.8-hd",
    "voice":"Polish_female_1_sample1",
    "language":"pl",
    "format":"mp3",
    "source":"telegram",
    "origin":{
      "kind":"telegram",
      "platform_id":"bot-main",
      "user_id":"12345",
      "user_name":"ania",
      "thread_id":"chat-12345"
    }
  }'
```

```powershell
# Sesje z konkretnego źródła
curl "http://127.0.0.1:8765/chat/sessions?source=telegram"

# Wiadomości sesji
curl "http://127.0.0.1:8765/chat/sessions/sess_.../messages"

# Generacje z danego origin.kind, limit 1..1000
curl "http://127.0.0.1:8765/generations/by-origin?kind=telegram&limit=50"

# Krótki feed botów używany przez UI historii
curl "http://127.0.0.1:8765/history?scope=bots"
```

`POST /chat/sessions/{id}/replay/{message_id}` nie generuje nowego audio. Zwraca istniejące `generation_id` powiązane z wiadomością albo `404`, jeśli wiadomość nie ma audio.

## `GET /usage`

Licznik użycia jest lokalnym podsumowaniem tabeli `generations`, a nie odczytem limitów z kont Google/MiniMax/Voice Box. Dla każdego providera zwraca liczbę generacji, znaki, szacowane tokeny i okno ostatnich 24 godzin. `window` przyjmuje obecnie tylko `24h`; endpoint `/usage/remaining` celowo nie istnieje, bo MiniMax nie udostępnia wiarygodnego sygnału pozostałego limitu.

```powershell
curl "http://127.0.0.1:8765/usage"
curl "http://127.0.0.1:8765/usage?provider=minimax&window=24h"
```

Przykładowa odpowiedź pojedynczego providera:

```json
{
  "provider": "minimax",
  "total_chars": 12400,
  "total_tokens_est": 4134,
  "total_generations": 38,
  "last_24h_chars": 900,
  "last_24h_generations": 3,
  "as_of": 1781548800
}
```

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
