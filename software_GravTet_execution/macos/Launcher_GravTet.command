#!/bin/bash
# Double-click in Finder, or run from Terminal.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is not on PATH. Install Python 3, then run this launcher again."
  read -r -p "Press Enter to close..."
  exit 1
fi

python3 "$ROOT/macos/launcher.py"
status=$?

if [[ $status -ne 0 ]]; then
  echo ""
  echo "Launch failed (exit $status)."
  read -r -p "Press Enter to close..."
fi
exit "$status"
