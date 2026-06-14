<div align="center">

<img src="docs/logo.svg" alt="TTS Hub" width="280" />

**Desktopowa aplikacja TTS — Google Gemini · MiniMax · Voice Box**

*Open source ([MIT](LICENSE)) · klucze API są Twoje (BYOK)*

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Release](https://img.shields.io/badge/release-v0.1.0-orange)](https://github.com/xcwajdax/TTS_hub/releases/tag/v0.1.0)

[Pobierz](#pobierz) · [Szybki start](#szybki-start) · [Roadmapa](#roadmapa) · [Dokumentacja](#dokumentacja)

</div>

<p align="center">
  <img src="docs/screenshots/main-window.png" alt="TTS Hub — edytor TTS, profile głosu, historia generacji i waveform" width="920" />
</p>

<p align="center">
  <video src="https://github.com/xcwajdax/TTS_hub/raw/main/docs/promo/video/readme-demo.mp4" width="480" controls playsinline />
  <br />
  <sub><em>Demo narracji — TTS Hub · robert_maklowicz · karaoke inline</em></sub>
</p>

---

## Czym jest TTS Hub?

Natywna aplikacja desktopowa ([Tauri 2](https://tauri.app/) + React + Rust), która zamienia tekst na mowę przez **Google Gemini TTS**, **MiniMax** lub lokalny **Voice Box**. UI po polsku, profile głosu, historia generacji i **lokalne API HTTP** na `127.0.0.1:8765` — do skryptów, n8n, Cursora i własnych narzędzi.

## Funkcje

- **Providery:** Google Gemini · MiniMax · Voice Box (lokalny)
- **UI:** edytor wielozakładkowy, kolejka generacji, waveform z seekiem, karaoke inline (MiniMax), archiwum historii
- **Roleplay i czat:** wielogłosowe skrypty, sesje głosowe z agentem
- **Integracje:** REST API na localhost, skill/hooki Cursor, globalne skróty TTS (Windows), pakiety głosów
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
| [docs/VOICEBOX_FORK.md](docs/VOICEBOX_FORK.md) | fork backendu [Voicebox](https://github.com/jamiepine/voicebox) (MIT, sidecar) |
| [docs/API.md](docs/API.md) | referencja HTTP API |
| [docs/CURSOR_SKILL.md](docs/CURSOR_SKILL.md) | integracja z Cursorem |
| [docs/SPECIFICATION.md](docs/SPECIFICATION.md) | pełna specyfikacja |
| [docs/samples/](docs/samples/) | próbki audio (różne głosy) |
| [docs/screenshots/](docs/screenshots/) | zrzuty ekranu |
| [docs/promo/video/readme-demo.mp4](docs/promo/video/readme-demo.mp4) | demo narracji (README) |

Szczegóły kosztów, danych lokalnych i zasad wkładu: [docs/PROJECT_GUIDELINES.md](docs/PROJECT_GUIDELINES.md).

## Roadmapa

### v0.1.0 — dostępne teraz

- Windows x64 (NSIS + MSI), licencja MIT
- Providery: Google Gemini · MiniMax · Voice Box (zewnętrzny serwer)
- Edytor, kolejka, waveform, historia z archiwum i foldery
- Roleplay, czat głosowy, licznik zużycia per provider
- Integracja Cursor (skill + hooki), lokalne API `:8765`
- Skórki UI: VIBELIFE · Matrix · Light Zen

### W toku

| Temat | Status |
|-------|--------|
| **Fork backendu Voicebox** (`v0.4.1`, MIT) | kod w [`feat/voicebox-backend-fork`](https://github.com/xcwajdax/TTS_hub/tree/feat/voicebox-backend-fork/voicebox-backend) — bundlowanie sidecar w instalatorze |
| **Upstream Voicebox** | heads-up opublikowany — [voicebox#749](https://github.com/jamiepine/voicebox/issues/749) |
| **Klient HTTP Voicebox** | `User-Agent: TTS-Hub/…`, `X-Voicebox-Client-Id: tts-hub` |

### Planowane (kolejność orientacyjna)

- Sidecar Voice Box bez osobnej instalacji Voicebox
- CI: build frontend + `cargo check`, lint
- Testy integracyjne lokalnego API
- Rozszerzenie VS Code / Cursor (opcjonalna migracja z hooków) — [plan](.cursor/plans/vscode-cursor-extension.plan.md)
- Node Audio Routing — mixer TTS / mic / loopback — [plan](.cursor/plans/node-audio-routing.plan.md)
- Podpis kodu instalatora Windows
- MCP server w aplikacji

Pełna lista sugestii technicznych: [docs/SPECIFICATION.md §10](docs/SPECIFICATION.md#10-roadmap-sugestie-po-v01).

## Licencja

[Kod źródłowy](LICENSE) — **MIT**. Koszty API providerów (Google, MiniMax itd.) ponosisz osobno według ich regulaminów.

### Voicebox (lokalny silnik TTS)

Lokalny provider **Voice Box** korzysta dziś z [Voicebox](https://github.com/jamiepine/voicebox) jako osobnego serwera HTTP (`:17493`). Fork backendu **v0.4.1** (MIT, tylko `backend/`) jest w branchu [`feat/voicebox-backend-fork`](https://github.com/xcwajdax/TTS_hub/tree/feat/voicebox-backend-fork/voicebox-backend); w toku jest bundlowanie jako sidecar w instalatorze. Szczegóły: [docs/VOICEBOX_FORK.md](docs/VOICEBOX_FORK.md). Heads-up u upstream: [voicebox#749](https://github.com/jamiepine/voicebox/issues/749).
