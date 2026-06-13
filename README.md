<div align="center">

<img src="docs/logo.svg" alt="TTS Hub" width="280" />

**Desktopowa aplikacja TTS — Google Gemini · MiniMax · Voice Box**

*Open source ([MIT](LICENSE)) · klucze API są Twoje (BYOK)*

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Release](https://img.shields.io/badge/release-v0.1.0-orange)](https://github.com/xcwajdax/TTS_hub/releases/tag/v0.1.0)

[Pobierz](#pobierz) · [Szybki start](#szybki-start) · [Dokumentacja](#dokumentacja)

</div>

<p align="center">
  <img src="docs/screenshots/main-window.png" alt="TTS Hub — główne okno aplikacji" width="920" />
</p>

---

## Czym jest TTS Hub?

Natywna aplikacja desktopowa ([Tauri 2](https://tauri.app/) + React + Rust), która zamienia tekst na mowę przez **Google Gemini TTS**, **MiniMax** lub lokalny **Voice Box**. UI po polsku, profile głosu, historia generacji i **lokalne API HTTP** na `127.0.0.1:8765` — do skryptów, n8n, Cursora i własnych narzędzi.

## Funkcje

- **Providery:** Google Gemini · MiniMax · Voice Box (lokalny)
- **UI:** edytor blokowy, kolejka generacji, waveform z seekiem, archiwum historii
- **Roleplay i czat:** wielogłosowe skrypty, sesje głosowe z agentem
- **Integracje:** REST API na localhost, skill/hooki Cursor, globalne skróty TTS (Windows)
- **Eksport:** WAV natywnie; MP3/OGG przez `ffmpeg`

## Pobierz

**[Release v0.1.0](https://github.com/xcwajdax/TTS_hub/releases/tag/v0.1.0)** — Windows x64:

| Plik | Opis |
|------|------|
| [Instalator NSIS](https://github.com/xcwajdax/TTS_hub/releases/download/v0.1.0/TTS.Hub_0.1.0_x64-setup.exe) | zalecany |
| [MSI](https://github.com/xcwajdax/TTS_hub/releases/download/v0.1.0/TTS.Hub_0.1.0_x64_en-US.msi) | pakiet MSI |

Po instalacji skopiuj `studios.env.example` → `%USERPROFILE%\.tts_hub\` albo użyj **Szybkiej konfiguracji** w aplikacji.

## Szybki start

**Wymagania:** Windows 10/11 · Node.js ≥ 18 · Rust stable · WebView2

```powershell
copy studios.env.example studios.env   # GOOGLE_API_KEY=...
npm install
npm run tauri dev
```

Aplikacja startuje z API na **`http://127.0.0.1:8765`**. Build instalatora: `npm run tauri build`.

## Dokumentacja

| | |
|---|---|
| [docs/QUICK_SETUP.md](docs/QUICK_SETUP.md) | konfiguracja providerów |
| [docs/API.md](docs/API.md) | referencja HTTP API |
| [docs/CURSOR_SKILL.md](docs/CURSOR_SKILL.md) | integracja z Cursorem |
| [docs/SPECIFICATION.md](docs/SPECIFICATION.md) | pełna specyfikacja |
| [docs/samples/](docs/samples/) | próbki audio (różne głosy) |
| [docs/screenshots/](docs/screenshots/) | zrzuty ekranu |

Szczegóły kosztów, danych lokalnych i zasad wkładu: [docs/PROJECT_GUIDELINES.md](docs/PROJECT_GUIDELINES.md).

## Licencja

[Kod źródłowy](LICENSE) — **MIT**. Koszty API providerów (Google, MiniMax itd.) ponosisz osobno według ich regulaminów.
