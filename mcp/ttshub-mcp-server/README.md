# ttshub-mcp-server

Lokalny serwer MCP, który wystawia API aplikacji **TTS Hub** (desktop, HTTP na `127.0.0.1:8765`) jako narzędzia dla klientów MCP (opencode, Cursor, Claude Code itp.).

## Wymagania

- TTS Hub uruchomiony (okno Tauri lub tryb headless) — backend HTTP nasłuchuje na `127.0.0.1:8765`.
- [`uv`](https://docs.astral.sh/uv/) na PATH (do zarządzania zależnościami i uruchamiania w izolowanym venv).

## Uruchomienie ręczne

```powershell
uv run --project mcp/ttshub-mcp-server ttshub-mcp
```

## Konfiguracja opencode (`~/.config/opencode/opencode.jsonc`)

```jsonc
{
  "mcp": {
    "ttshub": {
      "type": "local",
      "command": [
        "uv", "run", "--project",
        "Z:\\VIBELIFE2026\\TTS_hub\\mcp\\ttshub-mcp-server",
        "ttshub-mcp"
      ],
      "enabled": true,
      "environment": {
        "TTSHUB_BASE_URL": "http://127.0.0.1:8765",
        "TTSHUB_DEFAULT_VOICE": "grzegorz_braun",
        "TTSHUB_DEFAULT_MODEL": "minimax:speech-2.8-hd",
        "TTSHUB_ORIGIN_USER_NAME": "opencode-user"
      }
    }
  }
}
```

## Narzędzia MCP

| Narzędzie | Endpoint HTTP | Opis |
|-----------|---------------|------|
| `health` | `GET /health` | Ping backendu. |
| `list_voices` | `GET /voices` | Lista głosów Gemini TTS. |
| `list_minimax_languages` | `GET /minimax/languages` | Języki MiniMax (kody `pl`, `en` itd.). |
| `get_cursor_config` | `GET /cursor/config` | Snapshot konfiguracji integracji Cursor. |
| `preview_text_filter` | `POST /text/filter` | Podgląd filtrów tekstu (bez generacji). |
| `generate_speech` | `POST /generate` | Generacja mowy. Zwraca `Generation` z `audio_url` do `GET /audio/{id}`. |
| `list_history` | `GET /history` | Lista generacji (scope: `session`/`archive`). |
| `archive_generation` | `POST /history/{id}/archive` | Archiwizacja (z konwersją do MP3). |
| `delete_generation` | `DELETE /history/{id}` | Usunięcie generacji. |

## Status

Lokalny wrapper tymczasowy — paczka docelowo opublikowana w PyPI jako `ttshub-mcp-server` (zob. `README.md` TTS Hub §Roadmapa → "MCP server w aplikacji").
