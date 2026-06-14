# Voicebox backend — upstream sync

Fork **backend/** only from [jamiepine/voicebox](https://github.com/jamiepine/voicebox) (MIT).

| Field | Value |
|-------|--------|
| Upstream repo | https://github.com/jamiepine/voicebox |
| Start pin | `v0.4.1` (`3c1e8512b9eba4a1b0551c9b66395a72035f115c`) |
| Heads-up | https://github.com/jamiepine/voicebox/issues/749 |
| TTS Hub policy | [docs/VOICEBOX_FORK.md](../docs/VOICEBOX_FORK.md) |

## Remotes

```bash
git remote add voicebox-upstream https://github.com/jamiepine/voicebox.git
git fetch voicebox-upstream --tags
```

## Initial import (when gate elapsed)

```bash
git subtree add --prefix=voicebox-backend voicebox-upstream v0.4.1 --squash
# Remove non-backend paths if full tree was pulled; keep backend/, scripts/, requirements.txt
```

## Ongoing sync

Every 2–4 weeks: review `voicebox-upstream/main` under `backend/`, cherry-pick engine/CUDA fixes, open PRs upstream for universal improvements.
