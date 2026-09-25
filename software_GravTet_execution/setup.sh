#!/usr/bin/env bash
# One-time setup for GravTet: build C++ libs + Python venv.
# Safe to run with: bash setup.sh   (does not require the executable bit).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

chmod +x \
  "$ROOT/setup.sh" \
  "$ROOT/backend/build_system/build.sh" \
  "$ROOT/linux/Launch_GravTet.sh" \
  "$ROOT/macos/Launcher_GravTet.command" \
  "$ROOT/shared/run.sh" \
  2>/dev/null || true

# GitHub zip / browser downloads get a macOS quarantine flag. That makes
# Finder refuse Launcher_GravTet.command ("Apple could not verify...").
if [[ "$(uname -s)" == "Darwin" ]] && command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "$ROOT" 2>/dev/null || true
fi

need_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing command: $cmd" >&2
    echo "Need Python 3 (with venv), CMake, and a C++ compiler (g++ or clang++)." >&2
    echo "On a locked lab machine, load the modules your site provides, for example:" >&2
    echo "  module load python cmake gcc" >&2
    echo "On a personal Ubuntu/Debian machine you can install:" >&2
    echo "  sudo apt install python3 python3-venv python3-pip cmake g++" >&2
    exit 1
  fi
}

echo "=========================================="
echo "GravTet setup"
echo "=========================================="

need_cmd python3
need_cmd cmake
if ! command -v g++ >/dev/null 2>&1 && ! command -v clang++ >/dev/null 2>&1 && ! command -v c++ >/dev/null 2>&1; then
  echo "Missing a C++ compiler (g++, clang++, or c++)." >&2
  echo "On a locked lab machine try: module load gcc" >&2
  echo "On Ubuntu/Debian: sudo apt install g++" >&2
  exit 1
fi

pyver="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)' || {
  echo "Python 3.8+ is required (found $pyver)." >&2
  exit 1
}

echo ""
echo "[1/2] Building C++ gravity libraries ..."
bash "$ROOT/backend/build_system/build.sh"

echo ""
echo "[2/2] Python virtual environment ..."
if [[ ! -x "$ROOT/backend/.venv/bin/python3" ]]; then
  if ! python3 -m venv "$ROOT/backend/.venv"; then
    echo "Could not create backend/.venv." >&2
    echo "The python3-venv package is often missing on lab Linux images." >&2
    echo "On Ubuntu/Debian: sudo apt install python3-venv" >&2
    echo "On a locked machine, load a Python module that includes venv, then rerun." >&2
    exit 1
  fi
fi

VENV_PY="$ROOT/backend/.venv/bin/python3"
if [[ ! -x "$VENV_PY" ]]; then
  VENV_PY="$ROOT/backend/.venv/bin/python"
fi
"$VENV_PY" -m pip install -q --upgrade pip
if ! "$VENV_PY" -m pip install -q -r "$ROOT/backend/requirements.txt"; then
  echo "pip install failed. Check network / proxy access to PyPI." >&2
  echo "Needed packages: Flask, flask-cors, NumPy, Gmsh, Waitress." >&2
  exit 1
fi

echo ""
echo "=========================================="
echo "Setup complete."
echo "Linux:  bash linux/Launch_GravTet.sh"
echo "macOS:  python3 ./macos/launcher.py"
echo "Windows: .\\windows\\Launch_GravTet.bat"
echo "If the browser does not open, use http://127.0.0.1:8765/homepage"
echo "=========================================="
