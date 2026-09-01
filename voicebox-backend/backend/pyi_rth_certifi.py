"""PyInstaller runtime hook: drop stale TLS CA env vars before HTTPS clients load.

Must not import the ``backend`` package — runtime hooks run before the app
bootstrap. Keep this stdlib-only plus optional certifi.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

_SSL_ENV_VARS = ("SSL_CERT_FILE", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE")


def _usable(path: Path) -> bool:
    try:
        return path.is_file() and path.stat().st_size > 0
    except OSError:
        return False


for _key in _SSL_ENV_VARS:
    _raw = os.environ.get(_key)
    if _raw and not _usable(Path(_raw)):
        os.environ.pop(_key, None)

_bundle: Path | None = None
try:
    import certifi

    _c = Path(certifi.where())
    if _usable(_c):
        _bundle = _c
except Exception:
    pass

if _bundle is None:
    _meipass = getattr(sys, "_MEIPASS", None)
    if _meipass:
        _c = Path(_meipass) / "certifi" / "cacert.pem"
        if _usable(_c):
            _bundle = _c

if _bundle is not None:
    _path = str(_bundle.resolve())
    for _key in _SSL_ENV_VARS:
        os.environ[_key] = _path
