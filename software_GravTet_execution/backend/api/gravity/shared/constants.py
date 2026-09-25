"""Limits, display names, and paths to built FFI shared libraries."""

import os
import sys
from pathlib import Path

# --- Map JSON / interaction caps (match frontend guards) ---

# Observation grid: full physics still uses user nx×ny; JSON to browser is capped so the UI
# does not parse multi-MB arrays or call Math.min(...1e6 args). Preview is box-averaged.
MAX_MAP_SIDE = 200
# Direct Newton / quadrature: dense O(N·M) — cap raw pairwise count (and N, M separately).
MAX_DIRECT_NEWTON_RECEIVERS = 50000000
MAX_DIRECT_NEWTON_INTERACTIONS = 1000000000000
MAX_DIRECT_NEWTON_SOURCES = 10000000
MAX_AMFM_RECEIVERS = 50000000
MAX_BARNES_HUT_RECEIVERS = 50000000
# AMFM / Barnes–Hut: tree methods ~ O(N·M·log N) style; guard (N·M)/log2(N), not raw N·M.
# Cap the log-scaled interaction metric to keep tree-method workloads bounded.
MAX_APPROXIMATE_METHOD_LOG_SCALED_INTERACTIONS = 1000000000000
MAX_QUADRATURE_SOURCES = 10000000
MAX_TET_MESH_NODES = 3000000
MAX_TET_MESH_ELEMENTS = 10000000

# Friendly names shown in backend validation/error strings.
AMF_PLUS_ADVANCED_NEWTON_NAME = "AMF+ Advanced Newton"
BARNES_HUT_ADVANCED_NEWTON_NAME = "Barnes–Hut + Advanced Newton"

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


DIRECT_NEWTON_LIB_PATH = _resolve_gravity_shared_lib("direct_newton_gravity")
SYNTHETIC_GRAVITY_LIB_PATH = _resolve_gravity_shared_lib("synthetic_gravity")
AMFM_GRAVITY_LIB_PATH = _resolve_gravity_shared_lib("amfm_gravity")
BARNES_HUT_LIB_PATH = _resolve_gravity_shared_lib("barnes_hut_gravity")
QUADRATURE_SECOND_ORDER_LIB_PATH = _resolve_gravity_shared_lib("quadrature_second_order_gravity")
