"""Repair stale PyInstaller _MEI paths for spacy_pkuseg data files.

Chatterbox multilingual always constructs ``ChineseCangjieConverter``, which
calls ``spacy_pkuseg.pkuseg()``. That opens ``dicts/default.pkl`` next to the
package — even when the utterance is Polish. A previous Voicebox onefile
extract leaves ``__file__`` pointing at a deleted temp path
(macOS ``/var/folders/.../_MEI.../spacy_pkuseg/dicts/default.pkl`` or
Windows ``%TEMP%\\_MEI...``). Generation then fails with ``[Errno 2]``.
"""

from __future__ import annotations

import importlib
import importlib.util
import logging
import shutil
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

_PKL_REL = Path("dicts") / "default.pkl"
_applied = False


def _is_usable_pkl(path: Path) -> bool:
    try:
        return path.is_file() and path.stat().st_size > 0
    except OSError:
        return False


def _pkg_dir_from_origin(origin: str | None) -> Path | None:
    if not origin:
        return None
    path = Path(origin)
    # .so / .pyd / __init__.py all live in the package directory
    return path.parent if path.suffix else path


def _candidate_package_dirs() -> list[Path]:
    found: list[Path] = []

    imported = sys.modules.get("spacy_pkuseg")
    origin = getattr(imported, "__file__", None) if imported is not None else None
    pkg = _pkg_dir_from_origin(origin)
    if pkg is not None:
        found.append(pkg)

    try:
        spec = importlib.util.find_spec("spacy_pkuseg")
    except (ImportError, ValueError, ModuleNotFoundError):
        spec = None
    if spec is not None:
        pkg = _pkg_dir_from_origin(spec.origin)
        if pkg is not None:
            found.append(pkg)
        for loc in spec.submodule_search_locations or []:
            found.append(Path(loc))

    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        found.append(Path(meipass) / "spacy_pkuseg")

    exe_dir = Path(sys.executable).resolve().parent
    found.append(exe_dir / "spacy_pkuseg")
    found.append(exe_dir / "_internal" / "spacy_pkuseg")

    try:
        import importlib.metadata as md

        dist = md.distribution("spacy-pkuseg")
        for file in dist.files or []:
            rel = str(file).replace("\\", "/")
            if rel.endswith("spacy_pkuseg/__init__.py"):
                found.append(Path(dist.locate_file(file)).parent)
                break
    except Exception:
        pass

    unique: list[Path] = []
    seen: set[str] = set()
    for path in found:
        key = str(path)
        if key in seen:
            continue
        seen.add(key)
        unique.append(path)
    return unique


def _find_source_pkl() -> Path | None:
    for pkg in _candidate_package_dirs():
        pkl = pkg / _PKL_REL
        if _is_usable_pkl(pkl):
            return pkl
    return None


def _drop_imported_pkuseg() -> None:
    for name in list(sys.modules):
        if name == "spacy_pkuseg" or name.startswith("spacy_pkuseg."):
            del sys.modules[name]


def _purge_missing_mei_from_sys_path() -> None:
    kept: list[str] = []
    removed = False
    for entry in sys.path:
        marker = entry.replace("\\", "/").lower()
        if "_mei" in marker and not Path(entry).exists():
            removed = True
            continue
        kept.append(entry)
    if removed:
        sys.path[:] = kept


def _under_current_meipass(path: Path) -> bool:
    meipass = getattr(sys, "_MEIPASS", None)
    if not meipass:
        return False
    try:
        path.resolve().relative_to(Path(meipass).resolve())
        return True
    except (ValueError, OSError):
        return False


def _copy_pkuseg_data(src_pkg: Path, dest_pkg: Path) -> None:
    for rel in ("dicts", "models"):
        src = src_pkg / rel
        if not src.is_dir():
            continue
        for item in src.rglob("*"):
            if not item.is_file():
                continue
            target = dest_pkg / rel / item.relative_to(src)
            if _is_usable_pkl(target) if target.name.endswith(".pkl") else target.is_file():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


def _should_restore_inplace(expected_pkl: Path) -> bool:
    if _under_current_meipass(expected_pkl):
        return True
    pkg = expected_pkl.parent.parent
    try:
        return pkg.is_dir()
    except OSError:
        return False


def ensure_spacy_pkuseg_dicts() -> str | None:
    """Return a usable ``dicts/default.pkl`` path, repairing stale _MEI copies."""
    global _applied

    source = _find_source_pkl()
    imported = sys.modules.get("spacy_pkuseg")
    expected: Path | None = None
    origin = getattr(imported, "__file__", None) if imported is not None else None
    pkg = _pkg_dir_from_origin(origin)
    if pkg is not None:
        expected = pkg / _PKL_REL
        if _is_usable_pkl(expected):
            _applied = True
            return str(expected.resolve())

    if source is not None and expected is not None and _should_restore_inplace(expected):
        try:
            _copy_pkuseg_data(source.parent.parent, expected.parent.parent)
            if _is_usable_pkl(expected):
                if not _applied:
                    logger.info("Restored spacy_pkuseg dicts at %s", expected)
                _applied = True
                return str(expected.resolve())
        except OSError as exc:
            logger.warning("Could not restore spacy_pkuseg dicts at %s: %s", expected, exc)

    if expected is not None and not _is_usable_pkl(expected):
        _drop_imported_pkuseg()
        _purge_missing_mei_from_sys_path()

    if source is not None:
        if not _applied:
            logger.info("spacy_pkuseg dicts: %s", source)
        _applied = True
        return str(source.resolve())

    _applied = True
    return None


def patch_chatterbox_pkuseg_segmenter() -> bool:
    """Make missing pkuseg data skip Chinese segmentation instead of failing TTS."""
    for mod_name in (
        "chatterbox.models.tokenizers.tokenizer",
        "chatterbox.models.tokenizers",
    ):
        try:
            mod = importlib.import_module(mod_name)
        except ImportError:
            continue
        cls = getattr(mod, "ChineseCangjieConverter", None)
        if cls is None:
            continue
        if getattr(cls, "_tts_hub_pkuseg_patched", False):
            return True

        orig = cls._init_segmenter

        def _safe_init(self, *args, _orig=orig, **kwargs):
            try:
                ensure_spacy_pkuseg_dicts()
                _orig(self, *args, **kwargs)
            except Exception as exc:
                logger.warning(
                    "spacy_pkuseg unavailable (%s); Chinese segmentation skipped",
                    exc,
                )
                self.segmenter = None

        cls._init_segmenter = _safe_init  # type: ignore[method-assign]
        cls._tts_hub_pkuseg_patched = True
        logger.info("Patched Chatterbox ChineseCangjieConverter pkuseg loader")
        return True
    return False
