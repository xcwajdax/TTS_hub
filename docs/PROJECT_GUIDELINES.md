# Zasady projektu TTS Hub

**Wersja dokumentu:** 1.0 · maj 2026

Ten plik zbiera zasady, które w projektach open source zwykle rozproszone są między `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` i `AGENTS.md`. **TTS Hub jest open source** ([MIT](../LICENSE)). Dokument służy maintainerowi, współpracownikom i agentom AI w Cursorze.

---

## 1. Status i intencja

| Aspekt | Ustalenie |
|--------|-----------|
| **Właściciel** | VIBELIFE2026 / [xcwajdax](https://github.com/xcwajdax) |
| **Licencja** | [MIT](../LICENSE) |
| **`package.json`** | `"private": false` — aplikacja desktop, nie pakiet npm |
| **Repo Git** | Publiczne: https://github.com/xcwajdax/TTS_hub |
| **Kontrybucje zewnętrzne** | Mile widziane (issue, PR); review wg czasu maintainera |

Fork i modyfikacje są zgodne z MIT. Nie commituj sekretów ani kluczy API.

---

## 2. Sekrety i bezpieczeństwo

### Nigdy w repozytorium

- `studios.env` (klucz `GOOGLE_API_KEY`)
- Profile API key z ustawień aplikacji (eksporty, screeny, logi)
- Tokeny, hasła, ścieżki do prywatnych zasobów innych osób

### Zawsze

- Szablon: `studios.env.example` — tylko nazwy zmiennych, bez wartości.
- Przed commitem: `git status` — upewnij się, że `studios.env` nie jest staged.
- Issue / PR / README: zamazuj klucze na zrzutach ekranu.

### Lokalne API (`127.0.0.1:8765`)

- Bez uwierzytelnienia — **tylko na tej samej maszynie**.
- Nie wystawiaj portu na sieć lokalną ani internet bez osobnej warstwy auth (poza zakresem produktu).

### Zgłaszanie luk

Projekt prywatny: nie ma publicznego `SECURITY.md`. Problemy bezpieczeństwa traktuj priorytetowo w issue prywatnym lub notatkach własnych — bez publikacji szczegółów exploitów.

---

## 3. Środowisko deweloperskie

| Wymaganie | Uwagi |
|-----------|--------|
| Node.js ≥ 18 | `npm install` w korzeniu repo |
| Rust stable | `src-tauri/` — `cargo` przez Tauri CLI |
| `studios.env` | Skopiuj z `studios.env.example`, uzupełnij klucz Google AI Studio |
| ffmpeg | Opcjonalnie — tylko eksport MP3/OGG |
| WebView2 | Windows 11 — domyślnie |

**Uruchamianie:** zawsze `npm run tauri dev`, nie sam `npm run dev` — frontend w przeglądarce nie ma mostu Tauri.

**Dane runtime:** `%APPDATA%\TTS_hub\` (temp, archiwum, SQLite, cache próbek). Reset: usuń ten folder.

---

## 4. Workflow zmian (Git)

Projekt może żyć na jednej gałęzi `main` lub krótkich branchach — bez presji „OSS-style”, ale z dyscypliną jakości.

### Gałęzie

- `main` — stabilna, działająca wersja (lub jedyna gałąź robocza).
- `feature/…`, `fix/…` — opcjonalnie, gdy zmiana jest duża lub eksperymentalna.

### Commity

- **Jeden logiczny temat** na commit (funkcja, fix, docs).
- **Po polsku lub po angielsku** — wybierz jeden język w danym commicie i trzymaj się go w repo.
- Przykładowy format: `feat: grupowanie historii po dacie` / `fix: typ captureStream w PlaybackContext`.
- **Nie commituj** artefaktów: `node_modules`, `dist`, `src-tauri/target`, `studios.env`.

### Pull request (dla siebie)

Szablon: [.github/pull_request_template.md](../.github/pull_request_template.md). Używaj go nawet przy samodzielnej pracy — checklista `npm run build` + test w oknie Tauri oszczędza regresje.

### Tagi i release

- Semver: `v0.1.0`, `v0.2.0` — zgodnie z `package.json` / `tauri.conf.json`.
- GitHub Release: **pre-release** dopóki modele Google TTS są w stanie preview.
- Artefakt instalatora: po zielonym `npm run build` i `npm run tauri build`.

---

## 5. Standardy kodu

### Ogólne

- **Minimalny zakres diffu** — nie refaktoryzuj sąsiednich modułów „przy okazji”.
- **Konwencja istniejącego kodu** — nazewnictwo, struktura folderów, styl błędów (`String(e)` w UI, `anyhow` / `thiserror` w Rust — jak w pliku, który edytujesz).
- **Komentarze** — tylko gdy logika biznesowa lub integracja (np. Cursor hooks) nie jest oczywista z kodu.

### Frontend (`src/`)

| Obszar | Zasada |
|--------|--------|
| Język | TypeScript strict; unikaj `any` bez uzasadnienia |
| React | Komponenty funkcyjne; logika w hookach (`hooks/`) lub kontekstach (`context/`) |
| Stan | Tauri commands przez `src/api/tauri.ts` — nie duplikuj wywołań invoke w wielu miejscach |
| Typy | Wspólne typy w `src/types.ts`; modele TTS w `src/ttsModels.ts` |
| Style | Tailwind + `styles.css` — trzymaj spójny dark mode UI |
| UI copy | Polski w interfejsie użytkownika |

### Backend (`src-tauri/src/`)

| Obszar | Zasada |
|--------|--------|
| Moduły | Jedna odpowiedzialność na plik (`google.rs`, `http_api.rs`, `db.rs`, …) |
| Komendy Tauri | Cienka warstwa w `commands.rs`; logika w modułach domenowych |
| Błędy | Zwracaj czytelne komunikaty do frontu; szczegóły techniczne w logach (`eprintln!` / tracing jeśli dodany) |
| SQLite | Migracje i schemat w `db.rs`; nie rozpraszaj zapytań po całym drzewie |
| HTTP API | Zachowaj zgodność z [API.md](API.md); przy zmianie endpointów — aktualizuj dokumentację |

### Integracje

- **Cursor ↔ TTS Hub:** `cursor_integration.rs`, hooki — zmiany testuj z włączoną integracją w ustawieniach.
- **Voicebox:** opcjonalny backend — nie łam głównej ścieżki Gemini TTS.

---

## 6. Testowanie przed uznaniem zmiany za gotową

### Obowiązkowe (każda większa zmiana)

1. `npm run build` — TypeScript + Vite bez błędów.
2. `npm run tauri dev` — przynajmniej jedna ścieżka: generacja → odtwarzanie → historia.
3. Brak regresji API: `curl http://127.0.0.1:8765/health` po starcie aplikacji.

### Zalecane wg obszaru

| Obszar | Co sprawdzić |
|--------|----------------|
| UI / waveform | Seek, głośność, przełączanie sesja/archiwum |
| Historia | Zapis do archiwum, usuwanie, edycja tytułu |
| Ustawienia | Profile API, ścieżki folderów, format zapisu |
| Eksport audio | WAV zawsze; MP3/OGG tylko z ffmpeg w PATH |
| Próbki głosów | Cache w `voice_samples/`, batch |

### Czego jeszcze nie ma (świadomie)

- Brak testów jednostkowych i CI — patrz [PUBLICATION_READINESS.md](PUBLICATION_READINESS.md). Nie blokuj pracy, ale nie udawaj pokrycia testami.

---

## 7. Dokumentacja — kiedy aktualizować

| Zmieniasz… | Zaktualizuj… |
|------------|----------------|
| Endpoint / payload HTTP | [docs/API.md](API.md) |
| Zachowanie produktu / UX | [docs/SPECIFICATION.md](SPECIFICATION.md) |
| Profile głosu / skróty / soundboard / wyjście audio | [docs/VOICE_WORKFLOWS.md](VOICE_WORKFLOWS.md) |
| Widoczny UI, instalacja | [README.md](../README.md), ewentualnie `docs/screenshots/` |
| Gotowość release / blokery | [docs/PUBLICATION_READINESS.md](PUBLICATION_READINESS.md) |
| Zasady pracy (ten dokument) | [docs/PROJECT_GUIDELINES.md](PROJECT_GUIDELINES.md) |

README ma być **wizytówką**, nie duplikatem specyfikacji — linkuj do `docs/`.

---

## 8. Wersjonowanie i kompatybilność

- **Wersja aplikacji:** `package.json` + `src-tauri/tauri.conf.json` — trzymaj zsynchronizowane.
- **Baza SQLite:** przy zmianie schematu — migracja wsteczna lub ścieżka „świeża baza” opisana w commit message.
- **API localhost:** unikaj łamania pól JSON bez potrzeby; przy breaking change podnieś wersję minor i opisz w API.md.

---

## 9. Praca z AI (Cursor)

### Reguły w repozytorium

| Plik | Rola |
|------|------|
| [.cursor/rules/cursor-tts-summary.mdc](../.cursor/rules/cursor-tts-summary.mdc) | Podsumowania PL w markerach `<!-- tts-summary -->` pod TTS |
| Reguły globalne użytkownika (`~/.cursor/rules/`) | Styl odpowiedzi, zakończenia PL — poza repo |

Przy zadaniach w Cursorze **podawaj kontekst**: „TTS Hub, Tauri 2, nie commituj studios.env”.

### Czego nie oczekuj od agenta

- Samodzielnego `git push` / publikacji sekretów.
- Pełnych testów E2E bez uruchomienia `tauri dev`.
- Decyzji licencyjnych — to wyłącznie Twoja decyzja przed publicznym repo.

---

## 10. Czego ten projekt **nie** adoptuje z OSS

Poniższe są zbędne lub mylące dla projektu prywatnego — **nie dodawaj** bez świadomej zmiany statusu:

- ~~`LICENSE` bez decyzji~~ — jest [MIT](../LICENSE)
- `CODE_OF_CONDUCT.md` dla społeczności, której nie ma
- `CONTRIBUTING.md` z instrukcją forka i PR od nieznajomych
- Obowiązek CLA / DCO
- Publiczny backlog jako substitute za własne planowanie

Jeśli kiedyś projekt stanie się **publicznym open source**, wtedy wydziel: `LICENSE`, skrócony `CONTRIBUTING.md` (link do tego dokumentu), opcjonalnie `CODE_OF_CONDUCT.md` i CI — patrz checklistę w [PUBLICATION_READINESS.md](PUBLICATION_READINESS.md).

---

## 11. Mapa dokumentów

```
docs/
├── PROJECT_GUIDELINES.md   ← ten plik (zasady pracy)
├── SPECIFICATION.md        ← co produkt robi
├── API.md                  ← localhost HTTP
├── VOICE_WORKFLOWS.md      ← profile głosu, skróty, soundboard, wyjście audio
├── PUBLICATION_READINESS.md← ocena pod publiczne repo
└── screenshots/            ← zrzuty do README
```

---

## 12. Szybka checklista „czy mogę mergować?”

- [ ] Build: `npm run build` OK
- [ ] Ręczny test w Tauri OK
- [ ] Brak sekretów w diffie
- [ ] Dokumentacja zaktualizowana (jeśli API/UX)
- [ ] Commit message opisuje **dlaczego**, nie tylko **co**

---

*Ostatnia aktualizacja zasad: maj 2026. Propozycje zmian — edycja tego pliku w tym samym PR co zmiana workflow lub konwencji.*
