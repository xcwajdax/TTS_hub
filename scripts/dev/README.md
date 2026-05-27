# Uruchamianie dev (Windows)

Skróty do developerskiej wersji TTS Hub (`npm run tauri dev`).

| Plik | Działanie |
|------|-----------|
| `tts-hub-dev-start.bat` | Uruchamia `npm run tauri dev` w osobnym oknie konsoli |
| `tts-hub-dev-stop.bat` | Zatrzymuje procesy dev (Vite, Tauri, API :8765) |
| `Uruchom TTS Hub (dev).lnk` | To samo co start — **z ikoną logo** (po `create-shortcuts.ps1`) |
| `Zatrzymaj TTS Hub (dev).lnk` | To samo co stop — **z ikoną logo** |

Windows nie pozwala przypisać własnej ikony bezpośrednio plikowi `.bat`. Ikona logo pochodzi ze `src-tauri/icons/icon.ico` i jest ustawiana na skrótach `.lnk`.

## Pierwsze uruchomienie

```powershell
pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File scripts/dev/create-shortcuts.ps1
```

Skrypt startowy tworzy skróty automatycznie, jeśli ich jeszcze nie ma. Możesz skopiować `.lnk` na pulpit — ścieżki są względem repozytorium.

## Klon Makłowicza (MiniMax)

Gdy po synchronizacji zniknie `robert_maklowicz` z listy klonów:

```powershell
pwsh -NoLogo -File scripts/dev/clone-maklowicz.ps1
```

Wymaga: działający TTS Hub (`:8765`), `MINIMAX_API_KEY` w `studios.env`, plik `maklowicz_28s.mp3` w korzeniu repo.

## Wymagania

- Node.js / npm w PATH
- Rust (dla `tauri dev`)
- `npm install` w korzeniu repozytorium
