# TTS Hub v0.1.0 (pre-release)

**Data buildu:** 2026-05-23 · **Platforma:** Windows x64

## Pobierz

| Instalator | Link |
|------------|------|
| **Setup (NSIS)** — zalecany | [TTS-Hub-0.1.0-x64-setup.exe](https://github.com/xcwajdax/TTS_hub/releases/download/v0.1.0/TTS.Hub_0.1.0_x64-setup.exe) (~3,7 MB) |
| **MSI** | [TTS-Hub-0.1.0-x64.msi](https://github.com/xcwajdax/TTS_hub/releases/download/v0.1.0/TTS.Hub_0.1.0_x64_en-US.msi) (~4,9 MB) |

## Wymagania

- Windows 10/11 (x64)
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (na Win 11 zwykle wbudowany)
- Własne klucze API: Google AI Studio, opcjonalnie MiniMax / Voice Box — patrz [QUICK_SETUP.md](QUICK_SETUP.md)

## Po instalacji

1. Uruchom **TTS Hub** z menu Start.
2. Przejdź **Szybką konfigurację** (providery + test API).
3. Lokalne API: `http://127.0.0.1:8765` (tylko localhost).

## Uwagi

- Wersja **preview** — modele Google TTS mogą się zmieniać.
- **MP3/OGG** — opcjonalnie `ffmpeg` w PATH.
- Integracja Cursor: [CURSOR_SKILL.md](CURSOR_SKILL.md)

## Ze źródeł

```powershell
git clone https://github.com/xcwajdax/TTS_hub.git
cd TTS_hub
npm install
npm run tauri build
```
