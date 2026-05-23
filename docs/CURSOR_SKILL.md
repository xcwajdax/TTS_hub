# Integracja Cursor przez skill `tts-hub-speak`

Skill zastępuje (na próbę) automatyczne hooki: TTS uruchamia się **po każdej turze** agenta z podsumowaniem, także po odpowiedziach pośrednich — nie dopiero po zakończeniu sesji (`stop`).

## Wymagania

1. **TTS Hub** uruchomiony (`npm run tauri dev`) — API `http://127.0.0.1:8765`.
2. **PowerShell 7+** (`pwsh`) na PATH (skrypt wołany przez agenta).
3. Skopiuj konfigurację:

   ```text
   .cursor/skills/tts-hub-speak/config.json.example
   → .cursor/skills/tts-hub-speak/config.json
   ```

4. Klucze providerów w `studios.env` / ustawieniach aplikacji (`MINIMAX_API_KEY`, `GOOGLE_API_KEY`, Voice Box lokalnie).

Domyślny preset **minimax** w `config.json` używa polskiego głosu `Polish_female_1_sample1` i `language: "pl"` (jak w aplikacji TTS Hub). Inne polskie presety MiniMax: `Polish_male_1_sample4`, `Polish_female_2_sample3` itd.

## Aktywacja w Cursorze

W czacie agenta: **`@tts-hub-speak`** lub prośba o mówione podsumowania przez TTS Hub.

Skill ma `disable-model-invocation: true` — ładuje się tylko gdy go wybierzesz.

## Przepływ

1. Agent kończy odpowiedź blokiem `<!-- tts-summary -->` … `<!-- /tts-summary -->` (po polsku, bez kodu/list w środku).
2. Agent uruchamia:

   ```powershell
   pwsh -NoLogo -NoProfile -File ".cursor/skills/tts-hub-speak/scripts/speak-summary.ps1" -SummaryText "..."
   ```

3. Skrypt scala ustawienia i woła `POST /generate` z `source: "cursor-skill"`, `autoplay: true`.

## Konfiguracja hybrydowa

| Plik / API | Rola |
|------------|------|
| `config.json` → `active_preset` | `minimax`, `google`, `voicebox` — presety w `presets` |
| `prefer_app_config: true` | Gdy integracja Cursor w aplikacji jest **włączona**, nadpisuje provider/model/głos z `GET /cursor/config` |
| `respect_dnd: true` | Pomija TTS, gdy w aplikacji aktywny tryb „nie przeszkadzać” |

Przełącz provider bez aplikacji: zmień `active_preset` w `config.json`.  
Z aplikacją: **Ustawienia zaawansowane → Integracja Cursor** (provider, model, głos, format).

## Unikanie podwójnego TTS

Jeśli masz zainstalowane hooki (`~/.cursor/hooks/cursor-tts.ps1`), **odinstaluj je** w panelu Cursor w TTS Hub — inaczej usłyszysz podsumowanie dwa razy (skill na każdej turze + hook na `stop`).

## Logi

| Ścieżka | Opis |
|---------|------|
| `%TEMP%\cursor-tts-skill\cursor-tts-skill.log` | Skill |
| `%TEMP%\cursor-tts\cursor-tts.log` | Hooki (legacy) |

## Ograniczenia

- Agent musi **wykonać skrypt** na końcu tury — skill nie jest wymuszany jak hook.
- Subagenty w tle nie dziedziczą skillu automatycznie.
- Voice Box wymaga działającego serwera; MiniMax — `MINIMAX_API_KEY`.

## Powiązane

- Skill: [`.cursor/skills/tts-hub-speak/SKILL.md`](../.cursor/skills/tts-hub-speak/SKILL.md)
- Hooki (legacy): [`.cursor-hooks/README.md`](../.cursor-hooks/README.md)
- API: [`API.md`](API.md)
