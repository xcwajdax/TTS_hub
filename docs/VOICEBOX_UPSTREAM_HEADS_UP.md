# Voicebox upstream — heads-up (Faza 0)

Ten plik to **gotowy materiał** do opublikowania u Jamie Pine *przed* pierwszym publicznym commitem z forkem `backend/` Voicebox w TTS Hub.

**Checklist przed publikacją fork:**

- [x] Opublikować Discussion **lub** Issue w [jamiepine/voicebox](https://github.com/jamiepine/voicebox) (tekst poniżej) — **[#749](https://github.com/jamiepine/voicebox/issues/749)**
- [x] Wkleić URL issue/discussion do [VOICEBOX_FORK.md](./VOICEBOX_FORK.md)
- [ ] Odczekać ≥24h (albo odpowiedź autora) przed merge `voicebox-backend/` do `main`
- [x] Zaktualizować README TTS Hub linkiem do discussion
- [x] `User-Agent` + `X-Voicebox-Client-Id: tts-hub` w [`voicebox.rs`](../src-tauri/src/voicebox.rs)
- [ ] Opcjonalnie: pierwszy mały PR upstream (docs / bugfix) z linkiem do discussion — **[PR #750](https://github.com/jamiepine/voicebox/pull/750)**

---

## Wariant A — GitHub Discussion (zalecany)

**Kategoria:** General / Ideas  
**Tytuł:** Heads-up: TTS Hub bundling Voicebox backend (MIT, backend-only)

**Treść (copy-paste):**

```markdown
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
```

---

## Wariant B — GitHub Issue

**Tytuł:** `[Heads-up] TTS Hub plans backend-only Voicebox fork (MIT, bundled sidecar)`

**Labels (jeśli dostępne):** `discussion`, `integration`

Użyj **tej samej treści** co w Discussion powyżej. Issue jest bardziej widoczne w triage; Discussion jest mniej „alarmowe”.

---

## Po opublikowaniu

1. Skopiuj URL do `UPSTREAM_DISCUSSION_URL` w [VOICEBOX_FORK.md](./VOICEBOX_FORK.md).
2. W commicie README / fork dodaj linię:  
   `Upstream heads-up: <URL>`
3. Pierwszy PR do Voicebox (propozycje):
   - **Docs:** wpis „Known integrators → TTS Hub” w `backend/README.md`
   - **Backend:** drobny fix, który już testujecie lokalnie (Windows lifecycle, chunking edge case)
   - W opisie PR: `Related: jamiepine/voicebox#XXX` lub link do Discussion

---

## Posting via GitHub CLI (opcjonalnie)

```powershell
# Discussion (wymaga uprawnień do repo upstream — zwykle przez fork + cross-post lub ręcznie w UI)
gh issue create `
  --repo jamiepine/voicebox `
  --title "Heads-up: TTS Hub bundling Voicebox backend (MIT, backend-only)" `
  --body-file docs/VOICEBOX_UPSTREAM_HEADS_UP-discussion-body.md
```

Przed `gh issue create` wyeksportuj sam blok markdown z sekcji „Treść” do osobnego pliku bez frontmatter.
