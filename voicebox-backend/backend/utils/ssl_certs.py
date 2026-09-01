"""Fix stale TLS CA bundle env vars (PyInstaller _MEI + certifi).

huggingface_hub / requests / httpx read SSL_CERT_FILE, REQUESTS_CA_BUNDLE,
and CURL_CA_BUNDLE. A previous Voicebox onefile extract leaves those pointing
at a deleted temp path (macOS ``/var/folders/.../_MEI.../certifi/cacert.pem``
or Windows ``%TEMP%\\_MEI...``). The next HTTPS call then fails immediately
with ``Could not find a suitable TLS CA certificate bundle``.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

_SSL_ENV_VARS = ("SSL_CERT_FILE", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE")
_applied = False


def _is_usable_bundle(path: Path) -> bool:
    try:
        return path.is_file() and path.stat().st_size > 0
    except OSError:
        return False


def _candidate_bundles() -> list[Path]:
    found: list[Path] = []
    try:
        import certifi

        found.append(Path(certifi.where()))
    except Exception:
        pass

    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        found.append(Path(meipass) / "certifi" / "cacert.pem")

    exe_dir = Path(sys.executable).resolve().parent
    found.append(exe_dir / "certifi" / "cacert.pem")
    found.append(exe_dir / "cacert.pem")
    return found


def ensure_ssl_cert_bundle() -> str | None:
    """Drop invalid CA env vars and point HTTPS clients at a real cacert.pem."""
    global _applied

    for key in _SSL_ENV_VARS:
        raw = os.environ.get(key)
        if not raw:
            continue
        if not _is_usable_bundle(Path(raw)):
            logger.warning("Ignoring stale %s=%s", key, raw)
            os.environ.pop(key, None)

    bundle: Path | None = None
    for candidate in _candidate_bundles():
        if _is_usable_bundle(candidate):
            bundle = candidate
            break

    if bundle is None:
        _applied = True
        return None

    path = str(bundle.resolve())
    for key in _SSL_ENV_VARS:
        os.environ[key] = path

    try:
        import certifi

        current = Path(certifi.where())
        if not _is_usable_bundle(current):
            certifi.where = lambda: path  # type: ignore[method-assign]
    except Exception:
        pass

    if not _applied:
        logger.info("TLS CA bundle: %s", path)
    _applied = True
    return path
