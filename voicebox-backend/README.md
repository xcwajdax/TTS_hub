# Voicebox backend (fork)

MIT-licensed FastAPI TTS server from [jamiepine/voicebox](https://github.com/jamiepine/voicebox).

| | |
|---|---|
| Upstream pin | `v0.4.1` (`3c1e851`) |
| Heads-up | https://github.com/jamiepine/voicebox/issues/749 |
| Policy | [docs/VOICEBOX_FORK.md](../docs/VOICEBOX_FORK.md) |

## Dev (standalone)

```powershell
cd voicebox-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
python -m backend.main --host 127.0.0.1 --port 17493
```

TTS Hub connects as HTTP client on `:17493`. Contract smoke test:

```powershell
pwsh -File ../scripts/test-voicebox-contract.ps1
```

Bundled sidecar spawn from TTS Hub is implemented separately in `src-tauri/src/voicebox_server/`.
