# TTS Hub — specyfikacja produktu

Wersja dokumentu: **0.1.0** · maj 2026

## 1. Cel produktu

**TTS Hub** to aplikacja desktopowa (Windows/macOS/Linux) do syntezy mowy przez **Google Gemini TTS**, **MiniMax** i lokalny **Voice Box**, z interfejsem do pracy ręcznej oraz **lokalnym API HTTP** do automatyzacji.

## 2. Stos technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Shell | Tauri 2 |
| Backend | Rust (tokio, axum, rusqlite, reqwest) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| TTS | Google Generative Language API (modele `*-tts*`), MiniMax, Voice Box |
| Historia | SQLite (`history.db`) |
| Konwersja audio | WAV natywnie; MP3/OGG przez `ffmpeg` |

## 3. Układ interfejsu

Proporcje siatki (desktop):

```
┌──────────────────────────────┬─────────────┐
│  Panel główny (~75%)         │  Sidebar    │
│  · ustawienia TTS            │  (~25%)     │
│  · próbki głosów             │  Sesja /    │
│  · edytor tekstu             │  Archiwum   │
├──────────────────────────────┤             │
│  Pasek odtwarzania (~10%)    │             │
│  · waveform + sterowanie     │             │
└──────────────────────────────┴─────────────┘
```

## 4. Funkcje użytkownika

### 4.1 Generacja

- Tryb **single-speaker** lub **multi-speaker** (dialog z etykietami mówców w tekście).
- Wybór **modelu TTS** (lista z API Google + fallback lokalny).
- **~30 głosów** (Zephyr, Kore, Puck, …).
- Opcjonalny **prompt stylu** (np. „Powiedz to spokojnie szeptem”).
- Skrót **Ctrl+Enter** do generacji.
- Pasek postępu generacji (szacowany czas wg długości tekstu).
- **Profile głosu** — zapisany zestaw providera, modelu, głosu, stylu i parametrów providera; kliknięcie profilu uruchamia generację z tekstu edytora. Szczegóły: [VOICE_WORKFLOWS.md](./VOICE_WORKFLOWS.md).

### 4.2 Odtwarzanie

- **Waveform** z seekiem, czasem, głośnością i wyciszeniem; trzy tryby wizualizacji (słupki, słupki szczegółowe, linia fali), wybór w ustawieniach Wygląd, menu PPM na timeline lub domyślnie ze skórki (`preferences.timeline_view`).
- **Wybór wyjścia audio** w pasku tytułu i panelu odtwarzania; WebView2 używa `setSinkId`, a Windows ma fallback listy WASAPI. Szczegóły: [VOICE_WORKFLOWS.md](./VOICE_WORKFLOWS.md).
- Metadane: model, głos, format, statystyki tekstu (znaki, słowa, tempo).
- Nawigacja po sesji (indeks X/Y).

### 4.3 Historia

- **Sesja** — niezarchiwizowane generacje w folderze `temp/` (bieżące uruchomienie oraz poprzednie, do limitu `temp_history_max` w ustawieniach). Lista w UI jest pogrupowana po sesjach (bieżąca na górze) i datach. Bieżąca sesja nie jest obcinana przez limit; najstarsze pozycje z poprzednich uruchomień są usuwane przy przekroczeniu limitu.
- **Archiwum** — trwałe zapisy po akcji „Zapisz do archiwum”.
- Edycja tytułu, rozwijany tekst, czas względny.
- Akcje: Odtwórz, Zapisz (format z ustawień), Usuń, Pokaż w eksploratorze.
- Opcja: kliknięcie w kartę = odtwarzanie.

### 4.4 Próbki głosów

- Krótka fraza TTS per głos, **cache lokalny** per model.
- Odtwarzanie pojedynczej próbki lub **batch** wszystkich (zdarzenie postępu).

### 4.5 Ustawienia zaawansowane

- Profile **API key** (wiele kluczy + aktywny profil; fallback: `studios.env`).
- Tryb zapisu: **ręczny** / **automatyczny** do archiwum.
- Format zapisu: WAV / MP3 / OGG.
- Własne ścieżki folderów **temp** i **archive**.
- **Maks. generacji w historii sesji (temp)** — limit globalny dla poprzednich uruchomień (domyślnie 100, zakres 10–500).
- **Szybkie skróty TTS** — globalne presety dla zaznaczonego tekstu; mogą wskazywać zapisany profil głosu.
- **Safe Mode** — nowe joby zatrzymywane w statusie `pending_approval` do ręcznego lub HTTP-owego zatwierdzenia.
- **Rozszerzenia** — wbudowany soundboard z 8 slotami, plikami lub generacjami z historii oraz skrótami globalnymi.

### 4.6 Roleplay i czat

- **Roleplay** — wielogłosowe projekty z paletą postaci, segmentami i kolejką generowania do późniejszego odsłuchu/miksu.
- **Czat** — sesje rozmów (`chat_sessions`) i wiadomości (`chat_messages`) mogą linkować wygenerowane audio, profil głosu oraz źródło integracji.
- **Atrybucja origin** — zewnętrzne klienty HTTP mogą oznaczać generacje wolnym `origin.kind` (np. `telegram`, `discord`, `webhook`, `cli`) i potem pobierać własną historię.

## 5. Modele TTS (domyślny zestaw)

| Id API | Etykieta UI |
|--------|-------------|
| `gemini-3.1-flash-tts-preview` | Gemini 3.1 Flash TTS (Preview) |
| `gemini-2.5-flash-preview-tts` | Gemini 2.5 Flash Preview TTS |
| `gemini-2.5-pro-preview-tts` | Gemini 2.5 Pro Preview TTS |

Lista może być rozszerzana dynamicznie przez API Google.

## 6. Dane i pliki

| Ścieżka | Zawartość |
|---------|-----------|
| `%APPDATA%/TTS_hub/temp/` | Audio sesji (czyszczone przy starcie) |
| `%APPDATA%/TTS_hub/archive/` | Archiwum trwałe |
| `%APPDATA%/TTS_hub/history.db` | SQLite |
| `%APPDATA%/TTS_hub/voice_samples/` | Cache próbek głosów |
| `%APPDATA%/TTS_hub/settings.json` | Ustawienia aplikacji |
| `%APPDATA%/TTS_hub/plugins/soundboard.json` | Konfiguracja slotów soundboarda |
| `%APPDATA%/TTS_hub/plugins/soundboard/` | Kopie plików przypisanych ręcznie do soundboarda |

## 7. Lokalne API

Szczegóły: [API.md](./API.md) — port **8765**, brak auth, tylko loopback. Publiczny kontrakt obejmuje generowanie, historię, foldery, kolejkę jobów (`/jobs/*`), zatwierdzanie Safe Mode, sesje czatu (`/chat/*`), lokalny licznik użycia (`/usage`) i feedy dla zewnętrznych originów.

## 8. Wymagania niefunkcjonalne

- Generacja **asynchroniczna** (Rust) — UI nie blokuje się na czas TTS.
- Klucz API **poza repozytorium** (`studios.env`, gitignored).
- Release Rust: LTO, `opt-level = "s"`, strip symboli.

## 9. Ograniczenia znane

- Wymaga aktywnego konta Google AI Studio i limitów API.
- MP3/OGG zależą od zewnętrznego `ffmpeg`.
- API HTTP bez uwierzytelnienia — przeznaczone wyłącznie na localhost.
- Frontend w przeglądarce (sam Vite) **nie** udostępnia `invoke` Tauri — pełna funkcjonalność tylko w oknie aplikacji.

## 10. Roadmap (sugestie po v0.1)

- [ ] Naprawa buildu produkcyjnego TypeScript (`captureStream`).
- [ ] Testy integracyjne API.
- [ ] CI (build + lint).
- [ ] Oficjalna licencja open source.
- [ ] Instalator z podpisem kodu (Windows).
- [ ] **Node Audio Routing** — node-owy edytor routingu audio + realtime mixer (`cpal`) + wirtualny mikrofon przez auto-detekcję VB-CABLE/VoiceMeeter. Node'y: TTS / mic / file / loopback → gain / mixer / ducking / EQ-comp-gate → speakers / file / virtual mic. Plan: [.cursor/plans/node-audio-routing.plan.md](../.cursor/plans/node-audio-routing.plan.md).
- [ ] **VS Code / Cursor extension (TTS Hub)** — opcjonalna migracja cienkiej integracji z hook/skill do rozszerzenia VS Code: wykrywanie `<!-- tts-summary -->`, wywołanie lokalnego API Hub, status bar i ustawienia; logika syntezy pozostaje w aplikacji. Etapy: kryteria go/no-go → kontrakt API → MVP → współistnienie ze starym trybem → ewentualna dystrybucja VSIX. Plan: [.cursor/plans/vscode-cursor-extension.plan.md](../.cursor/plans/vscode-cursor-extension.plan.md).
