# Voicebox upstream sync — runbook (TTS Hub)

Fork policy: [docs/VOICEBOX_FORK.md](../docs/VOICEBOX_FORK.md)  
Upstream heads-up: https://github.com/jamiepine/voicebox/issues/749  
Upstream docs PR (integrator): https://github.com/jamiepine/voicebox/pull/750  

## Cadence

Every **2–4 weeks** (or after upstream security/engine release):

1. Fetch upstream tags and review `backend/` diff.
2. Cherry-pick small fixes; subtree/merge for larger engine additions.
3. Run contract test: `pwsh -File scripts/test-voicebox-contract.ps1`
4. Update pin in `voicebox-backend/UPSTREAM.md` when importing a tag.
5. Open PR to **jamiepine/voicebox** for universal fixes (link discussion #749).

## Commands

```bash
git remote add voicebox-upstream https://github.com/jamiepine/voicebox.git  # once
git fetch voicebox-upstream --tags
git log voicebox-upstream/main -- voicebox-backend/backend/
git cherry-pick <sha>   # backend-only commits
```

## First upstream PR (done / template)

| PR | Purpose |
|----|---------|
| [voicebox#750](https://github.com/jamiepine/voicebox/pull/750) | Document TTS Hub as known HTTP integrator |

**Next candidate PRs** (pick one per sprint):

- Windows lifecycle / port reuse (adapt from TTS Hub `voicebox_server/manager.rs` tests)
- Contract-test helper script contribution to upstream `backend/tests/`
- CORS or chunking fix if reproduced in bundled sidecar

## Breaking API changes

Do **not** change `:17493` endpoints used by TTS Hub without:

1. Updating [`src-tauri/src/voicebox.rs`](../src-tauri/src/voicebox.rs)
2. Extending [`scripts/test-voicebox-contract.ps1`](../scripts/test-voicebox-contract.ps1)
3. Notifying upstream in #749 if shared clients are affected

## Version pins

| Pin | Commit | Notes |
|-----|--------|-------|
| v0.4.1 | `3c1e851` | Initial TTS Hub import |
| v0.5.0+ | TBD | Evaluate after gate merge |
