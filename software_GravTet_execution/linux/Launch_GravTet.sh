#!/usr/bin/env bash
# Start GravTet via linux/launcher.py (same idea as windows/Launch_GravTet.bat).
# Safe to run with: bash linux/Launch_GravTet.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is not on PATH."
  echo "On a locked lab machine try: module load python"
  echo "On Ubuntu/Debian: sudo apt install python3 python3-venv python3-pip"
  exit 1
fi

exec python3 "$ROOT/linux/launcher.py"
