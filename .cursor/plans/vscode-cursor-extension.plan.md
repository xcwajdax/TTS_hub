---
name: VS Code / Cursor extension (TTS Hub)
overview: Opcjonalna migracja cienkiej integracji Cursor (hook/skill) do rozszerzenia VS Code — logika TTS pozostaje w TTS Hub i lokalnym API; extension to adapter UX i zdarzeń edytora.
todos:
  - id: decision_gate
    content: "Kryteria go/no-go — czy extension zastępuje skill/hook (dystrybucja, UX, debug, podwójne odtwarzanie)"
    status: pending
  - id: api_contract
    content: "Ustabilizować kontrakt localhost (health, cursor config, generate z source cursor-extension)"
    status: pending
  - id: extension_mvp
    content: "MVP rozszerzenia — wykrywanie markerów tts-summary, komenda speak, status bar, ustawienia preset"
    status: pending
  - id: coexistence
    content: "Tryb współistnienia z hook/skill — przełącznik wyłączający duplikaty; dokumentacja migracji"
    status: pending
  - id: distribution
    content: "Opcjonalnie — VSIX, wersjonowanie, README marketplace (po walidacji wewnętrznej)"
    status: pending
isProject: false
---

<!-- tts-summary -->
Planujemy powierzchowną ścieżkę od obecnych hooków i skilla Cursor do opcjonalnego rozszerzenia VS Code. Logika syntezy zostaje w TTS Hub i API na localhost, a rozszerzenie ma być cienkim adapterem zdarzeń i ustawień. Najpierw ustalamy kryteria przejścia, potem MVP wykrywania podsumowań i wywołania API, na końcu współistnienie ze starym trybem i ewentualna dystrybucja. Szacunek to kilka tygodni rozłożonych w czasie, bez pilnej implementacji.
<!-- /tts-summary -->

# VS Code / Cursor extension dla TTS Hub (powierzchowny plan)

## Kontekst

Dziś integracja opiera się na:

- **Hook** `.cursor-hooks/cursor-tts.ps1` (zdarzenia sesji agenta),
- **Skill** `@tts-hub-speak` + reguły `cursor-tts-summary` / `cursor-tts-speak-every-block`,
- **Backend** TTS Hub — HTTP `127.0.0.1:8765`, `source: cursor-skill`, autoplay.

Extension **nie zastępuje** TTS Hub — tylko zastępuje lub uzupełnia warstwę „jak Cursor/VS Code woła Hub”.

## Cel

- Stabilniejsze UX (status bar, komendy, ustawienia w `settings.json`).
- Mniej zależności od promptów agenta („czy agent uruchomił skrypt”).
- Możliwość użycia poza samym Cursorem (VS Code + inne forki).
- Łatwiejsze testowanie i debug (Output Channel, logi).

## Zasada architektury

| Warstwa | Odpowiedzialność |
|---------|------------------|
| **TTS Hub (Tauri)** | Synteza, presety, autoplay, historia, `GET/POST` cursor config |
| **Extension** | Wykrywanie `<!-- tts-summary -->`, deduplikacja, `POST /generate`, health check |
| **Agent / reguły** | Opcjonalnie nadal format bloku — extension może czytać output bez wołania `speak-summary.ps1` |

## Kryteria go / no-go (decyzja)

**Zostań przy hook/skill**, jeśli:

- integracja jest wyłącznie dla Ciebie w jednym repo,
- wystarcza obecny przepływ i deduplikacja w `speak-summary.ps1`,
- nie chcesz utrzymywać pakietu VSIX.

**Idź w extension**, jeśli:

- chcesz wyłączyć podwójne odtwarzanie (hook + skill + agent),
- potrzebujesz UI konfiguracji w edytorze,
- planujesz udostępnienie innym (VSIX / marketplace),
- chcesz reagować na zdarzenia edytora bez polegania na agencie.

## Fazy (wysoki poziom)

### Faza 0 — utrzymanie (teraz)

- Hook/skill + dokumentacja [`docs/CURSOR_SKILL.md`](../docs/CURSOR_SKILL.md).
- Brak nowego repozytorium extension.

### Faza 1 — kontrakt API (~1–2 dni robocze, rozproszone)

- Jawny `source` np. `cursor-extension` w `/generate`.
- Health + komunikat gdy Hub nie działa.
- Spójność z `GET /cursor/config` (jak skill).

### Faza 2 — MVP extension (~3–5 dni)

- Osobny folder np. `extensions/tts-hub-cursor/` (TypeScript, `@types/vscode`).
- Ustawienia: URL Hub, preset, włącz/wyłącz autoplay, tryb „tylko końcowa tura” vs „każdy blok”.
- Mechanizm: nasłuch na output czatu / zapisany transcript / command „Speak last summary” (szczegóły API Cursor — do weryfikacji w Fazie 2; możliwy fallback: komenda ręczna + clipboard).
- Status bar: połączony / brak Hub.

### Faza 3 — współistnienie i migracja (~1–2 dni)

- Dokument: wyłącz hook gdy włączony extension.
- Reguły Cursor: skrócić do formatu `tts-summary` bez obowiązku `pwsh speak-summary.ps1`.
- Test: brak podwójnego TTS przy `@cursor-tts-speak-every-block`.

### Faza 4 — dystrybucja (opcjonalnie, później)

- VSIX lokalny → ewentualnie Open VSX / Marketplace.
- Niezależne wersjonowanie od TTS Hub.

## Ryzyka

- **Cursor API** — pełny dostęp do streamu agenta może być ograniczony vs hook; MVP może wymagać komendy ręcznej lub integracji z plikami transcript.
- **Podwójne TTS** — bez wyraźnego przełącznika hook + extension + agent.
- **Scope creep** — logika filtrów/presetów musi zostać w Hub, nie w extension.

## Powiązane dokumenty

- [docs/CURSOR_SKILL.md](../docs/CURSOR_SKILL.md)
- [docs/API.md](../docs/API.md)
- Roadmap: [docs/SPECIFICATION.md §10](../docs/SPECIFICATION.md)

## Weryfikacja (gdy implementacja)

1. Hub OFF → extension pokazuje błąd, brak crashu.
2. Jeden blok `tts-summary` → jedno odtwarzanie.
3. Hook wyłączony, skill bez `speak-summary.ps1` → nadal działa przez extension.
4. Preset z aplikacji (`/cursor/config`) respektowany gdy włączone.
