Hi Jamie — heads-up from **[TTS Hub](https://github.com/xcwajdax/TTS_hub)**.

We’re building a desktop TTS workstation (Tauri + Rust, Polish UI) that **already integrates with Voicebox as an HTTP client** on `127.0.0.1:17493` — profiles, `/generate`, history, personality rewrite, etc. Our app does **not** embed ML inference today; users must install Voicebox separately.

### What we’re planning

| Item | Detail |
|------|--------|
| **Scope** | Fork **`backend/` only** (FastAPI + TTS engines) under **MIT**, with full attribution |
| **Distribution** | Bundle as a **sidecar** started by TTS Hub so users get local TTS without a second app install |
| **API** | Keep your **REST contract on :17493** — we won’t silently break existing endpoints |
| **UI** | **Not** shipping Voicebox’s React app, Stories editor, or dictation shell — different product surface |
| **Upstream** | Cherry-pick fixes from `jamiepine/voicebox`; send **PRs back** for universal backend improvements |
| **Identification** | HTTP requests will include `User-Agent: TTS-Hub/… (Voicebox-client)` and `X-Voicebox-Client-Id: tts-hub` |

### What we’re **not** doing

- Rebranding the engine without credit to Voicebox
- Competing with [voicebox.sh](https://voicebox.sh) / the full Voicebox app for voice I/O (STT, dictation, MCP pill, Stories)
- Changing license (stays MIT; `THIRD_PARTY_NOTICES` + upstream link in our repo)

### Why reach out first

TTS Hub focuses on **multi-provider hub** (Google Gemini, MiniMax cloud, local), **Polish UX**, roleplay timelines, and **Cursor automation** on `:8765`. Voicebox is the best local engine we’ve found; we want this to read as **downstream bundling + contribution**, not a surprise fork.

Our draft policy doc (will link your discussion URL once posted):  
https://github.com/xcwajdax/TTS_hub/blob/main/docs/VOICEBOX_FORK.md

### Questions for you

1. Any concerns with a **backend-only MIT fork** bundled as a sidecar?
2. Preferred client id / attribution in docs or server logs?
3. OK if we link **this thread** from our README when the fork lands?
4. If you’d rather we stay **external-client-only** (no bundling), we’ll respect that — just let us know.

Thanks for Voicebox — happy to adjust scope based on your feedback.
