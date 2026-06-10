# TTShub MCP Server — Connector for Claude Code, Hermes, Cursor, Codex, OpenClaw

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Dostarczyć serwer MCP (Model Context Protocol) dla TTShub, który wystawia istniejące TTShub HTTP API jako zestaw narzędzi MCP. Każdy harness wspierający MCP (Claude Code, Claude Cowork, Hermes, OpenClaw, Cursor, Codex CLI) może go podpiąć przez `mcp add` i zyskać 4-6 tooli do generowania mowy, listowania głosów, sprawdzania jobów i historii — bez pisania integracji per-harness.

**Architecture:**
- **Osobny serwer w Pythonie** (FastMCP z oficjalnego `mcp` SDK) — `ttshub-mcp-server`, uruchamiany jako subprocess stdio przez każdy harness.
- **NIE rozszerzamy TTShub Rust backendu** — MCP server jest cienkim klientem HTTP TTShub, może być rozwijany niezależnie, deployowany osobno (pip/PyPI albo `uvx`).
- **Transport: stdio** (uniwersalny, obsługiwany przez wszystkie wymienione harnessy). HTTP/SSE opcjonalnie w v0.2.
- **Discovery: katalog z toolami MCP** — `tools/list` zwraca 6 tooli (4 core + 2 utility). Opisy tooli z właściwymi annotacjami `readOnlyHint`, `destructiveHint`, `openWorldHint`.
- **Lifecycle:** startup → handshake `initialize` → load tools z TTShub `/voices` (cached) → ready do `tools/call`.

**Tech Stack:**
- Python 3.11+ (harnessy mają już Pythona; Cursor ma uv, Codex ma uvx)
- `mcp` (oficjalny Python SDK) z `FastMCP` decorator API
- `httpx` async do TTShub HTTP (szybsze niż `requests`, lepsze dla wielu równoległych wywołań)
- `uv` jako package manager (Cursor/Codex CLI preferują uvx; instalacja zero-config)
- `pyproject.toml` z entry point `ttshub-mcp` uruchamiającym `mcp.run(transport="stdio")`

---

## Kontekst / Assumptions

### Co już istnieje
- **TTShub** działa na `127.0.0.1:8765` z endpointami: `/health`, `/voices`, `/jobs`, `/history`, `/generate` (POST), `/usage`, `/minimax/clone-voice`, `/minimax/sync-voices`, `/audio/:id` (GET). Pełna dokumentacja w `media/tts-hub-reference`.
- **5 sklonowanych głosów** w `settings.json`: `wojciech_mann`, `geralt_witcher`, `michal_zebrowski`, `robert_maklowicz`, `grzegorz_braun`. Plus 332 synced z MiniMax.
- **MiniMax provider default footgun** (verified 2026-06-06): jeśli `provider` nie jest explicit, request leci do Google Cloud TTS i 403. MCP server MUSI zawsze wysyłać `provider="minimax"` dla sklonowanych głosów i forwardować explicite podany provider dla reszty.
- **Origin attribution** (commit `bc8fd01`): TTShub wspiera `origin` block w `/generate`. MCP server dodaje `kind: "mcp"` + `user_name` z konfiguracji klienta + workspace path (jeśli harness udostępnia).
- **Harnessy wspierające MCP**:
  - **Claude Code**: `claude mcp add` (scope: user/local/project)
  - **Hermes**: `mcp_servers:` w `~/.hermes/config.yaml`
  - **Cursor**: `.cursor/mcp.json` (workspace) lub global
  - **Codex CLI**: `~/.codex/mcp_servers.json` (od wersji wspierającej MCP)
  - **OpenClaw** (jego własny klient MCP, patrz `mcp/native-mcp` skill)
  - **Claude Cowork** (jeśli wspiera MCP connectors — do zweryfikowania w trakcie)

### Czego NIE robimy
- **NIE dodajemy MCP do TTShub Rust** — oddzielny proces, łatwiejszy w utrzymaniu, nie zwiększa attack surface TTShub.
- **NIE robimy HTTP transportu MCP** w v1 — stdio wystarczy dla wszystkich harnessów desktopowych. SSE/HTTP w v0.2 jeśli będzie potrzeba (np. zdalne TTShub).
- **NIE reverse-engineerujemy API głosów** — korzystamy z istniejącego TTShub `/voices` endpoint, nie z MiniMax bezpośrednio.
- **NIE cachujemy audio plików lokalnie** — TTShub trzyma je w `%APPDATA%\TTS_hub\temp\`, MCP server zwraca URL `http://127.0.0.1:8765/audio/{id}` do klienta.
- **NIE implementujemy streaming** — MCP stdio to request/response. Dla strumieniowania (text→audio w locie) lepszy byłby HTTP MCP z SSE, ale to v0.2.

### Decyzje projektowe
- **Język: Python, nie Rust** — mimo że TTShub jest Rust, MCP server jako Python jest szybszy do rozwoju, łatwiejszy do `uvx install`, lepsze wsparcie w harnessach (Cursor/Codex/Hermes preferują Python servers).
- **Nazwa binarki**: `ttshub-mcp-server` (rozszerzalne o inne TTShub-* w przyszłości).
- **Konfiguracja**: env vars + `~/.config/ttshub-mcp/config.toml` (opcjonalnie). MVP: tylko env vars, bo to upraszcza deployment w harnessach.
- **Async**: FastMCP wspiera async tooli — używamy tego, bo `/generate` czeka 3-8s na wynik.
- **Timeout na generate**: 30s (domyślna wartość MCP stdio to 60s dla każdej operacji, ale `/generate` typowo kończy w 8s).
- **Polling jobs**: MCP tool `ttshub_get_job_status` — klient (harness/LLM) decyduje kiedy pytać, nie robimy push notifications (MCP stdio ich nie wspiera).
- **Idempotency**: tool `ttshub_generate_speech` zwraca generację z unikalnym id. Jeśli harness powtórzy wywołanie z tymi samymi parametrami, powstaje nowa generacja (idempotency key zrobimy w v0.2 jeśli Kuba zechce).

---

## Struktura repo

```
C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/
├── pyproject.toml
├── README.md
├── LICENSE                          # MIT
├── .gitignore
├── src/
│   └── ttshub_mcp/
│       ├── __init__.py
│       ├── __main__.py              # python -m ttshub_mcp → mcp.run
│       ├── server.py                # FastMCP init, register tools
│       ├── client.py                # HTTP client do TTShub
│       ├── tools/
│       │   ├── __init__.py
│       │   ├── generate.py          # ttshub_generate_speech
│       │   ├── voices.py            # ttshub_list_voices
│       │   ├── jobs.py              # ttshub_get_job_status, ttshub_list_jobs
│       │   ├── history.py           # ttshub_list_history
│       │   └── usage.py             # ttshub_get_usage
│       ├── config.py                # env var loading
│       └── errors.py                # wyjątki mapowane na MCP errors
├── tests/
│   ├── conftest.py
│   ├── test_client.py
│   ├── test_tools_generate.py
│   ├── test_tools_voices.py
│   ├── test_tools_jobs.py
│   ├── test_server_init.py
│   └── test_integration.py          # end-to-end z mock TTShub
├── examples/
│   ├── hermes_config.yaml           # wpis mcp_servers dla ~/.hermes/config.yaml
│   ├── claude_code_user.sh          # claude mcp add --scope user
│   ├── cursor_mcp.json              # .cursor/mcp.json
│   └── codex_mcp_servers.json       # ~/.codex/mcp_servers.json
└── docs/
    ├── README.md
    ├── TOOLS.md                     # pełna dokumentacja każdego toolu
    └── HARNESS_SETUP.md             # jak podpiąć pod każdy harness
```

---

## Step-by-step Plan

### Task 1: Bootstrap repo + pyproject.toml

**Objective:** Nowy projekt Python z uv, MCP SDK jako zależność, entry point `ttshub-mcp`.

**Files:**
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/.gitignore`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/pyproject.toml`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/README.md`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/__init__.py`

**Step 1: Git init + struktura**

W PowerShell:
```powershell
cd "C:\Users\user\Documents\VIBELIFE2026\ttshub-mcp-server"
git init
New-Item -ItemType Directory -Path "src\ttshub_mcp\tools" -Force
New-Item -ItemType Directory -Path "tests" -Force
New-Item -ItemType Directory -Path "examples" -Force
New-Item -ItemType Directory -Path "docs" -Force
```

**Step 2: .gitignore**

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.pytest_cache/
.ruff_cache/
.mypy_cache/
.venv/
venv/

# IDE
.vscode/
.idea/

# Distribution
dist/
build/

# OS
.DS_Store
Thumbs.db
```

**Step 3: pyproject.toml**

```toml
[project]
name = "ttshub-mcp-server"
version = "0.1.0"
description = "MCP server exposing TTShub HTTP API as tools for AI harnesses (Claude Code, Hermes, Cursor, Codex, OpenClaw)"
readme = "README.md"
license = { text = "MIT" }
requires-python = ">=3.11"
authors = [
    { name = "Jakub", email = "kuba@example.com" }
]
keywords = ["mcp", "model-context-protocol", "tts", "ttshub", "minimax"]
dependencies = [
    "mcp>=1.2.0",
    "httpx>=0.27.0",
    "pydantic>=2.7.0",
    "python-dotenv>=1.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "pytest-mock>=3.14.0",
    "respx>=0.21.0",         # mock httpx w testach
    "ruff>=0.5.0",
]

[project.scripts]
ttshub-mcp = "ttshub_mcp.server:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/ttshub_mcp"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

**Step 4: src/ttshub_mcp/__init__.py**

```python
"""TTShub MCP Server — exposes TTShub TTS capabilities via Model Context Protocol."""
__version__ = "0.1.0"
```

**Step 5: src/ttshub_mcp/__main__.py** (placeholder, wypełnimy w Task 2)

```python
from ttshub_mcp.server import main

if __name__ == "__main__":
    main()
```

**Step 6: uv install + smoke test**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
uv sync
uv run python -c "import mcp; print(mcp.__version__)"
# Expected: 1.2.x lub nowsza
```

**Step 7: Commit**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
git add -A
git commit -m "chore: bootstrap ttshub-mcp-server Python project with mcp SDK + uv"
```

---

### Task 2: config.py + client.py (HTTP client do TTShub)

**Objective:** Warstwa konfiguracji z env vars i async HTTP client do TTShub z timeoutami i error handling.

**Files:**
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/config.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/errors.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/client.py`

**Step 1: config.py**

```python
"""Configuration loaded from environment variables."""
from __future__ import annotations
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    ttshub_base_url: str
    default_voice: str
    default_model: str
    default_format: str
    default_provider: str
    request_timeout: float
    generate_timeout: float
    origin_kind: str
    origin_user_name: str | None

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            ttshub_base_url=os.getenv("TTSHUB_BASE_URL", "http://127.0.0.1:8765"),
            default_voice=os.getenv("TTSHUB_DEFAULT_VOICE", "grzegorz_braun"),
            default_model=os.getenv("TTSHUB_DEFAULT_MODEL", "minimax:speech-2.8-hd"),
            default_format=os.getenv("TTSHUB_DEFAULT_FORMAT", "mp3"),
            default_provider=os.getenv("TTSHUB_DEFAULT_PROVIDER", "minimax"),
            request_timeout=float(os.getenv("TTSHUB_REQUEST_TIMEOUT", "10")),
            generate_timeout=float(os.getenv("TTSHUB_GENERATE_TIMEOUT", "30")),
            origin_kind=os.getenv("TTSHUB_ORIGIN_KIND", "mcp"),
            origin_user_name=os.getenv("TTSHUB_ORIGIN_USER_NAME"),
        )
```

**Step 2: errors.py**

```python
"""Exceptions mapped to MCP error responses."""
from __future__ import annotations


class TTShubError(Exception):
    """Base error for TTShub MCP server."""

    def to_mcp_error(self) -> dict:
        return {"code": -32000, "message": str(self)}


class TTShubUnavailable(TTShubError):
    """TTShub server is not reachable."""

    def to_mcp_error(self) -> dict:
        return {"code": -32001, "message": f"TTShub unreachable: {self}"}


class TTShubAPIError(TTShubError):
    """TTShub returned a non-2xx response."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(f"TTShub {status_code}: {detail}")
        self.status_code = status_code
        self.detail = detail

    def to_mcp_error(self) -> dict:
        return {"code": -32002, "message": str(self)}


class InvalidParameter(TTShubError):
    """Caller passed invalid parameters."""

    def to_mcp_error(self) -> dict:
        return {"code": -32602, "message": str(self)}
```

**Step 3: client.py**

```python
"""Async HTTP client for TTShub HTTP API."""
from __future__ import annotations
from typing import Any
import httpx
import logging

from .config import Settings
from .errors import TTShubUnavailable, TTShubAPIError

log = logging.getLogger("ttshub_mcp.client")


class TTShubClient:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._client = httpx.AsyncClient(
            base_url=settings.ttshub_base_url,
            timeout=httpx.Timeout(settings.request_timeout),
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "TTShubClient":
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()

    async def _request(self, method: str, path: str, **kwargs) -> dict[str, Any]:
        try:
            r = await self._client.request(method, path, **kwargs)
        except httpx.ConnectError as e:
            raise TTShubUnavailable(
                f"cannot connect to {self._settings.ttshub_base_url} — is TTShub running?"
            ) from e
        except httpx.TimeoutException as e:
            raise TTShubUnavailable(f"timeout contacting TTShub: {e}") from e

        if not r.is_success:
            raise TTShubAPIError(r.status_code, r.text[:500])
        return r.json() if r.content else {}

    async def health(self) -> dict:
        return await self._request("GET", "/health")

    async def list_voices(self) -> list[dict]:
        return await self._request("GET", "/voices")

    async def list_jobs(self) -> list[dict]:
        return await self._request("GET", "/jobs")

    async def get_job(self, job_id: str) -> dict:
        return await self._request("GET", f"/jobs/{job_id}")

    async def cancel_job(self, job_id: str) -> dict:
        return await self._request("POST", f"/jobs/{job_id}/cancel")

    async def list_history(self, scope: str = "session", limit: int = 20) -> list[dict]:
        return await self._request("GET", f"/history?scope={scope}&limit={limit}")

    async def get_usage(self) -> dict:
        return await self._request("GET", "/usage")

    async def generate(self, payload: dict, timeout: float | None = None) -> dict:
        # /generate can block; use longer timeout
        try:
            r = await self._client.post(
                "/generate",
                json=payload,
                timeout=httpx.Timeout(timeout or self._settings.generate_timeout),
            )
        except httpx.ConnectError as e:
            raise TTShubUnavailable(
                f"cannot connect to {self._settings.ttshub_base_url}"
            ) from e
        except httpx.TimeoutException as e:
            raise TTShubAPIError(504, f"TTShub generate timeout: {e}") from e
        if not r.is_success:
            raise TTShubAPIError(r.status_code, r.text[:500])
        return r.json()
```

**Step 4: Weryfikacja importu**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
uv run python -c "from ttshub_mcp.config import Settings; from ttshub_mcp.client import TTShubClient; print('OK')"
# Expected: "OK"
```

**Step 5: Commit**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
git add -A
git commit -m "feat: Settings (env vars) + TTShubClient (async httpx) + error types"
```

---

### Task 3: Test infrastructure (conftest z mock TTShub)

**Objective:** Respx-based mock TTShub do testów jednostkowych i integracyjnych.

**Files:**
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/conftest.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_client.py`

**Step 1: conftest.py**

```python
"""Shared test fixtures."""
from __future__ import annotations
import pytest
import respx
from httpx import Response

from ttshub_mcp.client import TTShubClient
from ttshub_mcp.config import Settings


@pytest.fixture
def settings() -> Settings:
    return Settings(
        ttshub_base_url="http://test-ttshub:8765",
        default_voice="grzegorz_braun",
        default_model="minimax:speech-2.8-hd",
        default_format="mp3",
        default_provider="minimax",
        request_timeout=5.0,
        generate_timeout=10.0,
        origin_kind="mcp",
        origin_user_name="test-user",
    )


@pytest.fixture
def mock_ttshub():
    """respx mock for TTShub HTTP API."""
    with respx.mock(base_url="http://test-ttshub:8765") as mock:
        yield mock


@pytest.fixture
def client(settings: Settings) -> TTShubClient:
    return TTShubClient(settings)


# Sample data factories
@pytest.fixture
def sample_voice() -> dict:
    return {
        "voice_id": "grzegorz_braun",
        "display_name": "Grzegorz Braun (clone)",
        "language": "pl",
        "description": "Polish male, deep, conspiratorial",
    }


@pytest.fixture
def sample_job_running() -> dict:
    return {
        "id": "gen_test_123",
        "status": "running",
        "title": "test generate",
        "model": "minimax:speech-2.8-hd",
        "voice": "grzegorz_braun",
        "created_at": "2026-06-09T12:00:00Z",
        "phase": "tts_inference",
    }


@pytest.fixture
def sample_generation_done() -> dict:
    return {
        "id": "gen_test_done",
        "status": "done",
        "text": "Test text",
        "model": "minimax:speech-2.8-hd",
        "voice": "grzegorz_braun",
        "format": "mp3",
        "audio_path": "C:/Users/user/AppData/Roaming/TTS_hub/temp/gen_test_done.mp3",
        "audio_url": "http://127.0.0.1:8765/audio/gen_test_done",
        "created_at": "2026-06-09T12:00:00Z",
        "duration_ms": 3200,
    }
```

**Step 2: test_client.py**

```python
"""Tests for TTShubClient."""
import pytest
from httpx import Response

from ttshub_mcp.client import TTShubClient
from ttshub_mcp.errors import TTShubUnavailable, TTShubAPIError


async def test_health_success(mock_ttshub, client: TTShubClient):
    mock_ttshub.get("/health").mock(return_value=Response(200, json={"ok": True, "service": "tts-hub"}))
    result = await client.health()
    assert result == {"ok": True, "service": "tts-hub"}


async def test_health_unreachable(client: TTShubClient):
    # No mock — connection refused
    with pytest.raises(TTShubUnavailable):
        await client.health()


async def test_health_5xx(mock_ttshub, client: TTShubClient):
    mock_ttshub.get("/health").mock(return_value=Response(500, text="internal"))
    with pytest.raises(TTShubAPIError) as exc_info:
        await client.health()
    assert exc_info.value.status_code == 500


async def test_list_voices(mock_ttshub, client: TTShubClient, sample_voice):
    mock_ttshub.get("/voices").mock(return_value=Response(200, json=[sample_voice]))
    voices = await client.list_voices()
    assert len(voices) == 1
    assert voices[0]["voice_id"] == "grzegorz_braun"


async def test_generate_success(mock_ttshub, client: TTShubClient, sample_generation_done):
    mock_ttshub.post("/generate").mock(return_value=Response(200, json=sample_generation_done))
    payload = {"text": "Test", "model": "minimax:speech-2.8-hd", "voice": "grzegorz_braun", "format": "mp3", "provider": "minimax"}
    result = await client.generate(payload)
    assert result["status"] == "done"
    assert result["id"] == "gen_test_done"
```

**Step 3: Uruchom testy**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
uv run pytest tests/test_client.py -v
# Expected: 5 passed
```

**Step 4: Commit**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
git add -A
git commit -m "test: conftest with respx mock + client unit tests"
```

---

### Task 4: tools/voices.py + tools/jobs.py (read-only tools)

**Objective:** Dwa read-only tooli MCP: list_voices i get_job_status.

**Files:**
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/tools/__init__.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/tools/voices.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/tools/jobs.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_tools_voices.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_tools_jobs.py`

**Step 1: src/ttshub_mcp/tools/__init__.py**

```python
"""MCP tool implementations."""
```

**Step 2: src/ttshub_mcp/tools/voices.py**

```python
"""Tool: ttshub_list_voices — enumerate available TTS voices."""
from __future__ import annotations
import json
from typing import Annotated
from pydantic import Field

from ..client import TTShubClient
from ..errors import InvalidParameter


async def list_voices(
    client: TTShubClient,
    language: Annotated[str | None, Field(description="Filter by language code (e.g. 'pl', 'en', 'zh'). Case-insensitive. Omit to list all.")] = None,
    cloned_only: Annotated[bool, Field(description="If True, return only locally-cloned voices (Polish, custom). Default False.")] = False,
) -> str:
    """List available TTS voices from TTShub. Returns a JSON array of voices with voice_id, display_name, language, description. Use voice_id as the 'voice' parameter for ttshub_generate_speech."""
    voices = await client.list_voices()

    if cloned_only:
        # Cloned voices are stored in settings.json — distinguish by lack of standard prefix
        # Heuristic: cloned voice_ids are lowercase, no underscores in name part; MiniMax synced have "English_", "Chinese_", etc.
        voices = [v for v in voices if not v.get("voice_id", "").startswith(("English_", "Chinese_", "Japanese_", "Korean_", "Spanish_", "French_", "German_", "Italian_", "Portuguese_", "Russian_", "Arabic_", "Hindi_", "Indonesian_", "Vietnamese_", "Thai_", "Turkish_"))]

    if language:
        lang_lower = language.lower()
        voices = [v for v in voices if v.get("language", "").lower() == lang_lower]

    return json.dumps(voices, ensure_ascii=False, indent=2)
```

**Step 3: src/ttshub_mcp/tools/jobs.py**

```python
"""Tools: ttshub_get_job_status, ttshub_list_jobs — query TTS job queue."""
from __future__ import annotations
import json
from typing import Annotated
from pydantic import Field

from ..client import TTShubClient
from ..errors import InvalidParameter


async def list_jobs(
    client: TTShubClient,
    status: Annotated[str | None, Field(description="Filter by status: 'queued', 'running', 'done', 'failed', 'cancelled'. Omit for all.")] = None,
) -> str:
    """List all jobs in TTShub queue (active + recent). Returns JSON array of job objects with id, status, model, voice, phase, created_at."""
    jobs = await client.list_jobs()
    if status:
        if status not in ("queued", "running", "done", "failed", "cancelled"):
            raise InvalidParameter(f"invalid status: {status}")
        jobs = [j for j in jobs if j.get("status") == status]
    return json.dumps(jobs, ensure_ascii=False, indent=2)


async def get_job_status(
    client: TTShubClient,
    job_id: Annotated[str, Field(description="The job id (e.g. 'gen_abc123'). Get it from ttshub_generate_speech response or ttshub_list_jobs.")],
) -> str:
    """Get the current status of a specific TTS job. Returns JSON object with id, status, phase, audio_url (if done), error (if failed)."""
    job = await client.get_job(job_id)
    return json.dumps(job, ensure_ascii=False, indent=2)


async def cancel_job(
    client: TTShubClient,
    job_id: Annotated[str, Field(description="The job id to cancel. Only queued or running jobs can be cancelled.")],
) -> str:
    """Cancel a queued or running TTS job. Returns confirmation JSON."""
    result = await client.cancel_job(job_id)
    return json.dumps(result, ensure_ascii=False, indent=2)
```

**Step 4: tests/test_tools_voices.py**

```python
import pytest
from httpx import Response

from ttshub_mcp.tools.voices import list_voices


async def test_list_voices_all(mock_ttshub, client):
    mock_ttshub.get("/voices").mock(return_value=Response(200, json=[
        {"voice_id": "grzegorz_braun", "language": "pl"},
        {"voice_id": "English_CaptivatingStoryteller", "language": "en"},
    ]))
    result = await list_voices(client)
    assert "grzegorz_braun" in result
    assert "English_CaptivatingStoryteller" in result


async def test_list_voices_polish_filter(mock_ttshub, client):
    mock_ttshub.get("/voices").mock(return_value=Response(200, json=[
        {"voice_id": "grzegorz_braun", "language": "pl"},
        {"voice_id": "English_CaptivatingStoryteller", "language": "en"},
    ]))
    result = await list_voices(client, language="pl")
    assert "grzegorz_braun" in result
    assert "English_CaptivatingStoryteller" not in result


async def test_list_voices_cloned_only(mock_ttshub, client):
    mock_ttshub.get("/voices").mock(return_value=Response(200, json=[
        {"voice_id": "grzegorz_braun", "language": "pl"},
        {"voice_id": "English_CaptivatingStoryteller", "language": "en"},
    ]))
    result = await list_voices(client, cloned_only=True)
    assert "grzegorz_braun" in result
    assert "English_CaptivatingStoryteller" not in result
```

**Step 5: tests/test_tools_jobs.py**

```python
import pytest
from httpx import Response

from ttshub_mcp.tools.jobs import list_jobs, get_job_status, cancel_job
from ttshub_mcp.errors import InvalidParameter


async def test_list_jobs_all(mock_ttshub, client):
    mock_ttshub.get("/jobs").mock(return_value=Response(200, json=[
        {"id": "j1", "status": "running"},
        {"id": "j2", "status": "done"},
    ]))
    result = await list_jobs(client)
    assert "j1" in result and "j2" in result


async def test_list_jobs_filter(mock_ttshub, client):
    mock_ttshub.get("/jobs").mock(return_value=Response(200, json=[
        {"id": "j1", "status": "running"},
        {"id": "j2", "status": "done"},
    ]))
    result = await list_jobs(client, status="running")
    assert "j1" in result
    assert "j2" not in result


async def test_list_jobs_invalid_status(client):
    import pytest
    with pytest.raises(InvalidParameter):
        await list_jobs(client, status="banana")


async def test_get_job_status(mock_ttshub, client):
    mock_ttshub.get("/jobs/gen_123").mock(return_value=Response(200, json={
        "id": "gen_123", "status": "done", "audio_url": "http://127.0.0.1:8765/audio/gen_123"
    }))
    result = await get_job_status(client, "gen_123")
    assert "gen_123" in result
    assert "audio_url" in result


async def test_cancel_job(mock_ttshub, client):
    mock_ttshub.post("/jobs/gen_123/cancel").mock(return_value=Response(200, json={"cancelled": True}))
    result = await cancel_job(client, "gen_123")
    assert "cancelled" in result
```

**Step 6: Weryfikacja**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
uv run pytest tests/ -v
# Expected: 14+ passed (5 client + 3 voices + 5 jobs + conftest)
```

**Step 7: Commit**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
git add -A
git commit -m "feat: ttshub_list_voices + ttshub_list_jobs/get_job_status/cancel_job"
```

---

### Task 5: tools/generate.py (core tool — generowanie mowy)

**Objective:** Główny tool MCP — ttshub_generate_speech. Obsługuje cloned voices, Polish, numerics, origin attribution.

**Files:**
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/tools/generate.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_tools_generate.py`

**Step 1: src/ttshub_mcp/tools/generate.py**

```python
"""Tool: ttshub_generate_speech — synthesize speech from text via TTShub."""
from __future__ import annotations
import json
from typing import Annotated
from pydantic import Field

from ..client import TTShubClient
from ..config import Settings
from ..errors import InvalidParameter

# Known cloned voice_ids that MUST go through MiniMax provider
# (see tts-hub-reference: 'Provider default footgun')
KNOWN_CLONED_VOICES = {
    "grzegorz_braun", "robert_maklowicz", "michal_zebrowski",
    "geralt_witcher", "wojciech_mann",
}


async def generate_speech(
    text: Annotated[str, Field(description="Text to synthesize. Polish characters (ąćęłńóśźż) supported. Numbers should be written as words (e.g. 'pięć' not '5') — MiniMax does not expand numerics.")],
    client: TTShubClient,
    settings: Settings,
    voice: Annotated[str | None, Field(description="Voice ID. Use ttshub_list_voices to discover. Default: TTSHUB_DEFAULT_VOICE env var (grzegorz_braun).")] = None,
    model: Annotated[str | None, Field(description="Model identifier. Default: 'minimax:speech-2.8-hd'. MiniMax is the only provider for cloned voices.")] = None,
    format: Annotated[str | None, Field(description="Audio format: 'mp3' (default), 'wav', 'ogg', 'pcm'.")] = None,
    speed: Annotated[float | None, Field(description="Speech speed multiplier (0.5 = slow, 1.0 = normal, 2.0 = fast). Default 1.0.")] = None,
    pitch: Annotated[float | None, Field(description="Pitch shift in semitones (-12 to +12). Default 0.")] = None,
    autoplay: Annotated[bool, Field(description="If True, the audio will autoplay when ready in TTShub UI. Default False (silent generation, return URL).")] = False,
) -> str:
    """Synthesize speech from text using TTShub. Returns a JSON object with: id (generation id), status ('done' | 'queued' | 'running'), text, voice, audio_url (http://127.0.0.1:8765/audio/{id}), audio_path (local file path on the TTShub host), duration_ms, created_at. Typical latency: 2-8s for short Polish text. If TTShub is busy (60 RPM limit), status will be 'queued' — use ttshub_get_job_status to poll."""
    if not text or not text.strip():
        raise InvalidParameter("text must not be empty")
    if len(text) > 10000:
        raise InvalidParameter(f"text too long ({len(text)} chars, max 10000)")

    voice = voice or settings.default_voice
    model = model or settings.default_model
    format = format or settings.default_format

    payload = {
        "text": text,
        "voice": voice,
        "model": model,
        "format": format,
        "autoplay": autoplay,
        "source": "mcp",
    }

    # Provider default footgun: cloned voices MUST specify provider=minimax
    if voice in KNOWN_CLONED_VOICES or "minimax" in model.lower():
        payload["provider"] = "minimax"
    else:
        payload["provider"] = settings.default_provider

    if speed is not None:
        payload["minimax_speed"] = speed
    if pitch is not None:
        payload["minimax_pitch"] = pitch

    # Origin attribution — let TTShub know this came from MCP
    if settings.origin_kind:
        payload["origin"] = {
            "kind": settings.origin_kind,
            "user_name": settings.origin_user_name,
        }

    result = await client.generate(payload)
    return json.dumps(result, ensure_ascii=False, indent=2)
```

**Step 2: tests/test_tools_generate.py**

```python
import pytest
import json
from httpx import Response

from ttshub_mcp.tools.generate import generate_speech
from ttshub_mcp.errors import InvalidParameter


async def test_generate_basic(mock_ttshub, client, settings, sample_generation_done):
    mock_ttshub.post("/generate").mock(return_value=Response(200, json=sample_generation_done))
    result = await generate_speech("Test", client, settings)
    parsed = json.loads(result)
    assert parsed["id"] == "gen_test_done"
    assert parsed["status"] == "done"
    # Verify provider was sent (footgun guard)
    sent = mock_ttshub.calls.last.request
    body = json.loads(sent.content)
    assert body["provider"] == "minimax"
    assert body["text"] == "Test"
    assert body["voice"] == "grzegorz_braun"


async def test_generate_english_voice(mock_ttshub, client, settings, sample_generation_done):
    mock_ttshub.post("/generate").mock(return_value=Response(200, json=sample_generation_done))
    await generate_speech("Hello", client, settings, voice="English_CaptivatingStoryteller")
    sent = mock_ttshub.calls.last.request
    body = json.loads(sent.content)
    # English voice but model is minimax — provider should still be minimax
    assert body["provider"] == "minimax"


async def test_generate_empty_text(client, settings):
    with pytest.raises(InvalidParameter):
        await generate_speech("", client, settings)
    with pytest.raises(InvalidParameter):
        await generate_speech("   ", client, settings)


async def test_generate_too_long(client, settings):
    with pytest.raises(InvalidParameter):
        await generate_speech("a" * 10001, client, settings)


async def test_generate_with_origin(mock_ttshub, client, settings, sample_generation_done):
    mock_ttshub.post("/generate").mock(return_value=Response(200, json=sample_generation_done))
    await generate_speech("Test", client, settings)
    sent = mock_ttshub.calls.last.request
    body = json.loads(sent.content)
    assert body["origin"]["kind"] == "mcp"
    assert body["origin"]["user_name"] == "test-user"


async def test_generate_speed_pitch(mock_ttshub, client, settings, sample_generation_done):
    mock_ttshub.post("/generate").mock(return_value=Response(200, json=sample_generation_done))
    await generate_speech("Test", client, settings, speed=1.2, pitch=-2.0)
    sent = mock_ttshub.calls.last.request
    body = json.loads(sent.content)
    assert body["minimax_speed"] == 1.2
    assert body["minimax_pitch"] == -2.0
```

**Step 3: Weryfikacja**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
uv run pytest tests/ -v
# Expected: 20+ passed
```

**Step 4: Commit**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
git add -A
git commit -m "feat: ttshub_generate_speech with provider footgun guard + origin attribution"
```

---

### Task 6: tools/history.py + tools/usage.py

**Objective:** Narzędzia read-only do przeglądania historii i usage stats.

**Files:**
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/tools/history.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/tools/usage.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_tools_history.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_tools_usage.py`

**Step 1: history.py**

```python
"""Tool: ttshub_list_history — browse past generations."""
from __future__ import annotations
import json
from typing import Annotated
from pydantic import Field

from ..client import TTShubClient
from ..errors import InvalidParameter


async def list_history(
    client: TTShubClient,
    scope: Annotated[str, Field(description="'session' (current conversation) or 'archive' (all saved generations).")] = "session",
    limit: Annotated[int, Field(description="Max items to return (1-100). Default 20.")] = 20,
) -> str:
    """List past TTS generations from TTShub history. Returns JSON array of generations with id, text, voice, model, status, audio_url, created_at, origin (if external)."""
    if scope not in ("session", "archive"):
        raise InvalidParameter(f"scope must be 'session' or 'archive', got '{scope}'")
    if not 1 <= limit <= 100:
        raise InvalidParameter(f"limit must be 1-100, got {limit}")
    history = await client.list_history(scope=scope, limit=limit)
    return json.dumps(history, ensure_ascii=False, indent=2)
```

**Step 2: usage.py**

```python
"""Tool: ttshub_get_usage — local usage stats from TTShub."""
from __future__ import annotations
import json
from ..client import TTShubClient


async def get_usage(client: TTShubClient) -> str:
    """Get local TTShub usage statistics (count of generations, total chars, by-provider breakdown). NOTE: This is TTShub's LOCAL counter, not MiniMax's upstream quota — there is no API endpoint for MiniMax real quota (verified 2026-06-07). For real usage see platform.minimax.io dashboard."""
    usage = await client.get_usage()
    return json.dumps(usage, ensure_ascii=False, indent=2)
```

**Step 3: tests/test_tools_history.py**

```python
import pytest
from httpx import Response

from ttshub_mcp.tools.history import list_history
from ttshub_mcp.errors import InvalidParameter


async def test_list_history_session(mock_ttshub, client):
    mock_ttshub.get("/history").mock(return_value=Response(200, json=[
        {"id": "h1", "text": "Test", "voice": "grzegorz_braun"},
    ]))
    result = await list_history(client, scope="session")
    assert "h1" in result


async def test_list_history_invalid_scope(client):
    with pytest.raises(InvalidParameter):
        await list_history(client, scope="banana")


async def test_list_history_invalid_limit(client):
    with pytest.raises(InvalidParameter):
        await list_history(client, limit=200)
```

**Step 4: tests/test_tools_usage.py**

```python
import pytest
from httpx import Response

from ttshub_mcp.tools.usage import get_usage


async def test_get_usage(mock_ttshub, client):
    mock_ttshub.get("/usage").mock(return_value=Response(200, json={
        "total_generations": 42,
        "total_chars": 12500,
        "by_provider": {"minimax": 38, "google": 4},
    }))
    result = await get_usage(client)
    assert "42" in result
    assert "minimax" in result
```

**Step 5: Weryfikacja + commit**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
uv run pytest tests/ -v
git add -A
git commit -m "feat: ttshub_list_history + ttshub_get_usage"
```

---

### Task 7: server.py (FastMCP assembly + stdio transport)

**Objective:** Główny entry point — łączy wszystkie tooli w jeden serwer MCP ze stdio transport.

**Files:**
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/server.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_server_init.py`

**Step 1: server.py**

```python
"""TTShub MCP Server — entry point."""
from __future__ import annotations
import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncIterator

from mcp.server.fastmcp import FastMCP
from mcp.server import Server

from .config import Settings
from .client import TTShubClient
from .tools.generate import generate_speech
from .tools.voices import list_voices
from .tools.jobs import list_jobs, get_job_status, cancel_job
from .tools.history import list_history
from .tools.usage import get_usage

log = logging.getLogger("ttshub_mcp.server")


def build_server(settings: Settings) -> tuple[Server, TTShubClient]:
    """Build MCP server with all tools registered. Returns (server, client) tuple."""
    client = TTShubClient(settings)
    mcp = FastMCP(
        name="ttshub-mcp-server",
        instructions=(
            "TTShub MCP server exposes TTS capabilities via TTShub HTTP API on 127.0.0.1:8765. "
            "Available tools: ttshub_generate_speech (synthesize audio from text), "
            "ttshub_list_voices (enumerate voices), ttshub_list_jobs, ttshub_get_job_status, "
            "ttshub_cancel_job, ttshub_list_history, ttshub_get_usage. "
            "For Polish TTS, use cloned voices: grzegorz_braun, robert_maklowicz, "
            "michal_zebrowski, geralt_witcher, wojciech_mann. "
            "Numbers in text must be written as Polish words (e.g. 'pięć' not '5')."
        ),
    )

    @mcp.tool(
        name="ttshub_generate_speech",
        description=(
            "Synthesize speech from text using TTShub. Returns a JSON object with: id, status, "
            "text, voice, audio_url (http://127.0.0.1:8765/audio/{id}), audio_path, duration_ms, created_at. "
            "Latency 2-8s. Provider footgun: cloned voices (grzegorz_braun, robert_maklowicz, "
            "michal_zebrowski, geralt_witcher, wojciech_mann) always use minimax:speech-2.8-hd. "
            "Write numbers as Polish words."
        ),
        annotations={
            "readOnlyHint": False,
            "destructiveHint": False,
            "openWorldHint": True,
            "idempotentHint": False,
        },
    )
    async def _generate_speech(
        text: str,
        voice: str | None = None,
        model: str | None = None,
        format: str | None = None,
        speed: float | None = None,
        pitch: float | None = None,
        autoplay: bool = False,
    ) -> str:
        return await generate_speech(
            text=text, client=client, settings=settings,
            voice=voice, model=model, format=format,
            speed=speed, pitch=pitch, autoplay=autoplay,
        )

    @mcp.tool(
        name="ttshub_list_voices",
        description="List available TTS voices. Optionally filter by language (e.g. 'pl', 'en') or cloned_only=True for locally-cloned voices only.",
        annotations={"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False, "idempotentHint": True},
    )
    async def _list_voices(
        language: str | None = None,
        cloned_only: bool = False,
    ) -> str:
        return await list_voices(client=client, language=language, cloned_only=cloned_only)

    @mcp.tool(
        name="ttshub_list_jobs",
        description="List all TTS jobs in the TTShub queue (active + recent). Optionally filter by status (queued, running, done, failed, cancelled).",
        annotations={"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False, "idempotentHint": True},
    )
    async def _list_jobs(status: str | None = None) -> str:
        return await list_jobs(client=client, status=status)

    @mcp.tool(
        name="ttshub_get_job_status",
        description="Get the current status of a specific TTS job by id. Returns id, status, phase, audio_url (if done), error (if failed).",
        annotations={"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False, "idempotentHint": True},
    )
    async def _get_job_status(job_id: str) -> str:
        return await get_job_status(client=client, job_id=job_id)

    @mcp.tool(
        name="ttshub_cancel_job",
        description="Cancel a queued or running TTS job by id.",
        annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": False, "idempotentHint": True},
    )
    async def _cancel_job(job_id: str) -> str:
        return await cancel_job(client=client, job_id=job_id)

    @mcp.tool(
        name="ttshub_list_history",
        description="List past TTS generations from TTShub history. scope='session' (current conversation) or 'archive' (all saved). limit=1-100, default 20.",
        annotations={"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False, "idempotentHint": True},
    )
    async def _list_history(scope: str = "session", limit: int = 20) -> str:
        return await list_history(client=client, scope=scope, limit=limit)

    @mcp.tool(
        name="ttshub_get_usage",
        description="Get local TTShub usage stats (count, chars, by-provider). NOTE: this is TTShub's LOCAL counter — MiniMax has no real quota endpoint (verified 2026-06-07).",
        annotations={"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False, "idempotentHint": True},
    )
    async def _get_usage() -> str:
        return await get_usage(client=client)

    return mcp, client


def main() -> None:
    """Entry point for `ttshub-mcp` command. Runs MCP server over stdio."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        stream=sys.stderr,  # MCP uses stdout for protocol
    )
    settings = Settings.from_env()
    log.info("starting ttshub-mcp-server, target=%s", settings.ttshub_base_url)
    mcp, client = build_server(settings)
    try:
        mcp.run(transport="stdio")
    finally:
        asyncio.run(client.close())


if __name__ == "__main__":
    main()
```

**Step 2: tests/test_server_init.py**

```python
"""Tests for MCP server initialization and tool registration."""
import pytest
from mcp.server.fastmcp import FastMCP

from ttshub_mcp.server import build_server
from ttshub_mcp.tools.generate import generate_speech
from ttshub_mcp.tools.voices import list_voices


def test_build_server_returns_fastmcp(settings):
    mcp, client = build_server(settings)
    assert isinstance(mcp, FastMCP)
    assert mcp.name == "ttshub-mcp-server"


def test_build_server_registers_all_tools(settings):
    mcp, client = build_server(settings)
    # Get the list of registered tools
    tools = asyncio.run(mcp.list_tools())
    tool_names = {t.name for t in tools}
    expected = {
        "ttshub_generate_speech",
        "ttshub_list_voices",
        "ttshub_list_jobs",
        "ttshub_get_job_status",
        "ttshub_cancel_job",
        "ttshub_list_history",
        "ttshub_get_usage",
    }
    assert expected.issubset(tool_names), f"missing tools: {expected - tool_names}"


def test_tool_annotations(settings):
    mcp, client = build_server(settings)
    tools = {t.name: t for t in asyncio.run(mcp.list_tools())}

    # generate_speech: not read-only, not destructive, open-world
    gen = tools["ttshub_generate_speech"]
    assert gen.annotations.readOnlyHint is False
    assert gen.annotations.destructiveHint is False
    assert gen.annotations.openWorldHint is True

    # list_voices: read-only
    voices = tools["ttshub_list_voices"]
    assert voices.annotations.readOnlyHint is True
    assert voices.annotations.destructiveHint is False

    # cancel_job: destructive
    cancel = tools["ttshub_cancel_job"]
    assert cancel.annotations.destructiveHint is True
```

(import `asyncio` na górze)

**Step 3: Weryfikacja**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
uv run pytest tests/ -v
# Expected: 25+ passed

# Smoke test: odpalenie serwera przez 2s i zamknięcie (Ctrl+C)
uv run ttshub-mcp &
sleep 2
# Powinien wypisać JSON-RPC init handshake na stdout
kill %1
```

**Step 4: Commit**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
git add -A
git commit -m "feat: server.py FastMCP assembly with 7 tools and stdio transport"
```

---

### Task 8: Harness configs (Claude Code, Hermes, Cursor, Codex, OpenClaw)

**Objective:** Przykłady konfiguracji dla każdego wspieranego harnessa. Dzięki temu Kuba może jednym `cp` podpiąć TTShub MCP.

**Files:**
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/examples/claude_code_user.sh`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/examples/hermes_config.yaml`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/examples/cursor_mcp.json`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/examples/codex_mcp_servers.json`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/docs/HARNESS_SETUP.md`

**Step 1: examples/claude_code_user.sh**

```bash
#!/usr/bin/env bash
# Register ttshub-mcp as a user-scoped MCP server in Claude Code.
# After running this, Claude Code can use ttshub_generate_speech, ttshub_list_voices, etc.
set -euo pipefail

claude mcp add ttshub \
  --scope user \
  -e TTSHUB_BASE_URL=http://127.0.0.1:8765 \
  -e TTSHUB_DEFAULT_VOICE=grzegorz_braun \
  -e TTSHUB_DEFAULT_MODEL=minimax:speech-2.8-hd \
  -e TTSHUB_ORIGIN_USER_NAME="${USER:-claude-code-user}" \
  -- uvx --from ttshub-mcp-server ttshub-mcp

echo "✅ Registered ttshub MCP server for Claude Code (user scope)"
echo "   Verify with: claude mcp list"
```

**Step 2: examples/hermes_config.yaml**

```yaml
# Add to ~/.hermes/config.yaml under mcp_servers:
mcp_servers:
  ttshub:
    command: "uvx"
    args: ["--from", "ttshub-mcp-server", "ttshub-mcp"]
    env:
      TTSHUB_BASE_URL: "http://127.0.0.1:8765"
      TTSHUB_DEFAULT_VOICE: "grzegorz_braun"
      TTSHUB_DEFAULT_MODEL: "minimax:speech-2.8-hd"
      TTSHUB_ORIGIN_USER_NAME: "hermes-user"  # optional, set to your name
    timeout: 60
```

**Step 3: examples/cursor_mcp.json**

```json
{
  "mcpServers": {
    "ttshub": {
      "command": "uvx",
      "args": ["--from", "ttshub-mcp-server", "ttshub-mcp"],
      "env": {
        "TTSHUB_BASE_URL": "http://127.0.0.1:8765",
        "TTSHUB_DEFAULT_VOICE": "grzegorz_braun",
        "TTSHUB_DEFAULT_MODEL": "minimax:speech-2.8-hd",
        "TTSHUB_ORIGIN_USER_NAME": "cursor-user"
      }
    }
  }
}
```

Lokacje:
- Global: `~/.cursor/mcp.json` (wszystkie projekty)
- Workspace: `<project>/.cursor/mcp.json` (ten projekt)

**Step 4: examples/codex_mcp_servers.json**

```json
{
  "mcpServers": {
    "ttshub": {
      "command": "uvx",
      "args": ["--from", "ttshub-mcp-server", "ttshub-mcp"],
      "env": {
        "TTSHUB_BASE_URL": "http://127.0.0.1:8765",
        "TTSHUB_DEFAULT_VOICE": "grzegorz_braun",
        "TTSHUB_ORIGIN_USER_NAME": "codex-user"
      }
    }
  }
}
```

Lokacja: `~/.codex/mcp_servers.json` (Codex CLI z MCP support)

**Step 5: docs/HARNESS_SETUP.md**

```markdown
# Harness Setup — podpięcie TTShub MCP pod różne AI agenty

## Wymagania wstępne

- **TTShub działa** na `127.0.0.1:8765` (sprawdź: `curl http://127.0.0.1:8765/health`)
- **`uv`** zainstalowany ([docs.astral.sh/uv](https://docs.astral.sh/uv/)) — Cursor, Codex, Hermes preferują `uvx` do uruchamiania Python MCP servers zero-config.
- **Opcjonalnie**: ustaw `TTSHUB_ORIGIN_USER_NAME` żeby w TTShub było widać kto generował.

## Claude Code (Anthropic)

```bash
# User scope (dla wszystkich projektów)
./examples/claude_code_user.sh

# Lub inline:
claude mcp add ttshub --scope user \
  -e TTSHUB_BASE_URL=http://127.0.0.1:8765 \
  -e TTSHUB_DEFAULT_VOICE=grzegorz_braun \
  -- uvx --from ttshub-mcp-server ttshub-mcp
```

Weryfikacja: `claude mcp list`

W Claude Code pytaj: *"Jakie polskie głosy są dostępne w TTShub?"* — Claude powinien użyć `ttshub_list_voices(cloned_only=true)`.

## Hermes Agent

Dopisz do `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  ttshub:
    command: "uvx"
    args: ["--from", "ttshub-mcp-server", "ttshub-mcp"]
    env:
      TTSHUB_BASE_URL: "http://127.0.0.1:8765"
      TTSHUB_DEFAULT_VOICE: "grzegorz_braun"
    timeout: 60
```

Restart Hermesa. Tooli pojawią się jako `mcp_ttshub_*` w każdej sesji.

## Cursor

Skopiuj `examples/cursor_mcp.json` do `~/.cursor/mcp.json` (globalnie) lub `<project>/.cursor/mcp.json` (lokalnie).

Restart Cursor. Tooli widoczne w Composer / Agent mode.

## Codex CLI

Skopiuj `examples/codex_mcp_servers.json` do `~/.codex/mcp_servers.json`.

W Codex CLI: `codex mcp list` powinien pokazać `ttshub`.

## OpenClaw (legacy)

OpenClaw ma własny system pluginów, ale wspiera MCP przez `mcp/native-mcp` skill. Konfiguracja analogiczna do Hermesa.

## Test po podpięciu

W dowolnym harnessie:

> "Wygeneruj audio z tekstem: 'Test integracji MCP działa' głosem grzegorz_braun"

Harness powinien:
1. Wywołać `ttshub_list_voices(cloned_only=true)` żeby potwierdzić voice
2. Wywołać `ttshub_generate_speech(text="Test integracji MCP działa", voice="grzegorz_braun")`
3. Zwrócić URL do audio: `http://127.0.0.1:8765/audio/gen_xyz`
```

**Step 6: Commit**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
git add -A
git commit -m "docs: harness setup examples for Claude Code, Hermes, Cursor, Codex, OpenClaw"
```

---

### Task 9: Integration test (end-to-end z mock TTShub)

**Objective:** Test pełnego flow — klient (mock harness) wysyła JSON-RPC `tools/call` do naszego serwera, serwer robi HTTP do mock TTShub, zwraca odpowiedź.

**Files:**
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_integration.py`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/docs/TOOLS.md`

**Step 1: tests/test_integration.py**

```python
"""End-to-end integration tests with in-memory MCP client + mocked TTShub."""
import pytest
import json
from httpx import Response
from mcp.client.session import ClientSession
from mcp.client.stdio import stdio_client, StdioServerParameters

# ... (tu w przyszłości, na teraz uproszczona wersja z wywołaniem server.build_server
# bezpośrednio i wyciągnięciem tools przez niskopoziomowe API)


@pytest.mark.asyncio
async def test_end_to_end_generate_speech(settings, mock_ttshub, sample_generation_done):
    """Simulate the full flow: build server, list tools, call generate_speech."""
    from ttshub_mcp.server import build_server
    mock_ttshub.post("/generate").mock(return_value=Response(200, json=sample_generation_done))
    mcp, client = build_server(settings)

    tools = await mcp.list_tools()
    generate = next(t for t in tools if t.name == "ttshub_generate_speech")
    assert generate is not None

    # Call the tool directly via the wrapped function
    from ttshub_mcp.tools.generate import generate_speech
    result = await generate_speech(
        text="Test integracji",
        client=client,
        settings=settings,
    )
    parsed = json.loads(result)
    assert parsed["id"] == "gen_test_done"
    assert parsed["status"] == "done"

    # Verify the request that reached TTShub
    sent = mock_ttshub.calls.last.request
    body = json.loads(sent.content)
    assert body["text"] == "Test integracji"
    assert body["provider"] == "minimax"  # footgun guard
    assert body["origin"]["kind"] == "mcp"


@pytest.mark.asyncio
async def test_end_to_end_voices_to_generate(settings, mock_ttshub, sample_voice, sample_generation_done):
    """Realistic flow: list voices, then generate with one of them."""
    from ttshub_mcp.server import build_server
    from ttshub_mcp.tools.voices import list_voices
    from ttshub_mcp.tools.generate import generate_speech

    mock_ttshub.get("/voices").mock(return_value=Response(200, json=[sample_voice]))
    mock_ttshub.post("/generate").mock(return_value=Response(200, json=sample_generation_done))

    mcp, client = build_server(settings)

    # Step 1: list voices
    voices_json = await list_voices(client=client, cloned_only=True)
    voices = json.loads(voices_json)
    assert len(voices) == 1
    chosen_voice = voices[0]["voice_id"]

    # Step 2: generate with that voice
    result = await generate_speech("Hello", client=client, settings=settings, voice=chosen_voice)
    parsed = json.loads(result)
    assert parsed["id"] == "gen_test_done"
```

**Step 2: docs/TOOLS.md** (pełna dokumentacja każdego toolu)

```markdown
# TTShub MCP Tools Reference

Wszystkie 7 tooli jest zarejestrowanych w MCP serverze `ttshub-mcp-server`. Konwencja nazewnictwa: `ttshub_*`.

## ttshub_generate_speech

| Parametr | Typ | Required | Default | Opis |
|----------|-----|----------|---------|------|
| `text` | string | ✓ | — | Tekst do syntezy. Max 10000 znaków. |
| `voice` | string | | `grzegorz_braun` | Voice ID z `ttshub_list_voices`. |
| `model` | string | | `minimax:speech-2.8-hd` | Model providera. |
| `format` | string | | `mp3` | `mp3`, `wav`, `ogg`, `pcm`. |
| `speed` | float | | 1.0 | 0.5-2.0 mnożnik szybkości. |
| `pitch` | float | | 0.0 | -12 do +12 semitones. |
| `autoplay` | bool | | false | Czy odtworzyć w TTShub UI po wygenerowaniu. |

**Zwraca:** JSON `{id, status, text, voice, model, format, audio_url, audio_path, duration_ms, created_at, origin}`.

**Latency:** 2-8s dla krótkiego tekstu polskiego. Przy 60 RPM limit (MiniMax) status może być `queued` — wtedy użyj `ttshub_get_job_status`.

**Annotations:** readOnlyHint=false, destructiveHint=false, openWorldHint=true.

**Footgun guard:** Dla sklonowanych głosów (grzegorz_braun, robert_maklowicz, michal_zebrowski, geralt_witcher, wojciech_mann) serwer **zawsze** wysyła `provider="minimax"`. Bez tego request leci do Google Cloud TTS i 403 (verified 2026-06-06).

## ttshub_list_voices

| Parametr | Typ | Default | Opis |
|----------|-----|---------|------|
| `language` | string | None | Filtr po kodzie języka: `pl`, `en`, `zh`, itd. Case-insensitive. |
| `cloned_only` | bool | false | Jeśli true, zwraca tylko lokalne klony (bez MiniMax synced). |

**Zwraca:** JSON array `{voice_id, display_name, language, description}`.

**Przykład:**
```
ttshub_list_voices(cloned_only=true)
→ [{"voice_id": "grzegorz_braun", "display_name": "Grzegorz Braun (clone)", "language": "pl", ...}, ...]
```

## ttshub_list_jobs, ttshub_get_job_status, ttshub_cancel_job

`list_jobs(status="running")` — lista jobów (active + recent).
`get_job_status(job_id="gen_abc")` — szczegóły jednego joba (w tym `audio_url` gdy done).
`cancel_job(job_id="gen_abc")` — anuluje queued/running.

## ttshub_list_history

| Parametr | Typ | Default | Opis |
|----------|-----|---------|------|
| `scope` | string | "session" | `session` (bieżąca konwersacja) lub `archive` (wszystkie zapisane). |
| `limit` | int | 20 | 1-100. |

## ttshub_get_usage

Lokalny counter TTShub — `total_generations`, `total_chars`, `by_provider`. **NIE jest to prawdziwe saldo MiniMax** — MiniMax nie expose endpointu do sprawdzania salda (verified 2026-06-07, 12 endpointów wszystkie 404). Prawdziwe saldo: `platform.minimax.io` dashboard.

## Generowanie po polsku — uwagi

- Polskie znaki (ąćęłńóśźż) obsługiwane natywnie.
- **Liczby MUSZĄ być słowami**: "pięć" nie "5", "dwadzieścia" nie "20". MiniMax nie rozwijает numerics.
- **Emotion tags NIE działają** w MiniMax T2A v2: tekst "(scared) cześć" zostanie przeczytany dosłownie łącznie z "(scared)". Zamiast tego wybierz voice o odpowiednim tonie (np. `English_CaptivatingStoryteller` dla chłodnego, `English_expressive_narrator` dla ekspresyjnego).
```

**Step 3: Final test run + commit**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
uv run pytest tests/ -v
# Expected: 30+ passed
git add -A
git commit -m "test: end-to-end integration + tools.md reference"
```

---

### Task 10: Publish to PyPI (or local) + verify with Claude Code

**Objective:** Udostępnienie paczki tak żeby `uvx --from ttshub-mcp-server ttshub-mcp` działało. Plus smoke test w Claude Code.

**Files:**
- Modify: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/README.md`
- Create: `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/README.md` (rozbudowany)

**Step 1: README.md** (rozbudowany)

```markdown
# ttshub-mcp-server

MCP (Model Context Protocol) server for [TTShub](https://github.com/xcwajdax/TTS_hub) — exposes Polish TTS capabilities (cloned voices: Braun, Maklowicz, Żebrowski, Geralt, Mann) as standard tools for AI harnesses.

## What it does

Talk to TTShub from Claude Code, Hermes, Cursor, Codex CLI, or any MCP-compatible AI agent. The LLM gets tools to:
- `ttshub_generate_speech` — synthesize audio from Polish/English text
- `ttshub_list_voices` — discover 5 cloned + 332 synced voices
- `ttshub_list_jobs` / `ttshub_get_job_status` / `ttshub_cancel_job` — manage the job queue
- `ttshub_list_history` / `ttshub_get_usage` — browse past generations

## Quick Start

```bash
# Install with uvx (no clone needed, pulls from PyPI)
uvx --from ttshub-mcp-server ttshub-mcp

# Or local development
git clone <this repo>
cd ttshub-mcp-server
uv sync
uv run ttshub-mcp
```

Then register in your harness. See [docs/HARNESS_SETUP.md](docs/HARNESS_SETUP.md) for Claude Code, Hermes, Cursor, Codex.

## Requirements

- **TTShub** running on `127.0.0.1:8765` (see [TTS_hub](https://github.com/xcwajdax/TTS_hub))
- **uv** >= 0.4.0
- **Python** 3.11+ (uv handles this)

## Configuration

All config is via environment variables:

| Var | Default | Description |
|-----|---------|-------------|
| `TTSHUB_BASE_URL` | `http://127.0.0.1:8765` | TTShub HTTP API base |
| `TTSHUB_DEFAULT_VOICE` | `grzegorz_braun` | Default voice for generate_speech |
| `TTSHUB_DEFAULT_MODEL` | `minimax:speech-2.8-hd` | Default model |
| `TTSHUB_DEFAULT_FORMAT` | `mp3` | Default audio format |
| `TTSHUB_DEFAULT_PROVIDER` | `minimax` | Default provider |
| `TTSHUB_REQUEST_TIMEOUT` | `10` | HTTP timeout (s) for read tools |
| `TTSHUB_GENERATE_TIMEOUT` | `30` | HTTP timeout (s) for generate |
| `TTSHUB_ORIGIN_KIND` | `mcp` | Tag in TTShub origin attribution |
| `TTSHUB_ORIGIN_USER_NAME` | None | Your name (for TTShub history) |

## Development

```bash
uv sync --extra dev
uv run pytest -v
uv run ruff check src tests
```

## Architecture

```
+-----------------+    stdio (JSON-RPC)    +-------------------+
|   AI Harness    |  ←-------------------→ |  ttshub-mcp-server|
| (Claude, etc.)  |                         |  (this, Python)   |
+-----------------+                         +---------+---------+
                                                      │ HTTP (httpx)
                                                      ▼
                                            +-------------------+
                                            |   TTShub :8765    |
                                            |  (Tauri/Rust)     |
                                            +-------------------+
```

The MCP server is a thin client — no business logic, just protocol translation. TTShub owns all TTS state, history, voice cloning, and job queue.

## Known Limitations

- **stdio transport only** — v0.1 doesn't support HTTP/SSE. Local TTShub is reachable over loopback, so this is fine for desktop harnesses. Remote/headless TTShub needs v0.2.
- **No streaming** — generate is request/response. Audio files land in TTShub's temp dir, accessible via `audio_url` in the response.
- **Polish numerics must be words** — MiniMax T2A v2 doesn't expand numbers. Write "pięć" not "5".
- **60 RPM upstream limit** — MiniMax throttles at 60 generations/minute. Status may be `queued` under load.

## License

MIT
```

**Step 2: Build + test local install**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
uv build
ls dist/
# Expected: ttshub_mcp_server-0.1.0-py3-none-any.whl, ttshub_mcp_server-0.1.0.tar.gz

# Local install test
uv pip install dist/ttshub_mcp_server-0.1.0-py3-none-any.whl --force-reinstall
uv run ttshub-mcp --help  # albo test przez stdio
```

**Step 3: Publish to PyPI** (opcjonalnie — tylko jeśli Kuba chce; alternatywa to GitHub install)

```bash
# Tworzy konto PyPI, API token, potem:
uv publish

# Po publikacji user może:
uvx --from ttshub-mcp-server ttshub-mcp
```

Alternatywa bez PyPI — GitHub install:
```toml
# W pyproject.toml innych osób:
[tool.uv]
dependencies = [
    "ttshub-mcp @ git+https://github.com/xcwajdax/ttshub-mcp-server.git"
]
```

**Step 4: Smoke test w Claude Code**

```bash
# Po publish + claude mcp add (Task 8):
claude -p "Use ttshub_list_voices with cloned_only=true. Then generate audio saying 'Test MCP integration' using the first voice. Return the audio_url."

# Expected output: Claude wywołuje tools, zwraca URL typu http://127.0.0.1:8765/audio/gen_xyz
# Curl test: curl -I http://127.0.0.1:8765/audio/gen_xyz → 200 OK
```

**Step 5: Commit + tag**

```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
git add -A
git commit -m "docs: comprehensive README + PyPI publish workflow"
git tag v0.1.0
```

---

## Pliki do zmiany / utworzenia (podsumowanie)

### Nowe pliki
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/.gitignore`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/pyproject.toml`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/README.md`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/__init__.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/__main__.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/config.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/errors.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/client.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/server.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/tools/__init__.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/tools/generate.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/tools/voices.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/tools/jobs.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/tools/history.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/src/ttshub_mcp/tools/usage.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/conftest.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_client.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_server_init.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_tools_generate.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_tools_voices.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_tools_jobs.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_tools_history.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_tools_usage.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/tests/test_integration.py`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/examples/claude_code_user.sh`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/examples/hermes_config.yaml`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/examples/cursor_mcp.json`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/examples/codex_mcp_servers.json`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/docs/HARNESS_SETUP.md`
- `C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server/docs/TOOLS.md`

### Pliki NIERUSZANE
- `C:/Users/user/Documents/VIBELIFE2026/TTS_hub/**` — TTShub jest konsumowany wyłącznie przez HTTP. Zero zmian w Rust.

---

## Testy / Walidacja

### Po każdym tasku
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
uv run pytest tests/ -v
uv run ruff check src tests
```

### Po Task 5 (generate_speech tool)
- 7 testów w `test_tools_generate.py` — wszystkie przechodzą.
- Weryfikacja footgun: provider="minimax" zawsze w body dla sklonowanych głosów.

### Po Task 7 (server.py)
- Wszystkie 7 tooli zarejestrowanych.
- Annotations poprawne (readOnlyHint, destructiveHint).
- `uv run ttshub-mcp` startuje bez crash.

### Po Task 9 (integration)
- 30+ testów przechodzi.
- End-to-end: list_voices → generate_speech → JSON response z id.

### Po Task 10 (publish)
- `uvx --from ttshub-mcp-server ttshub-mcp` startuje (po PyPI publish) LUB `uv run` z lokalnego checkout.
- `claude mcp list` po `claude mcp add` pokazuje `ttshub`.
- Test w Claude Code: prompt "generate audio z tekstem X głosem Y" → Claude wywołuje tool → zwraca URL.

---

## Ryzyka, Tradeoffy, Open Questions

### Ryzyka
1. **Cursor/Codex MCP support zależy od wersji** — Cursor dodał MCP w późnym 2024, Codex CLI ma MCP w nowszych wersjach. Jeśli Kuba ma starą wersję któregoś z tych klientów, MCP może nie działać. Rozwiązanie: każdy `examples/*.json` ma fallback na własny config w starszych wersjach (Cursor: `~/.cursor/mcp.json` vs UI; Codex: `~/.codex/mcp_servers.json` vs `codex mcp add` CLI).
2. **`uvx` wymaga uv** — jeśli harness nie ma uv (np. Cursor bez zainstalowanego uv), trzeba alternatywę. Rozwiązanie: opcjonalnie dostarczyć `pip install ttshub-mcp-server` + entry point `ttshub-mcp` (musi być w PATH).
3. **TTShub origin attribution leakage** — `TTSHUB_ORIGIN_USER_NAME` to PII (imię). LLM w harnessie może to zobaczyć. Rozwiązanie: domyślnie None, tylko explicit env var.
4. **Brak MCP HTTP transport** — jeśli Kuba chce używać TTShub zdalnie (np. w kontenerze), stdio nie wystarczy. Planowaliśmy to w v0.2.
5. **Generowanie jest blocking** — LLM czeka 2-8s na odpowiedź. Przy `queued` jobs (przy 60 RPM) to dłużej. Rozwiązanie: w v0.2 dodać opcję `wait=false` która zwraca natychmiast `job_id` zamiast czekać.

### Tradeoffy
- **Python vs Rust MCP** — Python szybszy w rozwoju, lepsze wsparcie harnessów. Rustowa wersja (rmcp) byłaby szybsza ale wymagałaby kompilacji per platforma i każdy harness musiałby obsłużyć binarkę. Python + uvx = zero-config install, wybór pragmatyczny.
- **FastMCP vs niskopoziomowy MCP** — FastMCP to high-level wrapper, mniej kodu. Mniej kontroli nad subtletnościami protokołu (np. progress notifications). W v0.2 jeśli będzie potrzeba progress bar dla długich generacji, przejście na niskopoziomowy `Server` API.
- **Respx vs WireMock vs nock** — respx to standard dla httpx (mamy już httpx), naturalny wybór.

### Open Questions (do Kuby)
1. **Czy publikować na PyPI** (`uv publish`) czy tylko GitHub install (`uv add git+...`)? PyPI = łatwiejszy install dla userów, ale wymaga konta + token + maintenance (wheels dla każdej wersji Pythona, yanking broken versions). GitHub install = zero overhead, ale mniej wygodne (`uvx --from git+...`).
2. **Nazwa pakietu PyPI** — `ttshub-mcp-server` czy `ttshub-mcp` (krótsza, ale może kolidować z czymś)? Sprawdzić na PyPI przed publikacją.
3. **Open source czy prywatne** — TTShub jest obecnie w `TOPKEK-MAIN` (prawdopodobnie publiczny jeśli masz GitHub pod xcwajdax). MCP server jako osobne publiczne repo, czy prywatne? Jeśli publiczne, dodaj LICENSE (MIT) i code of conduct.
4. **Test w Claude Code** — czy mam uruchomić smoke test live z Twoim TTShub w tej sesji (wymaga działającego TTShub), czy tylko z mockami? Live test pokaże realne zachowanie, ale zależy od stanu TTShub na Twojej maszynie.
5. **Czy chcesz też HTTP/SSE transport** w v0.1 (więcej kodu, ale remote TTShub działa), czy tylko stdio w v0.1 i SSE w v0.2?

### Decyzje podjęte w planie (bez czekania)
- **Język: Python** (nie Rust).
- **Transport: stdio** (nie HTTP/SSE w v0.1).
- **FastMCP** (nie niskopoziomowy Server API).
- **7 tooli** (4 read-only + 1 write + 2 utility) — minimalny sensowny zestaw.
- **Footgun guard automatyczny** (provider="minimax" dla sklonowanych głosów) — LLM nie musi o tym wiedzieć.
- **Origin attribution default**: kind="mcp", user_name z env var.
- **Testy z respx** (mock httpx) + realne testy integracyjne z mock TTShub.

---

## Verification Final

Po wykonaniu wszystkich 10 tasków:

```bash
# 1. Repo gotowe
cd "C:/Users/user/Documents/VIBELIFE2026/ttshub-mcp-server"
git log --oneline   # 10 commitów

# 2. Testy
uv run pytest tests/ -v
# Expected: 30+ passed

# 3. Lint
uv run ruff check src tests
# Expected: 0 errors

# 4. Build
uv build
ls dist/
# Expected: ttshub_mcp_server-0.1.0-py3-none-any.whl, ttshub_mcp_server-0.1.0.tar.gz

# 5. Server startuje
uv run ttshub-mcp &
PID=$!
sleep 2
kill $PID 2>/dev/null
# Powinien wypisać JSON-RPC handshake na stdout (MCP init), bez crashy

# 6. Live test (jeśli TTShub działa)
TTSHUB_BASE_URL=http://127.0.0.1:8765 uv run ttshub-mcp &
# W Claude Code: claude mcp add ttshub --scope user -e TTSHUB_BASE_URL=http://127.0.0.1:8765 -- uv run --project . ttshub-mcp
# W sesji Claude: "Wygeneruj audio z 'Test MCP' głosem grzegorz_braun"
# Claude powinien wywołać ttshub_generate_speech i zwrócić URL
```

Jeśli wszystko 10/10 zielone — MCP server jest gotowy jako connector dla Claude Code, Hermesa, Cursora, Codexa i OpenClawa.
