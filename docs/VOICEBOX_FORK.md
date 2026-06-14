# Voicebox backend — polityka fork (TTS Hub)

TTS Hub integruje lokalną syntezę mowy przez silnik **[Voicebox](https://github.com/jamiepine/voicebox)** (MIT, ~30k★). Planujemy **przyjazny fork wyłącznie katalogu `backend/`** (Python FastAPI + silniki TTS), bundlowany jako sidecar na `http://127.0.0.1:17493`.

**Status:** Faza 1 na branchu `feat/voicebox-backend-fork` — backend `v0.4.1` w `voicebox-backend/`; merge do `main` po gate 24h od [#749](https://github.com/jamiepine/voicebox/issues/749).

| Pole | Wartość |
|------|---------|
| Upstream | https://github.com/jamiepine/voicebox |
| Licencja upstream | MIT |
| Pin startowy | `v0.4.1` (backend/) |
| Upstream heads-up | https://github.com/jamiepine/voicebox/issues/749 |
| Upstream docs PR | https://github.com/jamiepine/voicebox/pull/750 |
| Klient HTTP w TTS Hub | [`src-tauri/src/voicebox.rs`](../src-tauri/src/voicebox.rs) |

---

## Co forkujemy

- `backend/` — FastAPI, 7 silników TTS, profile, historia, personality (Qwen3 LLM), opcjonalnie Whisper STT w API
- `scripts/` — build PyInstaller, CUDA backend swap
- `requirements.txt`, fragmenty build (`justfile`)

## Czego **nie** forkujemy

- `app/` — UI Voicebox (TTS Hub ma własny React)
- `tauri/` — shell Voicebox (logikę **spawn serwera** adaptujemy do TTS Hub)
- `landing/`, `web/`

## Relacja produktowa

| Voicebox (upstream) | TTS Hub |
|---------------------|---------|
| Pełny voice I/O studio: STT, dictation, Stories, MCP, efekty | Hub TTS: Google + MiniMax + lokalny silnik |
| voicebox.sh, instalator Voicebox | tts-hub, instalator z sidecarem |
| MCP na `:17493` | Cursor skill + API na `:8765` |

**Rekomendacja użytkownikom:** pełny Voicebox nadal najlepszy do dyktowania, Captures i Stories; TTS Hub — gdy chcesz **wielu providerów + automatyzację + PL UI** z wbudowanym lokalnym TTS.

---

## Atrybucja i compliance (MIT)

- [`LICENSE`](../LICENSE) TTS Hub pozostaje MIT.
- `voicebox-backend/THIRD_PARTY_NOTICES.md` — copyright Jamie Pine / Voicebox contributors + pełna treść licencji MIT upstream.
- README: sekcja „Local engine powered by [Voicebox](https://github.com/jamiepine/voicebox) backend (MIT fork)”.
- Requesty HTTP: `User-Agent: TTS-Hub/<version> (Voicebox-client)` oraz `X-Voicebox-Client-Id: tts-hub` — **wdrożone** w [`voicebox.rs`](../src-tauri/src/voicebox.rs).

---

## Synchronizacja z upstream

```text
git remote add voicebox-upstream https://github.com/jamiepine/voicebox.git
git fetch voicebox-upstream --tags
# cherry-pick / subtree merge tylko backend/
```

**Co 2–4 tygodnie:**

1. Przegląd `voicebox-upstream/main` pod kątem `backend/`
2. Cherry-pick fixów silników, CUDA, bezpieczeństwa
3. PR do upstream dla uniwersalnych poprawek (z linkiem do discussion)

**Breaking changes API:** tylko po uzgodnieniu lub wersjonowaniu; regression: [`scripts/test-voicebox-contract.ps1`](../scripts/test-voicebox-contract.ps1).

---

## Kontrakt API (TTS Hub ↔ sidecar)

Endpointy używane dziś przez TTS Hub — **nie zmieniamy bez aktualizacji klienta**:

| Endpoint | Użycie |
|----------|--------|
| `GET /health` | onboarding, status sidecar |
| `GET/POST/PUT/DELETE /profiles` | VoiceboxView |
| `POST /profiles/{id}/samples` | próbki klonowania |
| `POST /generate` + poll `/history/{id}` | job queue |
| `GET /audio/{id}` | odtwarzanie |
| `GET /models` | lista silników |

Szczegóły proxy HTTP TTS Hub: [API.md](./API.md#voice-box).

---

## Kontakt / feedback upstream

- Heads-up template: [VOICEBOX_UPSTREAM_HEADS_UP.md](./VOICEBOX_UPSTREAM_HEADS_UP.md)
- Po publikacji discussion: [issue #749](https://github.com/jamiepine/voicebox/issues/749) (2026-06-14).
