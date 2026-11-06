#!/usr/bin/env bash
# Double-click in a file manager, or run from Terminal.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is not on PATH."
  echo "On a locked lab machine try: module load python"
  echo "On Ubuntu/Debian: sudo apt install python3 python3-venv python3-pip"
  read -r -p "Press Enter to close..."
  exit 1
fi

python3 "$ROOT/linux/launcher.py"
status=$?

if [[ $status -ne 0 ]]; then
  echo ""
  echo "Launch failed (exit $status)."
  read -r -p "Press Enter to close..."
fi
exit "$status"
