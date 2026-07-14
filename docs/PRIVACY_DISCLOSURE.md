# Privacy disclosure — local paths and repository hygiene

**Effective:** 2026-07-14  
**Applies to:** [TTS Hub](https://github.com/xcwajdax/TTS_hub) public repository on `main`.

This notice documents a **privacy hygiene audit** of the repository. It follows the same transparency principle as [LEGAL_NOTICE.md](LEGAL_NOTICE.md): we correct problems on current `main`, **do not rewrite Git history**, and keep older commits as an auditable record.

---

## Summary

| Category | Status |
|----------|--------|
| API keys (`GOOGLE_API_KEY`, `MINIMAX_API_KEY`) | **Not exposed** — `studios.env`, `.env`, and TTS `config.json` were never committed |
| App settings with keys (`settings.json`, `history.db`) | **Not in repo** — stored under `%APPDATA%\TTS_hub\` on each machine |
| Local Windows paths | **Were exposed** in some tracked files; **corrected on `main`** (see below) |
| Git history | **Intentionally preserved** — older commits may still contain removed files and old path strings |

---

## What was accidentally public (low severity)

These items revealed **development-machine layout**, not credentials:

1. **`desktop.ini`** — Windows folder icon path containing account name `user` and directory `Documents\VIBELIFE2026\TTS_hub\…`
2. **`.hermes/plans/`** — internal planning notes with absolute paths to this repo and sibling projects
3. **`public/c4d/`** — local Cinema 4D / HDR render assets (125 files) tracked before `.gitignore` took effect
4. **`.cursor/plans/filtr_tryb_kroków_b467cfea.plan.md`** — Cursor plan with markdown links using absolute `c:\Users\user\Documents\VIBELIFE2026\TTS_hub\…` prefixes
5. **`docs/promo/video/work-*/concat.txt`** — ffmpeg concat lists generated with absolute paths during promo video assembly

**Risk level:** informational. A reader could infer a Windows username and folder structure. No API keys, tokens, or passwords were found in tracked source files.

---

## What we did (commits on `main`)

| Commit | Date | Action |
|--------|------|--------|
| [`888dea0`](https://github.com/xcwajdax/TTS_hub/commit/888dea0) | 2026-07-14 | Stop tracking `desktop.ini`, `.hermes/plans/`, `public/c4d/`; extend `.gitignore`; add `.githooks/pre-commit` secret scan |
| [`ce7f1e8`](https://github.com/xcwajdax/TTS_hub/commit/ce7f1e8) | 2026-07-14 | Sanitize absolute paths in Cursor plan; fix promo `assemble-promo-*.ps1` to emit relative `concat.txt`; untrack concat artifacts; extend pre-commit to block `C:\Users\` paths; publish this document |

**Preventive measures now in place:**

- `.gitignore` — `desktop.ini`, `.hermes/`, `public/c4d/`, promo `concat.txt` work files
- `.githooks/pre-commit` — blocks API key patterns, `studios.env` / `.env` / `config.json`, and absolute `C:\Users\` paths
- Maintainer docs — [PROJECT_GUIDELINES.md](PROJECT_GUIDELINES.md) §2

Enable hooks in your clone (one-time):

```bash
git config core.hooksPath .githooks
```

---

## Git history is intentionally NOT rewritten

As with the voice-clone policy in [LEGAL_NOTICE.md](LEGAL_NOTICE.md), **we do not force-push a filtered history**.

Older commits and tags may still contain:

- `desktop.ini` with local paths
- `public/c4d/` binary assets
- Previous versions of `.cursor/plans/` with absolute Windows links
- Promo `concat.txt` with machine-specific paths

This is **deliberate**: it preserves evidence of what was public and when corrections were made.

### If you need a clean public snapshot

- **Fork from current `main`** after the hygiene commits above, or
- Export a release tarball from the latest tag / `main` — do not rely on rewriting this repository's history.

To inspect historical exposure yourself:

```bash
git log --all -- desktop.ini
git show <old-sha>:desktop.ini
```

---

## What users and contributors should do

- **No action required** for security — no leaked API keys were identified.
- **Contributors:** use repo-relative paths in docs and plans; run `git config core.hooksPath .githooks`.
- **Forkers concerned about old binary history:** fork from current `main` only; avoid vendoring ancient commits that still reference `public/c4d/` if size or HDR licensing matters to you.

---

## Contact and tracking

- Open a [GitHub issue](https://github.com/xcwajdax/TTS_hub/issues) for questions about this disclosure.
- A public transparency issue was opened when this document landed on `main` (see issue cross-link in the repository Issues tab).

For voice-clone and third-party likeness policy, see [LEGAL_NOTICE.md](LEGAL_NOTICE.md).
