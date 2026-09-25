#!/usr/bin/env bash
# Shared by macos/ and linux/. ROOT = execution bundle root.
set -euo pipefail
SHARED="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SHARED/.." && pwd)"
cd "$ROOT"

VENV_PY=""
if [[ -x "$ROOT/backend/.venv/bin/python3" ]]; then
  VENV_PY="$ROOT/backend/.venv/bin/python3"
elif [[ -x "$ROOT/backend/.venv/bin/python" ]]; then
  VENV_PY="$ROOT/backend/.venv/bin/python"
fi

ensure_venv() {
  if [[ -n "$VENV_PY" ]]; then
    return 0
  fi
  echo "Python venv missing — creating backend/.venv and installing dependencies ..."
  if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3 not found. Install Python 3, then run ./setup.sh" >&2
    exit 1
  fi
  python3 -m venv "$ROOT/backend/.venv"
  if [[ -x "$ROOT/backend/.venv/bin/python3" ]]; then
    VENV_PY="$ROOT/backend/.venv/bin/python3"
  else
    VENV_PY="$ROOT/backend/.venv/bin/python"
  fi
  "$VENV_PY" -m pip install -q --upgrade pip
  "$VENV_PY" -m pip install -q -r "$ROOT/backend/requirements.txt"
}

ensure_venv

if ! "$VENV_PY" -c "import flask" >/dev/null 2>&1; then
  echo "Flask missing in venv — installing Python packages ..."
  "$VENV_PY" -m pip install -q --upgrade pip
  "$VENV_PY" -m pip install -q -r "$ROOT/backend/requirements.txt"
fi

if [[ ! -f "$ROOT/ui/index.html" ]]; then
  echo "Built UI is missing at ui/." >&2
  exit 1
fi

if [[ ! -d "$ROOT/backend" ]]; then
  echo "backend/ is missing inside the bundle." >&2
  exit 1
fi

# Native libs come from ./setup.sh (C++ build). Without them the API will fail later.
if [[ ! -d "$ROOT/backend/build/lib" ]]; then
  echo "WARNING: backend/build/lib not found. Run ./setup.sh once to build C++ libraries." >&2
fi

export PYTHONPATH="$ROOT/backend${PYTHONPATH:+:$PYTHONPATH}"
exec "$VENV_PY" "$SHARED/run.py" --browser "$@"
