"""Limits, display names, and paths to built FFI shared libraries."""

import os
import sys
from pathlib import Path

# --- Map JSON / interaction caps (match frontend guards) ---

# Observation grid: full physics still uses user nx×ny; JSON to browser is capped so the UI
# does not parse multi-MB arrays or call Math.min(...1e6 args). Preview is box-averaged.
MAX_MAP_SIDE = 200
MAX_QUADRATURE_SOURCES = 10000000
MAX_TET_MESH_NODES = 3000000
MAX_TET_MESH_ELEMENTS = 10000000

# --- Repo layout: backend root + unified build/lib ---
# Optional env overrides are for the execution bundle packager only; unset in the web app.

# Get backend directory (this module lives in backend/api/gravity/shared)
_backend_override = os.environ.get("GRAVTET_BACKEND_DIR", "").strip()
BACKEND_DIR = Path(_backend_override).resolve() if _backend_override else Path(__file__).resolve().parents[3]
PROJECT_ROOT = BACKEND_DIR.parent

# Single unified build output folder.
_lib_override = os.environ.get("GRAVTET_LIB_DIR", "").strip()
BUILD_LIB_DIR = Path(_lib_override).resolve() if _lib_override else BACKEND_DIR / "build" / "lib"
GRAVITY_DIR = BACKEND_DIR / "gravity"


def _resolve_gravity_shared_lib(stem: str) -> Path:
    """macOS: lib*.dylib — Linux: lib*.so — Windows: lib*.dll or *.dll."""
    names = [f"lib{stem}.dylib", f"lib{stem}.so", f"lib{stem}.dll", f"{stem}.dll"]
    for name in names:
        p = BUILD_LIB_DIR / name
        if p.exists():
            return p
    if sys.platform == "darwin":
        return BUILD_LIB_DIR / f"lib{stem}.dylib"
    if sys.platform == "win32":
        return BUILD_LIB_DIR / f"{stem}.dll"
    return BUILD_LIB_DIR / f"lib{stem}.so"


SYNTHETIC_GRAVITY_LIB_PATH = _resolve_gravity_shared_lib("synthetic_gravity")
QUADRATURE_SECOND_ORDER_LIB_PATH = _resolve_gravity_shared_lib("quadrature_second_order_gravity")
