---
name: tts-hub-speak
description: Sends Polish response summaries to local TTS Hub via HTTP API (MiniMax, Gemini, VoiceBox). Use when the user activates TTS Hub speech for Cursor replies, wants spoken summaries after each turn, or mentions @tts-hub-speak.
disable-model-invocation: true
---

# TTS Hub Speak (Cursor skill)

## When active

Only while this skill is enabled for the session (user invoked `@tts-hub-speak` or asked for spoken summaries via TTS Hub).

## Every summarizing reply

Including **intermediate** updates (checkpoints, status, partial wrap-ups) — not only the final message.

End the user-visible reply with a Polish summary wrapped in markers (no code or bullet lists inside):

```html
<!-- tts-summary -->
Krótkie, naturalne podsumowanie po polsku (1–10 zdań).
<!-- /tts-summary -->
```

Rules:

- Polish, second person (“zrobiłem…”, “możesz teraz…”).
- No code fences, backticks, or markdown lists inside the markers.
- Do not repeat the full answer — only key outcomes, warnings, and next step.

## Mandatory step at end of each turn

After writing the reply (including markers), run from the **workspace root**:

```powershell
pwsh -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ".cursor/skills/tts-hub-speak/scripts/speak-summary.ps1" -SummaryText "<plain text from between tts-summary markers, one line or escaped>"
```

Optional: `-ConversationId "<id>"` if known.

- Use the exact summary text (not the full response).
- **Fail-open**: if the script fails or TTS Hub is down, continue — do not block the user.
- The script deduplicates identical summaries; do not skip the call unless there is no summary block.

## Requirements

- TTS Hub running (`npm run tauri dev`) — HTTP API on `http://127.0.0.1:8765`.
- Copy `config.json.example` → `config.json` in this skill folder.
- Provider keys: `MINIMAX_API_KEY`, `GOOGLE_API_KEY` in `studios.env` / app settings; Voice Box server for `voicebox` preset.

## Configuration (hybrid)

| Source | Role |
|--------|------|
| `config.json` | `active_preset` (`minimax` / `google` / `voicebox`), `prefer_app_config` |
| `GET /cursor/config` | When `prefer_app_config: true` and integration enabled — overrides provider/model/voice from TTS Hub app |

Switch preset without the app: edit `active_preset` in `config.json`.  
Switch with the app: Cursor integration panel in TTS Hub (Ustawienia zaawansowane).

## Do not use hooks for TTS in this mode

If Cursor hooks (`cursor-tts.ps1`) are installed, disable them or uninstall to avoid double playback. This skill replaces hook timing (per-turn vs end-of-session).

## Reference

- Script: [scripts/speak-summary.ps1](scripts/speak-summary.ps1)
- Docs: [docs/CURSOR_SKILL.md](../../../docs/CURSOR_SKILL.md)
