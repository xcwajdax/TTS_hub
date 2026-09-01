"""Stale PyInstaller _MEI path repair for spacy_pkuseg dicts."""

import sys
import types
from pathlib import Path

from backend.utils import spacy_pkuseg_data as pkuseg_data


def _write_pkl(pkg: Path) -> Path:
    dicts = pkg / "dicts"
    dicts.mkdir(parents=True, exist_ok=True)
    pkl = dicts / "default.pkl"
    pkl.write_bytes(b"dummy-pkuseg-dict")
    return pkl


def test_copies_dicts_into_current_meipass(tmp_path, monkeypatch):
    source_pkg = tmp_path / "site" / "spacy_pkuseg"
    _write_pkl(source_pkg)
    (source_pkg / "__init__.py").write_text("", encoding="utf-8")

    mei_root = tmp_path / "_MEIfake"
    dest_pkg = mei_root / "spacy_pkuseg"
    dest_pkg.mkdir(parents=True)
    (dest_pkg / "__init__.py").write_text("", encoding="utf-8")

    fake_mod = types.SimpleNamespace(__file__=str(dest_pkg / "__init__.py"))
    monkeypatch.setitem(sys.modules, "spacy_pkuseg", fake_mod)
    monkeypatch.setattr(sys, "_MEIPASS", str(mei_root), raising=False)
    monkeypatch.setattr(
        pkuseg_data,
        "_candidate_package_dirs",
        lambda: [source_pkg, dest_pkg],
    )
    pkuseg_data._applied = False

    result = pkuseg_data.ensure_spacy_pkuseg_dicts()

    restored = dest_pkg / "dicts" / "default.pkl"
    assert restored.is_file()
    assert Path(result) == restored.resolve()


def test_drops_stale_import_when_mei_is_gone(tmp_path, monkeypatch):
    source_pkg = tmp_path / "site" / "spacy_pkuseg"
    source_pkl = _write_pkl(source_pkg)
    (source_pkg / "__init__.py").write_text("", encoding="utf-8")

    dead = Path("/private/var/folders/w_/gone/T/_MEItCp04f/spacy_pkuseg/__init__.py")
    fake_mod = types.SimpleNamespace(__file__=str(dead))
    monkeypatch.setitem(sys.modules, "spacy_pkuseg", fake_mod)
    monkeypatch.setitem(sys.modules, "spacy_pkuseg.feature_extractor", fake_mod)
    monkeypatch.delattr(sys, "_MEIPASS", raising=False)
    monkeypatch.setattr(pkuseg_data, "_candidate_package_dirs", lambda: [source_pkg])
    pkuseg_data._applied = False

    result = pkuseg_data.ensure_spacy_pkuseg_dicts()

    assert "spacy_pkuseg" not in sys.modules
    assert "spacy_pkuseg.feature_extractor" not in sys.modules
    assert Path(result) == source_pkl.resolve()


def test_patch_swallows_missing_dicts():
    class FakeConverter:
        def _init_segmenter(self):
            raise FileNotFoundError(
                "[Errno 2] No such file or directory: "
                "'/private/var/folders/w_/x/T/_MEItCp04f/spacy_pkuseg/dicts/default.pkl'"
            )

    FakeConverter._tts_hub_pkuseg_patched = False
    orig_import = pkuseg_data.importlib.import_module

    def fake_import(name, *args, **kwargs):
        if name == "chatterbox.models.tokenizers.tokenizer":
            return types.SimpleNamespace(ChineseCangjieConverter=FakeConverter)
        return orig_import(name, *args, **kwargs)

    pkuseg_data.importlib.import_module = fake_import  # type: ignore[method-assign]
    try:
        assert pkuseg_data.patch_chatterbox_pkuseg_segmenter() is True
        inst = FakeConverter()
        inst._init_segmenter()
        assert inst.segmenter is None
    finally:
        pkuseg_data.importlib.import_module = orig_import
