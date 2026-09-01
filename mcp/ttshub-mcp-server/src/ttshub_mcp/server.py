"""TTS Hub MCP server — exposes the local TTS Hub HTTP API as MCP tools."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

LOG = logging.getLogger("ttshub-mcp")
logging.basicConfig(level=os.environ.get("TTSHUB_MCP_LOG_LEVEL", "INFO"))


def _base_url() -> str:
    return os.environ.get("TTSHUB_BASE_URL", "http://127.0.0.1:8765").rstrip("/")


def _env_default_voice() -> str:
    """Env fallback używany tylko gdy backend nieosiągalny."""
    return os.environ.get("TTSHUB_DEFAULT_VOICE", "")


def _env_default_model() -> str:
    return os.environ.get("TTSHUB_DEFAULT_MODEL", "")


def _default_format() -> str:
    return os.environ.get("TTSHUB_DEFAULT_FORMAT", "wav")


def _user_agent() -> str:
    origin = os.environ.get("TTSHUB_ORIGIN_USER_NAME") or "ttshub-mcp"
    return f"TTS-Hub-MCP/0.1 (+{origin})"


def _client() -> httpx.Client:
    return httpx.Client(
        base_url=_base_url(),
        timeout=httpx.Timeout(30.0, read=180.0),
        headers={"User-Agent": _user_agent(), "Accept": "application/json"},
    )


def _compact(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, indent=2)
    except TypeError:
        return str(value)


def _check_backend() -> str | None:
    try:
        r = httpx.get(
            f"{_base_url()}/health",
            timeout=3.0,
            headers={"User-Agent": _user_agent()},
        )
        if r.status_code == 200 and r.json().get("ok"):
            return None
        return f"TTS Hub backend returned HTTP {r.status_code} on /health: {r.text[:200]}"
    except Exception as exc:  # noqa: BLE001
        return (
            f"TTS Hub backend not reachable at {_base_url()}: {exc}. "
            "Uruchom aplikację TTS Hub (okno Tauri) — backend HTTP musi nasłuchiwać na :8765."
        )


# === Defaults z backendu (zamiast hardkodowanego "google"/"Kore") =============
# Defaulty są pobierane z `GET /providers/enabled` i `GET /cursor/config`,
# cache'owane na 60 s. Wcześniejsza wersja hardkodowała Gemini/Kore jako
# „domyślne” — gdy użytkownik nie miał skonfigurowanego Google, request
# leciał do Google Gemini z modelem MiniMax i wracał z 404. (2026-09-01)


@dataclass
class BackendDefaults:
    """Migawka konfiguracji pobrana z TTS Hub backendu."""

    default_provider: str = "minimax"  # fallback gdy backend martwy
    enabled_providers: list[str] = field(default_factory=list)
    default_model: str = ""           # model z cursor_integration (provider-aware)
    default_voice: str = ""
    loaded_at: float = 0.0


_DEFAULTS: BackendDefaults | None = None
_DEFAULTS_LOCK = threading.Lock()
_DEFAULTS_TTL = 60.0  # sekund


def _refresh_defaults() -> BackendDefaults:
    """Pobierz `GET /providers/enabled` + `GET /cursor/config`, złóż migawkę."""
    cfg = BackendDefaults()
    try:
        with _client() as c:
            r = c.get("/providers/enabled", timeout=3.0)
            if r.status_code == 200:
                body = r.json()
                cfg.enabled_providers = [
                    str(p).strip().lower()
                    for p in (body.get("enabled") or [])
                    if str(p).strip()
                ]
                def_p = body.get("default")
                if isinstance(def_p, str) and def_p.strip():
                    cfg.default_provider = def_p.strip().lower()
            r2 = c.get("/cursor/config", timeout=3.0)
            if r2.status_code == 200:
                body = r2.json()
                m = body.get("model")
                v = body.get("voice")
                if isinstance(m, str) and m.strip():
                    cfg.default_model = m.strip()
                if isinstance(v, str) and v.strip():
                    cfg.default_voice = v.strip()
    except httpx.HTTPError as exc:
        LOG.warning("Nie mogę odczytać defaultów z backendu: %s", exc)
    cfg.loaded_at = time.monotonic()
    return cfg


def _defaults() -> BackendDefaults:
    global _DEFAULTS
    with _DEFAULTS_LOCK:
        if _DEFAULTS is None or (time.monotonic() - _DEFAULTS.loaded_at) > _DEFAULTS_TTL:
            _DEFAULTS = _refresh_defaults()
        return _DEFAULTS


def _default_model() -> str:
    """Env > backend cursor_config.model > pustka (wymusimy jawną wartość)."""
    env = _env_default_model()
    if env:
        return env
    d = _defaults()
    if d.default_model:
        return d.default_model
    # Ostateczny fallback: model z domyślnego providera (z backendu).
    # Jeśli to google i nie jest w enabled_providers — caller dostanie błąd.
    return ""


def _default_voice() -> str:
    env = _env_default_voice()
    if env:
        return env
    d = _defaults()
    if d.default_voice:
        return d.default_voice
    return ""


def _instructions() -> str:
    d = _defaults()
    enabled = ", ".join(d.enabled_providers) if d.enabled_providers else "brak (sprawdź aplikację TTS Hub)"
    model = _default_model() or "(brak)"
    voice = _default_voice() or "(brak)"
    return (
        "Lokalny most do aplikacji TTS Hub (desktop, HTTP API na 127.0.0.1:8765). "
        "Przed pierwszą generacją sprawdź `health`. "
        f"Domyślny provider: {d.default_provider}. "
        f"Skonfigurowani providerzy: {enabled}. "
        f"Domyślny model: {model}. Domyślny głos: {voice}. "
        "Jeśli `provider` nie jest podany, backend użyje `cursor_integration.provider` "
        "(zazwyczaj minimax). Gdy provider nie jest włączony w kreatorze Szybka "
        "konfiguracja, request zwróci HTTP 422 z listą dostępnych providerów."
    )


mcp = FastMCP(
    "ttshub",
    instructions=(
        "Lokalny most do aplikacji TTS Hub (desktop, HTTP API na 127.0.0.1:8765). "
        "Przed pierwszą generacją sprawdź `health`."
    ),
)


@mcp.tool()
def health() -> str:
    """Sprawdź, czy backend TTS Hub na :8765 odpowiada."""
    err = _check_backend()
    if err:
        return f"ERROR: {err}"
    with _client() as c:
        r = c.get("/health")
        return _compact(r.json())


@mcp.tool()
def list_voices() -> str:
    """Lista głosów Gemini TTS (~30 pozycji)."""
    err = _check_backend()
    if err:
        return f"ERROR: {err}"
    with _client() as c:
        r = c.get("/voices")
        r.raise_for_status()
        return _compact({"voices": r.json()})


@mcp.tool()
def list_minimax_languages() -> str:
    """Lista języków obsługiwanych przez provider MiniMax (kody `pl`, `en` itd.)."""
    err = _check_backend()
    if err:
        return f"ERROR: {err}"
    with _client() as c:
        r = c.get("/minimax/languages")
        r.raise_for_status()
        return _compact({"languages": r.json()})


@mcp.tool()
def get_cursor_config() -> str:
    """Aktualna konfiguracja integracji Cursor (provider, model, voice, filtry)."""
    err = _check_backend()
    if err:
        return f"ERROR: {err}"
    with _client() as c:
        r = c.get("/cursor/config")
        r.raise_for_status()
        return _compact(r.json())


@mcp.tool()
def list_enabled_providers() -> str:
    """Lista providerów włączonych w kreatorze Szybka konfiguracja + domyślny provider."""
    err = _check_backend()
    if err:
        return f"ERROR: {err}"
    with _client() as c:
        r = c.get("/providers/enabled")
        r.raise_for_status()
        # Odśwież też wewnętrzny cache, żeby kolejne generacje nie czekały na TTL.
        global _DEFAULTS
        with _DEFAULTS_LOCK:
            body = r.json()
            d = _DEFAULTS or BackendDefaults()
            d.enabled_providers = [
                str(p).strip().lower()
                for p in (body.get("enabled") or [])
                if str(p).strip()
            ]
            def_p = body.get("default")
            if isinstance(def_p, str) and def_p.strip():
                d.default_provider = def_p.strip().lower()
            d.loaded_at = time.monotonic()
            _DEFAULTS = d
        return _compact(r.json())


@mcp.tool()
def preview_text_filter(
    text: str,
    preset: dict[str, Any] | None = None,
) -> str:
    """Podejrzyj wynik filtrów tekstu (np. usuwanie bloków kodu) bez generowania audio.

    Args:
        text: Tekst wejściowy.
        preset: Opcjonalny preset filtrów (slug ID lub obiekt `{id,name,builtins,custom}`).
            Jeśli pominięty, backend użyje presetu domyślnego z integracji Cursor.
    """
    err = _check_backend()
    if err:
        return f"ERROR: {err}"
    body: dict[str, Any] = {"text": text}
    if preset is not None:
        body["preset"] = preset
    with _client() as c:
        r = c.post("/text/filter", json=body)
        r.raise_for_status()
        return _compact(r.json())


def _resolve_provider(provider: str | None, model: str | None) -> tuple[str | None, str | None]:
    """Zwraca (provider_do_wysłania, ewentualny_błąd_walidacji).

    Jeśli caller podał provider jawnie → używamy go (po walidacji).
    Jeśli nie podał → zostawiamy None, backend użyje `cursor_integration.provider`
    (który też jest walidowany po stronie backendu).
    NIE inferujemy provider z prefiksu modelu — kiedyś to robiliśmy i był z tego
    cichy bug: MiniMax leciał do Google, bo caller nie podał providera explicite. (2026-09-01)
    """
    if provider is None:
        return None, None
    p = provider.strip().lower()
    if not p:
        return None, None
    allowed = {"google", "voicebox", "minimax"}
    if p not in allowed:
        return None, (
            f"ERROR: unknown provider '{p}'. Allowed: "
            + ", ".join(sorted(allowed))
            + ". Sprawdź, czy provider jest włączony w kreatorze Szybka konfiguracja."
        )
    d = _defaults()
    if d.enabled_providers and p not in d.enabled_providers:
        available = ", ".join(d.enabled_providers)
        return None, (
            f"ERROR: provider '{p}' is not configured (Quick Setup wyłączył tego "
            f"providera). Available: [{available}]. Wywołaj list_enabled_providers(), "
            "żeby zobaczyć aktualną listę."
        )
    return p, None


@mcp.tool()
def generate_speech(
    text: str,
    model: str | None = None,
    voice: str | None = None,
    format: str | None = None,
    style: str | None = None,
    provider: str | None = None,
    language: str | None = None,
    summary_text: str | None = None,
    context_label: str | None = None,
    autoplay: bool = False,
) -> str:
    """Wygeneruj mowę przez TTS Hub. Zwraca obiekt `Generation` z `audio_url`.

    Args:
        text: Tekst do syntezy (max kilka tysięcy znaków).
        model: Identyfikator modelu, np. `gemini-2.5-flash-preview-tts`, `speech-2.8-hd`, `voicebox:chatterbox`.
            Domyślnie `TTSHUB_DEFAULT_MODEL` (env) albo model z `cursor_integration` (backend).
        voice: Nazwa głosu, np. `Kore`, `grzegorz_braun`. Domyślnie `TTSHUB_DEFAULT_VOICE` (env) albo głos z `cursor_integration`.
        format: `wav`, `mp3` lub `ogg`. MP3/OGG wymagają `ffmpeg` w PATH.
        style: Prompt sterujący stylem wypowiedzi (np. "Powiedz spokojnie po polsku:").
        provider: `google`, `voicebox` albo `minimax`. **Jeśli pominięty, backend użyje
            `cursor_integration.provider` (zazwyczaj `minimax`)** — żadnej heurystyki z
            prefiksu modelu. Jeśli caller poda provider, który nie jest włączony w
            kreatorze Szybka konfiguracja, dostanie błąd przed wywołaniem backendu.
        language: Kod hub (np. `pl`, `en`) — dla MiniMax mapowany na `language_boost`.
        summary_text: Opcjonalny skrót z poprzedzającego kontekstu (pierwszeństwo przed `text`).
        context_label: Etykieta projektu/sesji (badge w historii).
        autoplay: Po zakończeniu joba wyślij zdarzenie `generation:ready` w aplikacji.
    """
    err = _check_backend()
    if err:
        return f"ERROR: {err}"

    resolved_provider, provider_err = _resolve_provider(provider, model)
    if provider_err:
        return provider_err

    payload: dict[str, Any] = {
        "text": text,
        "model": model or _default_model(),
        "voice": voice or _default_voice(),
        "format": format or _default_format(),
    }
    if not payload["model"]:
        return (
            "ERROR: brak domyślnego modelu. Ustaw `TTSHUB_DEFAULT_MODEL` albo "
            "wywołaj `list_enabled_providers()` żeby sprawdzić konfigurację backendu."
        )
    if not payload["voice"]:
        return (
            "ERROR: brak domyślnego głosu. Ustaw `TTSHUB_DEFAULT_VOICE` albo "
            "wywołaj `list_enabled_providers()` żeby sprawdzić konfigurację backendu."
        )
    if style is not None:
        payload["style"] = style
    if resolved_provider is not None:
        payload["provider"] = resolved_provider
    if language is not None:
        payload["language"] = language
    if summary_text is not None:
        payload["summary_text"] = summary_text
    if context_label is not None:
        payload["context_label"] = context_label
    payload["autoplay"] = bool(autoplay)
    payload["source"] = "ttshub-mcp"

    with _client() as c:
        try:
            r = c.post("/generate", json=payload, timeout=300.0)
        except httpx.HTTPError as exc:
            return f"ERROR: HTTP error calling /generate: {exc}"
        if r.status_code == 422:
            # Provider włączony u nas, ale backend i tak odrzucił (np. model nie
            # pasuje do providera). Przepuść komunikat 1:1.
            return (
                f"ERROR: backend odrzucił request (HTTP 422). "
                f"{r.text[:500]}. Wywołaj `list_enabled_providers()` i "
                "upewnij się, że model i provider się zgadzają."
            )
        if r.status_code >= 400:
            return f"ERROR: HTTP {r.status_code} from /generate: {r.text[:500]}"
        gen = r.json()
        if "id" in gen:
            gen["audio_url"] = f"{_base_url()}/audio/{gen['id']}"
        return _compact(gen)


@mcp.tool()
def list_history(
    scope: str = "session",
    folder_id: str | None = None,
    limit: int = 50,
) -> str:
    """Lista generacji (sesja bieżąca lub archiwum).

    Args:
        scope: `session` (domyślnie) lub `archive`.
        folder_id: Dla `archive` — `__none__` (bez folderu), `__all__` albo ID folderu.
        limit: Ile pozycji zwrócić (przycinanie po stronie klienta).
    """
    err = _check_backend()
    if err:
        return f"ERROR: {err}"
    params: dict[str, Any] = {"scope": scope}
    if folder_id is not None:
        params["folder_id"] = folder_id
    with _client() as c:
        r = c.get("/history", params=params)
        r.raise_for_status()
        items = r.json()
        if isinstance(items, list) and limit and len(items) > limit:
            items = items[:limit]
        return _compact({"count": len(items) if isinstance(items, list) else None, "items": items})


@mcp.tool()
def archive_generation(generation_id: str, target_format: str = "mp3") -> str:
    """Przenieś generację do archiwum (z opcjonalną konwersją do MP3/OGG).

    Args:
        generation_id: UUID generacji (z `list_history` lub `generate_speech`).
        target_format: `wav` (domyślnie), `mp3` lub `ogg`.
    """
    err = _check_backend()
    if err:
        return f"ERROR: {err}"
    with _client() as c:
        r = c.post(
            f"/history/{generation_id}/archive",
            json={"format": target_format},
        )
        r.raise_for_status()
        return _compact(r.json() if r.content else {"ok": True, "id": generation_id})


@mcp.tool()
def delete_generation(generation_id: str) -> str:
    """Usuń generację (plik audio + wpis w historii)."""
    err = _check_backend()
    if err:
        return f"ERROR: {err}"
    with _client() as c:
        r = c.delete(f"/history/{generation_id}")
        r.raise_for_status()
        return _compact({"ok": True, "id": generation_id})


def main() -> None:
    LOG.info("Starting ttshub-mcp; backend=%s", _base_url())
    d = _refresh_defaults()
    LOG.info(
        "Backend defaults: provider=%s, enabled=%s, model=%s, voice=%s",
        d.default_provider,
        d.enabled_providers or "(brak)",
        d.default_model or "(brak)",
        d.default_voice or "(brak)",
    )
    err = _check_backend()
    if err:
        LOG.warning(err)
    # FastMCP: instrukcje dla klienta MCP — wstrzykujemy aktualne defaulty
    # backendu, żeby caller widział provider/model/voice bez konieczności
    # odpytywania list_enabled_providers(). (2026-09-01)
    try:
        mcp.instructions = _instructions()
    except Exception:  # noqa: BLE001
        LOG.warning("Nie udało się ustawić mcp.instructions; zostaję przy statycznych.")
    mcp.run()


if __name__ == "__main__":
    main()