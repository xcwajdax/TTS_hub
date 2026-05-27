---
name: Makłowicz skill coordinator
overview: Rozszerzenie @tts-hub-speak o stonowany raport w stylu prowadzącego (Makłowicz) oraz pełny koordynator w TTS Hub (API + UI + skrypty), który rejestruje sesje Cursor, kolejkuje mowę, utrzymuje ciągłość narracyjną między czatami i decyduje speak/defer/skip.
todos:
  - id: rust-coordinator
    content: Dodać cursor_speak_coordinator.rs, migracje DB, endpointy HTTP i drain kolejki po zakończeniu job/playback
    status: pending
  - id: ps1-scripts
    content: Nowe skrypty resolve-conversation-id + get-coordinator-context; przerobić speak-summary na POST submit
    status: pending
  - id: skill-persona
    content: Zaktualizować SKILL.md, cursor-tts-summary.mdc, config.json.example i docs (persona raportu + workflow)
    status: pending
  - id: ui-panel
    content: Sekcja koordynatora w CursorIntegrationPanel + playback-idle z App/usePlaybackQueue
    status: pending
  - id: manual-qa
    content: "Testy: 2 równoległe sesje, dedupe, DND, cross-session hints"
    status: pending
isProject: true
---

<!-- tts-summary -->
Przygotowałem plan rozbudowy skilla tts-hub-speak i TTS Hub: podsumowania staną się stonowanym raportem prowadzącego w tonie Makłowicza z nawiązaniami do wcześniejszych wypowiedzi, a w aplikacji powstanie koordynator sesji z kolejką mowy i widokiem w Integracji Cursor. Najpierw doprecyzujemy instrukcje i skrypty po stronie Cursora, potem moduł Rust z API i tabelami w bazie, na końcu panel UI i dokumentację. Szacunkowo to około jednego do dwóch dni pracy w zależności od testów wielu równoległych czatów.
<!-- /tts-summary -->

# Makłowicz: raport + koordynator sesji

## Stan obecny

| Warstwa | Co jest | Czego brakuje |
|---------|---------|---------------|
| Głos | Klon `robert_maklowicz` przez `GET /cursor/config` + `speak-summary.ps1` | Styl **tekstu** nadal „asystent, 2. os.” (`SKILL.md`, `cursor-tts-summary.mdc`) |
| Sesje | Opcjonalne `conversation_id` w `POST /generate`; hooki znajdują transkrypty (`~/.cursor/projects/*/agent-transcripts/{id}/*.jsonl`) | Brak rejestru sesji, brak kolejki między czatami |
| Odtwarzanie | FIFO w UI: `usePlaybackQueue.ts` | Kolejka działa tylko w jednej instancji aplikacji; skill odpala `generate` fire-and-forget bez koordynacji |
| Dedupe | Globalny SHA1 w `%TEMP%\cursor-tts-skill\last-summary.sha1` | Przy wielu czatach blokuje legalne różne podsumowania |

## Docelowy przepływ

```mermaid
sequenceDiagram
  participant Agent as CursorAgent
  participant Ctx as get-coordinator-context.ps1
  participant Hub as TTSHubCoordinator
  participant Speak as speak-summary.ps1
  participant Gen as POST_generate
  participant UI as CursorIntegrationPanel

  Agent->>Ctx: conversation_id, workspace
  Ctx->>Hub: GET /cursor/coordinator/context
  Hub-->>Ctx: narrative_hints, speak_policy
  Ctx-->>Agent: JSON hints dla raportu
  Agent->>Agent: odpowiedź + blok tts-summary (raport Makłowicza)
  Agent->>Speak: SummaryText, ConversationId
  Speak->>Hub: POST /cursor/coordinator/submit
  alt action=speak
    Hub->>Gen: enqueue TTS (jeden slot globalny)
    Gen-->>UI: generation:ready
  else action=defer
    Hub-->>Speak: queued; bez generate teraz
  else action=skip
    Hub-->>Speak: duplicate/dnd/disabled
  end
  Hub->>Hub: po zakończeniu odtwarzania / job done — drain kolejki
  UI->>Hub: GET sessions + queue (podgląd)
```

## 1. Persona raportu (skill + reguły)

Zaktualizować [`.cursor/skills/tts-hub-speak/SKILL.md`](../skills/tts-hub-speak/SKILL.md) i [`.cursor/rules/cursor-tts-summary.mdc`](../rules/cursor-tts-summary.mdc) (gdy skill aktywny ma pierwszeństwo nad neutralnym tonem):

**Format raportu (subtle Makłowicz):**

- **Osoba:** pierwsza osoba prowadzącego („donoszę”, „w tej części prac”, „utrzymuję wątek”) — nie druga osoba asystenta.
- **Struktura:** 1 zdanie mostu (ciągłość z poprzednim raportem tej lub innej sesji, jeśli koordynator poda hint) → 2–6 zdań meritum → 0–1 zdanie domknięcia.
- **Ton:** spokojny, wyważony, lekki rejestr podróży/kulinarnej metafory tylko szczątkowo (np. „przechodzimy do kolejnego etapu”), **bez** parodii, obelg ani nadmiaru charakterystycznych zwrotów.
- **Zakazy w markerach:** kod, listy, backticki, ścieżki plików wymawiane znak po znaku (użyć opisów: „moduł koordynatora w backendzie”).
- **Długość:** `max_sentences` z integracji Cursor (domyślnie 10).

**Nowy obowiązkowy krok przed pisaniem podsumowania:**

```powershell
pwsh -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ".cursor/skills/tts-hub-speak/scripts/get-coordinator-context.ps1" `
  -ConversationId "<id>" -Workspace "<slug-opcjonalnie>"
```

Agent czyta stdout (JSON): `continuity_hint`, `other_sessions_hint`, `speak_policy` (`normal` | `brief` | `silent`), `queue_depth`. Przy `silent` — krótki raport tekstowy bez wołania `speak-summary` (koordynator i tak może odrzucić).

## 2. Moduł koordynatora w Rust

Nowy plik `src-tauri/src/cursor_speak_coordinator.rs`, podpięty w `lib.rs` i `http_api.rs`.

**Ustawienia** (rozszerzenie `CursorIntegration` lub osobny blok `cursor_speak_coordinator`):

| Pole | Domyślnie | Znaczenie |
|------|-----------|-----------|
| `enabled` | `true` gdy skill Makłowicz | Włącza API koordynatora |
| `cross_session_narrative` | `true` | Hinty z innych aktywnych sesji |
| `max_queue` | `20` | Powyżej → `defer` |
| `session_ttl_hours` | `24` | Czyszczenie martwych sesji |
| `discover_transcripts` | `true` | Skan `agent-transcripts` przy rejestracji |

**Tabele w `db.rs`** (migracje jak istniejące `ALTER`):

- `cursor_speak_sessions`: `conversation_id`, `workspace`, `title`, `last_seen_at`, `last_report_text`, `last_report_at`
- `cursor_speak_queue`: `id`, `conversation_id`, `summary_text`, `summary_hash`, `status` (`pending`|`generating`|`done`|`skipped`|`deferred`), `created_at`, `generation_id` nullable

**Logika `submit`:**

1. Rejestracja/odświeżenie sesji (`register`).
2. Dedupe **per `conversation_id`** (SHA1 tekstu).
3. Szanuj `dnd_until_ts` z `CursorIntegration` → `skip`.
4. Jeśli globalny slot zajęty (`generating` lub flaga „playback busy” zgłaszana przez frontend) → `defer`, wpis `pending`.
5. Jeśli wolny → `speak`: wywołanie istniejącego `enqueue_request` z `source: cursor-skill`, aktualizacja `last_report_*`.
6. **Drain:** po `job:done` / evencie z frontendu (`POST /cursor/coordinator/playback-idle`) — pobierz najstarszy `pending`, jeden na raz.

**Endpointy HTTP** (dokumentacja w `docs/API.md`):

| Metoda | Ścieżka | Rola |
|--------|---------|------|
| `GET` | `/cursor/coordinator/context` | Hinty narracyjne + `speak_policy` + `queue_depth` |
| `POST` | `/cursor/coordinator/register` | Rejestracja sesji (+ opcjonalny skan transkryptów) |
| `POST` | `/cursor/coordinator/submit` | `{ conversation_id, summary_text, workspace? }` → `{ action, queue_id?, reason? }` |
| `POST` | `/cursor/coordinator/playback-idle` | Sygnał z UI: można zdjąć kolejną pozycję |
| `GET` | `/cursor/coordinator/sessions` | Lista sesji + skrót ostatniego raportu |
| `GET` | `/cursor/coordinator/queue` | Kolejka |
| `DELETE` | `/cursor/coordinator/queue` | Wyczyść pending (awaryjnie) |

**Odkrywanie innych sesji:** przy `register` / `context` — przeszukaj `cursor_dir()/projects/*/agent-transcripts/*/*.jsonl` (wzór z `.cursor-hooks/cursor-tts.ps1`), filtruj `LastWriteTime` w TTL, dopasuj sesje już w DB lub heurystykę „ostatnia linia assistant z markerem tts-summary” (opcjonalnie, fail-open).

## 3. Skrypty PowerShell skillu

| Plik | Zmiana |
|------|--------|
| `get-coordinator-context.ps1` | **Nowy** — resolve `conversation_id`, `GET context`, wypisz JSON na stdout |
| `resolve-conversation-id.ps1` | **Nowy** — wspólna logika: env `CURSOR_TRANSCRIPT_PATH`, skan `agent-transcripts` dla bieżącego workspace |
| `speak-summary.ps1` | Zamiast bezpośredniego `POST /generate`: `POST submit`; przy `speak` — generate jak dziś; przy `defer`/`skip` — log; usunąć globalny dedupe lub ograniczyć do fallback gdy coordinator wyłączony |
| `config.json.example` | `use_coordinator: true`, `persona: "maklowicz_subtle"` |

## 4. UI — Integracja Cursor

Rozszerzyć `src/components/CursorIntegrationPanel.tsx`:

- Sekcja **„Koordynator raportów”**: przełącznik, `cross_session_narrative`, podgląd tabeli sesji i kolejki (poll `GET` co 5 s gdy panel otwarty).
- Przyciski: wyczyść kolejkę, oznacz sesję nieaktywną.
- W `src/api/tauri.ts` lub bezpośredni `fetch` do `LOCAL_API_BASE` — klient HTTP dla nowych endpointów.

**Integracja z odtwarzaniem:** w `App.tsx` / listenerze `generation:ready` dla `cursor-skill` — po `audio ended` (`usePlaybackQueue`) wywołać `playback-idle`, żeby koordynator mógł odpalić następny `generate`.

## 5. Dokumentacja i config

- `docs/CURSOR_SKILL.md` — nowy workflow 3 kroków, persona, koordynator.
- `README.md` — krótki akapit o wielosesyjnych raportach.
- Przykładowy fragment raportu w `SKILL.md` (bez kodu w markerach).

## 6. Weryfikacja (ręczna)

1. Dwa czaty z `@tts-hub-speak` — równoległe tury: drugi dostaje `defer`, po zakończeniu audio pierwszego — drugi `speak`.
2. Ta sama sesja, identyczny tekst — `skip`.
3. DND w panelu — `skip` + brak generate.
4. `GET context` zwraca `other_sessions_hint` po aktywności w drugim czacie.
5. Raport brzmi jak prowadzący (1. os.), nawiązuje do hintu, bez list w markerach.

## Ryzyka i ograniczenia

- **Agent musi wykonać skrypty** — jak dziś; koordynator nie wymusza hooków.
- **ID rozmowy:** gdy brak — fallback `workspace-default`; UI pokazuje ostrzeżenie.
- **Prywatność:** skan transkryptów tylko lokalnie, tylko metadane + skróty raportów w DB użytkownika.
- **Subagenty:** nie dziedziczą skillu — poza zakresem unless osobna reguła.

## Kolejność implementacji

1. DB + `cursor_speak_coordinator.rs` + endpointy + drain po job done.
2. `resolve-conversation-id` + `get-coordinator-context` + zmiana `speak-summary`.
3. SKILL + reguły + docs.
4. UI panel + `playback-idle` hook.
5. Testy ręczne wielosesyjne.
