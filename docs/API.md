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
| `GET` | `/usage?provider=…&window=24h` | Lokalny licznik znaków/tokenów/generacji per provider. |
| `GET` | `/history?scope=session\|archive&folder_id=…` | Lista generacji. `folder_id`: `__none__` (bez folderu), `__all__` lub ID folderu (tylko archiwum). |
| `GET` | `/generations/by-origin?kind=telegram&limit=50` | Generacje oznaczone zewnętrznym originem (boty, webhooki, CLI). |
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
| `GET` | `/chat/sessions?source=…&saved_only=true` | Lista sesji czatu, najnowsze aktywne pierwsze. |
| `POST` | `/chat/sessions` | Utworzenie sesji czatu dla źródła (`source`). |
| `GET` | `/chat/sessions/{id}` | Metadane jednej sesji czatu (bez wiadomości). |
| `PATCH` | `/chat/sessions/{id}` | Zmiana tytułu i/lub flagi zapisania sesji. |
| `DELETE` | `/chat/sessions/{id}` | Usunięcie rekordu sesji czatu. |
| `GET` | `/chat/sessions/{id}/messages` | Wiadomości sesji w kolejności rozmowy. |
| `POST` | `/chat/sessions/{id}/messages` | Dodanie wiadomości do sesji. |
| `POST` | `/chat/sessions/{id}/replay/{message_id}` | Pobranie `generation_id` audio dla wiadomości. |
| `GET` | `/chat/sources` | Źródła sesji aktywne w ostatnich 30 dniach. |

## Soundboard (agent)

Indeksy slotów: `0`–`7`. Domyślne skróty globalne: `Ctrl+Shift+1` … `Ctrl+Shift+8`.

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
| `original_prompt` | string \| null | nie | Prompt użytkownika, który doprowadził do odpowiedzi asystenta. Zapisywany w historii/czacie; nie wpływa na tekst syntezowany. |
| `chat_session_id` | string \| null | nie | Jeśli ustawione, generacja zostaje powiązana z sesją czatu. Podawaj ID istniejącej sesji zwrócone przez `/chat/sessions`; nie zakładaj, że dowolny ID zostanie poprawnie utworzony automatycznie. |
| `chat_role` | string \| null | nie | Pole przyjmowane przez backend dla kompatybilności. Obecny zapis automatyczny z `/generate` tworzy wiadomość `assistant` dla `text`; rola z tego pola nie steruje jeszcze zapisem. |
| `origin` | object \| null | nie | Atrybucja zewnętrznego klienta: `kind`, opcjonalnie `platform_id`, `user_id`, `user_name`, `thread_id`. Używane przez `/generations/by-origin` i feed botów. |
| `voice_profile_id` | string \| null | nie | Snapshot zapisanego profilu głosu. UI historii i czatu pokazuje avatar/nazwę profilu, nawet po zmianie ustawień generacji. |

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

### Kontekst czatu i origin

`chat_session_id` dotyczy zakładki **Czat** w TTS Hub. Najpierw utwórz sesję przez `/chat/sessions`, a potem przekaż zwrócone `id` do `/generate`. Gdy podasz istniejące `chat_session_id`, backend:

1. dodaje wiadomość `user` z `original_prompt`, jeśli pole jest niepuste,
2. dodaje wiadomość `assistant` z tekstem syntezy i podpina do niej `generation_id`,
3. zapisuje `chat_session_id`, `chat_message_id`, `original_prompt` i `voice_profile_id` na rekordzie generacji.

`origin` jest niezależny od sesji czatu i służy zewnętrznym integracjom, np. botom Telegram/Discord lub webhookom. `kind` jest dowolnym stringiem, więc nowy klient nie wymaga zmiany kodu TTS Hub.

Przykład:

```json
{
  "provider": "minimax",
  "text": "Cześć, jestem gotowy do rozmowy.",
  "model": "speech-2.8-hd",
  "voice": "Polish_female_1_sample1",
  "language": "pl",
  "format": "mp3",
  "source": "telegram",
  "original_prompt": "Przywitaj użytkownika po polsku",
  "chat_session_id": "sess_123",
  "origin": {
    "kind": "telegram",
    "platform_id": "bot-prod",
    "user_id": "42",
    "user_name": "anna",
    "thread_id": "chat-42"
  }
}
```

## `GET /usage`

Zwraca lokalny rollup po rekordach `generations`. To **nie** jest stan konta Google/MiniMax/Voice Box ani endpoint limitu/quota; backend nie udostępnia `/usage/remaining`, bo MiniMax nie zwraca wiarygodnego sygnału pozostałego pakietu.

Parametry:

| Parametr | Opis |
|----------|------|
| `provider` | Opcjonalnie jeden z `google`, `voicebox`, `minimax`. Bez parametru zwracana jest lista providerów widzianych w lokalnej historii. |
| `window` | Opcjonalnie tylko `24h`. Inne wartości zwracają `400`. |

**Odpowiedź dla jednego providera:**

```json
{
  "provider": "minimax",
  "total_chars": 12345,
  "total_tokens_est": 4115,
  "total_generations": 17,
  "last_24h_chars": 900,
  "last_24h_generations": 2,
  "as_of": 1781200000
}
```

Bez `provider` odpowiedzią jest tablica takich obiektów.

## `GET /generations/by-origin`

Zwraca najnowsze generacje, których `origin_kind` odpowiada `kind` z query stringa.

| Parametr | Wymagane | Opis |
|----------|----------|------|
| `kind` | tak | Dowolny origin ustawiony w `/generate`, np. `telegram`, `discord`, `webhook`, `cli`. Pusty string zwraca `400`. |
| `limit` | nie | Domyślnie `100`, zakres wymuszony przez API: `1`–`1000`. |

**Odpowiedź 200:** tablica obiektów `Generation`.

## Chat sessions

Sesje czatu przechowują rozmowę podzieloną na metadane sesji i wiadomości. Frontend używa tych samych danych w zakładce **Czat**.

### Typy

`ChatSession`:

```json
{
  "id": "sess_...",
  "source": "cursor",
  "title": "cursor 2026-06-11 16:55",
  "created_at": 1781200000000,
  "last_active_at": 1781200000000,
  "is_saved": false,
  "message_count": 2,
  "metadata_json": null
}
```

`ChatMessage`:

```json
{
  "id": "msg_...",
  "session_id": "sess_...",
  "role": "assistant",
  "content": "Gotowe.",
  "generation_id": "gen_...",
  "created_at": 1781200000000,
  "order_index": 2,
  "voice_profile_id": "profile_..."
}
```

Role wiadomości są ograniczone przez bazę do `user`, `assistant`, `system`. `voice_profile_id` jest opcjonalne i służy tylko do pokazania profilu głosu w UI.

### `POST /chat/sessions`

```json
{
  "source": "cursor",
  "title": "Sesja z Cursor"
}
```

`source` jest wymagany. Jeśli `title` jest puste, backend tworzy tytuł z nazwy źródła i czasu UTC. Pole `metadata` istnieje w typie requestu, ale obecnie nie jest zapisywane; `metadata_json` wraca jako `null`.

### `GET /chat/sessions`

Opcjonalne filtry:

| Parametr | Opis |
|----------|------|
| `source` | Zwróć tylko sesje danego źródła. |
| `saved_only` | `true` ogranicza wynik do zapisanych sesji. |

Wynik jest sortowany po `last_active_at DESC` i ma twardy limit 200 sesji.

### `GET /chat/sessions/{id}`

Zwraca tylko `ChatSession`. Wiadomości trzeba pobrać osobno przez `/chat/sessions/{id}/messages`.

### `PATCH /chat/sessions/{id}`

```json
{
  "title": "Nowy tytuł",
  "is_saved": true
}
```

Można wysłać jedno lub oba pola. Odpowiedź: `{ "ok": true }`.

### `DELETE /chat/sessions/{id}`

Usuwa rekord sesji. Odpowiedź: `{ "ok": true }`. Nie traktuj tego endpointu jako API do kasowania pojedynczych wiadomości.

Niezapisane sesje starsze niż 7 dni są dodatkowo czyszczone przy starcie aplikacji.

### `GET /chat/sessions/{id}/messages`

Zwraca wiadomości sortowane rosnąco po `order_index`.

### `POST /chat/sessions/{id}/messages`

```json
{
  "role": "user",
  "content": "Przeczytaj to spokojnie.",
  "generation_id": null,
  "voice_profile_id": null
}
```

Dodanie wiadomości zwiększa `message_count` sesji i aktualizuje `last_active_at`.

### `POST /chat/sessions/{id}/replay/{message_id}`

Zwraca pointer do audio wiadomości:

```json
{
  "session_id": "sess_...",
  "message_id": "msg_...",
  "generation_id": "gen_..."
}
```

Jeśli wiadomość nie ma audio, API zwraca `404` z `{ "error": "message has no audio" }`. Sam strumień pobierzesz przez `/audio/{generation_id}`.

### `GET /chat/sources`

Zwraca listę par `[source, last_active_at]` dla źródeł, które miały sesję aktywną w ostatnich 30 dniach.

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
