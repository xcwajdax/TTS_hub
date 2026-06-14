# Upstream PR draft — list TTS Hub as integrator

Open against `jamiepine/voicebox` after [heads-up #749](https://github.com/jamiepine/voicebox/issues/749).

## Suggested change

Add to `backend/README.md` (or new `docs/content/docs/overview/integrators.mdx`):

```markdown
## Known HTTP clients

| Client | Repo | Notes |
|--------|------|--------|
| **TTS Hub** | https://github.com/xcwajdax/TTS_hub | Desktop TTS hub (Google, MiniMax, Voicebox). HTTP client on `:17493`; `X-Voicebox-Client-Id: tts-hub`. Heads-up: [#749](https://github.com/jamiepine/voicebox/issues/749) |
```

## PR title

`docs: add TTS Hub to known HTTP integrators` — **opened:** https://github.com/jamiepine/voicebox/pull/750

## PR body

```markdown
Related to #749 — TTS Hub heads-up on backend bundling.

Adds TTS Hub to documented HTTP integrators. TTS Hub already uses Voicebox as a client (`User-Agent: TTS-Hub/…`, `X-Voicebox-Client-Id: tts-hub`) and documents upstream attribution in [VOICEBOX_FORK.md](https://github.com/xcwajdax/TTS_hub/blob/main/docs/VOICEBOX_FORK.md).

No code changes to Voicebox API.
```

## Commands (manual)

```powershell
gh repo fork jamiepine/voicebox --clone=true --remote=true
cd voicebox
git checkout -b docs/tts-hub-integrator
# edit backend/README.md
git commit -am "docs: add TTS Hub to known HTTP integrators"
git push -u origin docs/tts-hub-integrator
gh pr create --repo jamiepine/voicebox --head xcwajdax:docs/tts-hub-integrator --title "docs: add TTS Hub to known HTTP integrators" --body-file docs/VOICEBOX_UPSTREAM_PR-body.md
```
