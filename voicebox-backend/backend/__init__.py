# Backend package

__version__ = "0.4.1"

# Must run before huggingface_hub / requests / httpx first HTTPS call.
from .utils.ssl_certs import ensure_ssl_cert_bundle as _ensure_ssl_cert_bundle
from .utils.spacy_pkuseg_data import ensure_spacy_pkuseg_dicts as _ensure_spacy_pkuseg_dicts

_ensure_ssl_cert_bundle()
_ensure_spacy_pkuseg_dicts()
