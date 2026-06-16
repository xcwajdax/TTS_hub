## Summary
- Import MIT fork of `jamiepine/voicebox` **backend/** at v0.4.1 into `voicebox-backend/`
- Upstream transparency: [voicebox#749](https://github.com/jamiepine/voicebox/issues/749), [voicebox#750](https://github.com/jamiepine/voicebox/pull/750)
- TTS Hub identifies as Voicebox client (`User-Agent`, `X-Voicebox-Client-Id: tts-hub`)
- `voicebox_server` status module + contract test script + dev launcher

## Not in this PR
- Bundled PyInstaller sidecar in installer (Faza 4)
- Prefer merge after ≥24h from upstream heads-up (#749)

## Test plan
- [ ] `pwsh -File scripts/dev/start-voicebox-backend.ps1` (after venv + pip install)
- [ ] `pwsh -File scripts/test-voicebox-contract.ps1`
- [ ] TTS Hub Voice Box tab connects to `:17493`

## Docs
- [docs/VOICEBOX_FORK.md](docs/VOICEBOX_FORK.md)
