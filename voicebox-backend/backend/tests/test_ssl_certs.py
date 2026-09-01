"""Stale SSL_CERT_FILE / certifi bundle repair."""

import os
from pathlib import Path

from backend.utils.ssl_certs import ensure_ssl_cert_bundle


def test_drops_missing_ca_bundle_path(monkeypatch, tmp_path):
    stale = "/var/folders/w_/d8yv26s93dn9h3rjn9xwnqx40000gn/T/_MEItCp04f/certifi/cacert.pem"
    monkeypatch.setenv("SSL_CERT_FILE", stale)
    monkeypatch.setenv("REQUESTS_CA_BUNDLE", stale)
    monkeypatch.setenv("CURL_CA_BUNDLE", stale)

    good = tmp_path / "cacert.pem"
    good.write_text("dummy-ca\n", encoding="utf-8")
    monkeypatch.setattr(
        "backend.utils.ssl_certs._candidate_bundles",
        lambda: [good],
    )

    # Force re-apply: the package import may have already run the helper.
    import backend.utils.ssl_certs as ssl_certs

    ssl_certs._applied = False
    path = ensure_ssl_cert_bundle()

    assert path == str(good.resolve())
    assert os.environ["SSL_CERT_FILE"] == path
    assert os.environ["REQUESTS_CA_BUNDLE"] == path
    assert Path(os.environ["SSL_CERT_FILE"]).is_file()


def test_clears_stale_env_when_no_bundle(monkeypatch):
    stale = "Z:\\missing\\certifi\\cacert.pem"
    monkeypatch.setenv("SSL_CERT_FILE", stale)
    monkeypatch.setenv("REQUESTS_CA_BUNDLE", stale)

    import backend.utils.ssl_certs as ssl_certs

    ssl_certs._applied = False
    monkeypatch.setattr("backend.utils.ssl_certs._candidate_bundles", lambda: [])

    path = ensure_ssl_cert_bundle()

    assert path is None
    assert "SSL_CERT_FILE" not in os.environ
    assert "REQUESTS_CA_BUNDLE" not in os.environ
