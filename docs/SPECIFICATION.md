# TTS Hub — specyfikacja produktu

Wersja dokumentu: **0.1.0** · maj 2026

## 1. Cel produktu

**TTS Hub** to aplikacja desktopowa (Windows/macOS/Linux) do syntezy mowy przez **Google Gemini TTS**, z interfejsem do pracy ręcznej oraz **lokalnym API HTTP** do automatyzacji.

## 2. Stos technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Shell | Tauri 2 |
| Backend | Rust (tokio, axum, rusqlite, reqwest) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| TTS | Google Generative Language API (modele `*-tts*`) |
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

### 4.2 Odtwarzanie

- **Waveform** z seekiem, czasem, głośnością i wyciszeniem.
- Metadane: model, głos, format, statystyki tekstu (znaki, słowa, tempo).
- Nawigacja po sesji (indeks X/Y).

### 4.3 Historia

- **Sesja** — generacje bieżącego uruchomienia (folder `temp/`).
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

## 7. Lokalne API

Szczegóły: [API.md](./API.md) — port **8765**, brak auth, tylko loopback.

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
