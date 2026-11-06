"""Locate paths inside the execution bundle (self-contained: backend + ui)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

DEFAULT_PORT = 8765
DEFAULT_HOST = "127.0.0.1"


def _meipass() -> Path:
    return Path(getattr(sys, "_MEIPASS"))


def _is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


if _is_frozen():
    BUNDLE_DIR = _meipass()
    PROJECT_ROOT = _meipass()
    BACKEND_DIR = _meipass()
    UI_DIR = _meipass() / "ui"
    LIB_DIR = _meipass() / "native"
else:
    BUNDLE_DIR = Path(__file__).resolve().parent.parent
    PROJECT_ROOT = BUNDLE_DIR
    BACKEND_DIR = BUNDLE_DIR / "backend"
    UI_DIR = BUNDLE_DIR / "ui"
    LIB_DIR = BACKEND_DIR / "build" / "lib"


def ensure_backend_on_path() -> None:
    backend = str(BACKEND_DIR)
    if backend not in sys.path:
        sys.path.insert(0, backend)


def apply_runtime_env() -> None:
    """Point the API at native libs (frozen bundle or backend/build/lib)."""
    if _is_frozen():
        os.environ.setdefault("GRAVTET_BACKEND_DIR", str(BACKEND_DIR))
        os.chdir(Path(sys.executable).resolve().parent)
    if not LIB_DIR.is_dir():
        return
    lib = str(LIB_DIR)
    os.environ.setdefault("GRAVTET_LIB_DIR", lib)
    if hasattr(os, "add_dll_directory"):
        os.add_dll_directory(lib)
    # Linux/macOS: let ctypes find sibling shared libraries (libsynthetic_gravity).
    for key in ("LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"):
        current = os.environ.get(key, "")
        parts = [p for p in current.split(os.pathsep) if p]
        if lib not in parts:
            os.environ[key] = os.pathsep.join([lib] + parts)
    path = os.environ.get("PATH", "")
    path_parts = [p for p in path.split(os.pathsep) if p]
    if lib not in path_parts:
        os.environ["PATH"] = os.pathsep.join([lib] + path_parts)
